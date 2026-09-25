import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { STORES } from '../stores.js';
import ItemRow from '../components/ItemRow.jsx';
import AddItemForm from '../components/AddItemForm.jsx';

const POLL_MS = 5000;

export default function Cart() {
  const { householdId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [household, setHousehold] = useState(null);
  const [items, setItems] = useState(null);
  const [activeStore, setActiveStore] = useState(STORES[0].key);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const pollRef = useRef(null);

  const loadCart = useCallback(async () => {
    try {
      const data = await api.getCart(householdId);
      setItems(data.items);
    } catch (err) {
      setError(err.message);
    }
  }, [householdId]);

  useEffect(() => {
    api
      .getHousehold(householdId)
      .then((data) => setHousehold(data.household))
      .catch((err) => setError(err.message));
    loadCart();

    pollRef.current = setInterval(loadCart, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [householdId, loadCart]);

  async function handleAdd(item) {
    await api.addItem(householdId, item);
    loadCart();
  }

  async function handleToggleOrdered(item) {
    const nextStatus = item.status === 'ORDERED' ? 'PENDING' : 'ORDERED';
    await api.updateItem(item.id, { status: nextStatus });
    loadCart();
  }

  async function handleDelete(item) {
    await api.deleteItem(item.id);
    loadCart();
  }

  async function handleOrderStore(storeKey) {
    const list = items?.[storeKey] || [];
    const pendingCount = list.filter((i) => i.status === 'PENDING').length;
    if (pendingCount === 0) return;
    await api.orderStore(householdId, storeKey);
    loadCart();
  }

  if (error) {
    return (
      <div className="page">
        <p className="error">{error}</p>
        <button onClick={() => navigate('/')}>Back to households</button>
      </div>
    );
  }

  const activeItems = items?.[activeStore] || [];
  const pendingCount = activeItems.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <button className="link" onClick={() => navigate('/')}>&larr; Households</button>
          <h1>{household?.name || 'Loading...'}</h1>
        </div>
        <div>
          <span className="muted">{user?.name}</span>
          <button className="link" onClick={logout}>Log out</button>
        </div>
      </header>

      {household && (
        <div className="invite-bar">
          <button className="link" onClick={() => setShowInvite((v) => !v)}>
            {showInvite ? 'Hide invite code' : 'Show invite code'}
          </button>
          {showInvite && (
            <span className="invite-code">
              Share this code with flatmates: <strong>{household.inviteCode}</strong>
            </span>
          )}
        </div>
      )}

      <nav className="tabs">
        {STORES.map((s) => {
          const count = items?.[s.key]?.filter((i) => i.status === 'PENDING').length || 0;
          return (
            <button
              key={s.key}
              className={`tab ${activeStore === s.key ? 'active' : ''}`}
              style={{ '--tab-color': s.color }}
              onClick={() => setActiveStore(s.key)}
            >
              {s.label} {count > 0 && <span className="badge">{count}</span>}
            </button>
          );
        })}
      </nav>

      <section className="cart-section">
        <AddItemForm store={activeStore} onAdd={handleAdd} />

        {items === null ? (
          <p className="muted">Loading cart...</p>
        ) : activeItems.length === 0 ? (
          <p className="muted">No items yet for this store.</p>
        ) : (
          <ul className="item-list">
            {activeItems.map((item) => (
              <ItemRow key={item.id} item={item} onToggleOrdered={handleToggleOrdered} onDelete={handleDelete} />
            ))}
          </ul>
        )}

        {activeItems.length > 0 && (
          <button
            className="order-btn"
            disabled={pendingCount === 0}
            onClick={() => handleOrderStore(activeStore)}
          >
            Mark all {pendingCount} pending item{pendingCount === 1 ? '' : 's'} as ordered
          </button>
        )}
      </section>
    </div>
  );
}
