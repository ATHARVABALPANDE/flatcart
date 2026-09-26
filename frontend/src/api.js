const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('flatcart_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('flatcart_token', token);
  else localStorage.removeItem('flatcart_token');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  signup: (email, password, name) => request('/auth/signup', { method: 'POST', body: { email, password, name } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),

  myHouseholds: () => request('/households'),
  createHousehold: (name) => request('/households', { method: 'POST', body: { name } }),
  joinHousehold: (inviteCode) => request('/households/join', { method: 'POST', body: { inviteCode } }),
  getHousehold: (id) => request(`/households/${id}`),

  getList: (householdId) => request(`/households/${householdId}/cart`),
  addItem: (householdId, item) => request(`/households/${householdId}/cart`, { method: 'POST', body: item }),
  updateItem: (itemId, patch) => request(`/cart/${itemId}`, { method: 'PATCH', body: patch }),
  deleteItem: (itemId) => request(`/cart/${itemId}`, { method: 'DELETE' }),
  orderItems: (householdId, store, itemIds) =>
    request(`/households/${householdId}/cart/order`, { method: 'POST', body: { store, itemIds } }),

  setListing: (itemId, store, { price, inStock, packSize, matchedName }) =>
    request(`/cart/${itemId}/listings/${store}`, { method: 'PUT', body: { price, inStock, packSize, matchedName } }),
  clearListing: (itemId, store) => request(`/cart/${itemId}/listings/${store}`, { method: 'DELETE' }),

  getLivePricingSettings: (householdId) => request(`/households/${householdId}/live-pricing`),
  updateLivePricingSettings: (householdId, patch) =>
    request(`/households/${householdId}/live-pricing`, { method: 'PATCH', body: patch }),
  refreshPrice: (householdId, itemId) =>
    request(`/households/${householdId}/cart/${itemId}/refresh-price`, { method: 'POST' }),

  reverseGeocode: (lat, lon) => request(`/geocode/reverse?lat=${lat}&lon=${lon}`),
};
