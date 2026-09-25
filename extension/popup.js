const API_URL = 'https://flatcart-backend-p6y3.onrender.com/api';

const app = document.getElementById('app');

function html(strings, ...values) {
  return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function getStored(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
async function setStored(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}
async function clearStored() {
  return new Promise((resolve) => chrome.storage.local.clear(resolve));
}

async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const STORES = [
  { key: 'BLINKIT', label: 'Blinkit' },
  { key: 'ZEPTO', label: 'Zepto' },
  { key: 'INSTAMART', label: 'Instamart' },
  { key: 'BIGBASKET', label: 'BigBasket' },
];

function detectStore(hostname, pathname) {
  if (hostname.includes('blinkit.com')) return 'BLINKIT';
  if (hostname.includes('zeptonow.com')) return 'ZEPTO';
  if (hostname.includes('swiggy.com') && pathname.includes('/instamart')) return 'INSTAMART';
  if (hostname.includes('bigbasket.com')) return 'BIGBASKET';
  return null;
}

// Executed inside the active tab via chrome.scripting.executeScript.
function extractPageInfo() {
  const bodyText = document.body ? document.body.innerText || '' : '';
  const priceMatch = bodyText.match(/₹\s?([\d,]+(?:\.\d{1,2})?)/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
  const outOfStock = /(out of stock|currently unavailable|sold out|not available right now)/i.test(bodyText);
  let name =
    document.querySelector('meta[property="og:title"]')?.content ||
    document.querySelector('h1')?.innerText ||
    document.title ||
    '';
  name = name.split('|')[0].split(' - ')[0].trim().slice(0, 80);
  return { name, price, outOfStock };
}

async function extractFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return { tab: null, guess: null };
  let url;
  try {
    url = new URL(tab.url);
  } catch {
    return { tab, guess: null };
  }
  const store = detectStore(url.hostname, url.pathname);
  if (!store) return { tab, guess: null, store: null };

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageInfo,
    });
    return { tab, guess: result, store };
  } catch {
    return { tab, guess: null, store };
  }
}

async function render() {
  const { flatcart_token: token, flatcart_household_id: householdId } = await getStored([
    'flatcart_token',
    'flatcart_household_id',
  ]);

  if (!token) return renderLogin();

  let me;
  try {
    me = await apiRequest('/auth/me', { token });
  } catch (err) {
    if (err.status === 401) {
      await clearStored();
      return renderLogin();
    }
    return renderError(err.message);
  }

  if (!householdId) return renderChooseHousehold(token, me.user);

  return renderCapture(token, me.user, householdId);
}

function renderLogin(error) {
  app.innerHTML = html`
    <p class="muted">Log in with your FlatCart account.</p>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
    <label>Email</label>
    <input id="email" type="email" />
    <label>Password</label>
    <input id="password" type="password" />
    <button id="login-btn">Log in</button>
  `;
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) return;
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Logging in...';
    try {
      const data = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
      await setStored({ flatcart_token: data.token });
      render();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

async function renderChooseHousehold(token, user) {
  app.innerHTML = `<p class="muted">Loading your households...</p>`;
  let households;
  try {
    const data = await apiRequest('/households', { token });
    households = data.households;
  } catch (err) {
    return renderError(err.message);
  }

  if (households.length === 0) {
    app.innerHTML = html`
      <p class="muted">Hi ${escapeHtml(user.name)}. You're not in a household yet.</p>
      <p class="muted">Create or join one in the FlatCart web app first, then come back here.</p>
      <button id="open-app">Open FlatCart</button>
      <button id="refresh" class="link">I've joined one - refresh</button>
      <div class="footer"><button id="logout" class="link">Log out</button></div>
    `;
    document.getElementById('open-app').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://flatcart-frontend.onrender.com' });
    });
    document.getElementById('refresh').addEventListener('click', render);
    document.getElementById('logout').addEventListener('click', async () => {
      await clearStored();
      render();
    });
    return;
  }

  app.innerHTML = html`
    <p class="muted">Which household?</p>
    <select id="household-select">
      ${households.map((h) => `<option value="${h.id}">${escapeHtml(h.name)}</option>`).join('')}
    </select>
    <button id="continue-btn">Continue</button>
  `;
  document.getElementById('continue-btn').addEventListener('click', async () => {
    const householdId = document.getElementById('household-select').value;
    await setStored({ flatcart_household_id: householdId });
    render();
  });
}

function findBestMatch(items, guessedName) {
  if (!guessedName) return null;
  const needle = guessedName.toLowerCase();
  return (
    items.find((i) => i.name.toLowerCase() === needle) ||
    items.find((i) => needle.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(needle)) ||
    null
  );
}

async function renderCapture(token, user, householdId) {
  app.innerHTML = `<p class="muted">Reading this page...</p>`;

  const [{ guess, store: detectedStore }, listData] = await Promise.all([
    extractFromActiveTab(),
    apiRequest(`/households/${householdId}/cart`, { token }).catch(() => ({ items: [] })),
  ]);

  const pendingItems = listData.items.filter((i) => i.status === 'PENDING');
  const match = guess ? findBestMatch(pendingItems, guess.name) : null;

  app.innerHTML = html`
    <p class="muted">Signed in as ${escapeHtml(user.name)}</p>
    ${!detectedStore
      ? `<p class="error">This doesn't look like a Blinkit/Zepto/Instamart/BigBasket page - pick the store manually if you're on one anyway.</p>`
      : ''}

    <label>Store</label>
    <select id="store-select">
      ${STORES.map((s) => `<option value="${s.key}" ${s.key === detectedStore ? 'selected' : ''}>${s.label}</option>`).join('')}
    </select>

    <label>Item</label>
    <select id="item-select">
      ${pendingItems
        .map((i) => `<option value="${i.id}" ${match?.id === i.id ? 'selected' : ''}>${escapeHtml(i.name)}</option>`)
        .join('')}
      <option value="__new__" ${!match ? 'selected' : ''}>+ Add as new item</option>
    </select>
    <input id="new-item-name" placeholder="New item name" style="margin-top:6px; display:${match ? 'none' : 'block'}" value="${escapeHtml(guess?.name || '')}" />

    <label>Price (₹)</label>
    <input id="price-input" type="number" min="0" step="0.01" value="${guess?.price ?? ''}" />

    <div class="row">
      <input id="oos-checkbox" type="checkbox" ${guess?.outOfStock ? 'checked' : ''} />
      <label style="margin:0">Out of stock</label>
    </div>

    <button id="save-btn">Send to FlatCart</button>
    <div class="footer">
      <button id="switch-household" class="link">Switch household</button>
      <button id="logout" class="link">Log out</button>
    </div>
  `;

  document.getElementById('item-select').addEventListener('change', (e) => {
    document.getElementById('new-item-name').style.display = e.target.value === '__new__' ? 'block' : 'none';
  });

  document.getElementById('switch-household').addEventListener('click', async () => {
    await setStored({ flatcart_household_id: null });
    render();
  });
  document.getElementById('logout').addEventListener('click', async () => {
    await clearStored();
    render();
  });

  document.getElementById('save-btn').addEventListener('click', async () => {
    const btn = document.getElementById('save-btn');
    const store = document.getElementById('store-select').value;
    const itemSelect = document.getElementById('item-select').value;
    const price = parseFloat(document.getElementById('price-input').value);
    const outOfStock = document.getElementById('oos-checkbox').checked;

    if (!outOfStock && (isNaN(price) || price < 0)) {
      alert('Enter a price, or check "Out of stock".');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      let itemId = itemSelect;
      if (itemSelect === '__new__') {
        const name = document.getElementById('new-item-name').value.trim();
        if (!name) {
          alert('Enter an item name.');
          btn.disabled = false;
          btn.textContent = 'Send to FlatCart';
          return;
        }
        const created = await apiRequest(`/households/${householdId}/cart`, {
          method: 'POST',
          token,
          body: { name, quantity: '1' },
        });
        itemId = created.item.id;
      }

      await apiRequest(`/cart/${itemId}/listings/${store}`, {
        method: 'PUT',
        token,
        body: { price: outOfStock ? 0 : price, inStock: !outOfStock },
      });

      app.innerHTML = html`
        <p>Sent to FlatCart.</p>
        <button id="capture-again">Capture another</button>
      `;
      document.getElementById('capture-again').addEventListener('click', render);
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = 'Send to FlatCart';
    }
  });
}

function renderError(message) {
  app.innerHTML = html`
    <p class="error">${escapeHtml(message)}</p>
    <button id="retry">Retry</button>
  `;
  document.getElementById('retry').addEventListener('click', render);
}

render();
