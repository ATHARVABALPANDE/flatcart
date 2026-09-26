import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const POLL_MS = 5000;

const TABS = [
  { to: 'list', label: 'List', icon: '☰' },
  { to: 'order', label: 'Order', icon: '₹' },
  { to: 'flat', label: 'Flat', icon: '⌂' },
  { to: 'me', label: 'Me', icon: '☺' },
];

// Owns everything shared across the household's tabs: the list, the household
// record, live-pricing settings, and the handlers that mutate them. Tabs stay
// presentational and read this through the outlet context, so switching tabs
// never refetches or loses the chosen store.
export default function HouseholdLayout() {
  const { householdId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [household, setHousehold] = useState(null);
  const [list, setList] = useState(null);
  const [livePricing, setLivePricing] = useState(null);
  const [error, setError] = useState('');
  const [pricing, setPricing] = useState(false);
  const [priceMsg, setPriceMsg] = useState('');
  const [pickedStore, setPickedStore] = useState(null);
  const pollRef = useRef(null);

  const loadList = useCallback(async () => {
    try {
      setList(await api.getList(householdId));
    } catch (err) {
      setError(err.message);
    }
  }, [householdId]);

  const loadHousehold = useCallback(async () => {
    try {
      const data = await api.getHousehold(householdId);
      setHousehold(data.household);
    } catch (err) {
      setError(err.message);
    }
  }, [householdId]);

  const loadLivePricing = useCallback(async () => {
    try {
      setLivePricing(await api.getLivePricingSettings(householdId));
    } catch (err) {
      setError(err.message);
    }
  }, [householdId]);

  useEffect(() => {
    loadHousehold();
    loadList();
    loadLivePricing();
    pollRef.current = setInterval(loadList, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [householdId, loadHousehold, loadList, loadLivePricing]);

  async function handleAdd(item) {
    await api.addItem(householdId, item);
    loadList();
  }

  async function handleSaveListing(item, store, data) {
    await api.setListing(item.id, store, data);
    loadList();
  }

  async function handleClearListing(item, store, packSize) {
    await api.clearListing(item.id, store, packSize);
    loadList();
  }

  async function handleToggleOrdered(item) {
    await api.updateItem(item.id, { status: item.status === 'ORDERED' ? 'PENDING' : 'ORDERED' });
    loadList();
  }

  async function handleDeleteItem(item) {
    await api.deleteItem(item.id);
    loadList();
  }

  async function handleOrderStore(store, itemIds) {
    if (itemIds.length === 0) return;
    await api.orderItems(householdId, store, itemIds);
    loadList();
  }

  async function handleUpdateLivePricing(patch) {
    await api.updateLivePricingSettings(householdId, patch);
    loadLivePricing();
  }

  async function handleRefreshPrice(item, force) {
    const result = await api.refreshPrice(householdId, item.id, force);
    if (!result.skipped) loadList();
    return result;
  }

  async function handlePriceAll() {
    setPricing(true);
    setPriceMsg('');
    try {
      const result = await api.priceAll(householdId);
      await loadList();
      const parts = [`Priced ${result.priced}`];
      if (result.skipped > 0) parts.push(`${result.skipped} still fresh`);
      if (result.creditsRemaining != null) parts.push(`${result.creditsRemaining} credits left`);
      // Show why it failed, not just that it did - the likely cause is running
      // out of credits, which nobody can act on from a bare count.
      if (result.failed.length > 0) parts.push(`${result.failed.length} failed: ${result.failed[0].reason}`);
      setPriceMsg(parts.join(' · '));
      setTimeout(() => setPriceMsg(''), 6000);
    } catch (err) {
      setPriceMsg(err.message);
    } finally {
      setPricing(false);
    }
  }

  async function handleLeave() {
    await api.leaveHousehold(householdId);
    navigate('/');
  }

  async function handleDeleteHousehold(confirmName) {
    await api.deleteHousehold(householdId, confirmName);
    navigate('/');
  }

  if (error) {
    return (
      <div className="page">
        <p className="error">{error}</p>
        <button onClick={() => navigate('/')}>Back to households</button>
      </div>
    );
  }

  const pendingItems = list?.items.filter((i) => i.status === 'PENDING') || [];
  const orderedItems = list?.items.filter((i) => i.status === 'ORDERED') || [];
  const needsPricingCount = list?.needsPricing?.length || 0;

  // Overriding the recommendation with a single store changes what the order
  // costs, so anything quoting a total has to follow that choice.
  const picked = pickedStore ? list?.perStore?.find((s) => s.store === pickedStore) : null;
  const shownPlan = picked
    ? { storesUsed: 1, totalCost: picked.subtotal, stores: [{ store: picked.store, items: picked.items, subtotal: picked.subtotal }] }
    : list?.plan;

  const context = {
    householdId,
    household,
    user,
    list,
    livePricing,
    pendingItems,
    orderedItems,
    needsPricingCount,
    shownPlan,
    pickedStore,
    setPickedStore,
    pricing,
    priceMsg,
    onAdd: handleAdd,
    onSaveListing: handleSaveListing,
    onClearListing: handleClearListing,
    onToggleOrdered: handleToggleOrdered,
    onDeleteItem: handleDeleteItem,
    onOrderStore: handleOrderStore,
    onRefreshPrice: handleRefreshPrice,
    onPriceAll: handlePriceAll,
    onUpdateLivePricing: handleUpdateLivePricing,
    onLeave: handleLeave,
    onDeleteHousehold: handleDeleteHousehold,
    onReloadHousehold: loadHousehold,
    logout,
  };

  return (
    <div className="page has-tabs">
      <header className="topbar">
        <div>
          <button className="link" onClick={() => navigate('/')}>&larr; Households</button>
          <h1>{household?.name || 'Loading...'}</h1>
        </div>
        <span className="muted">{user?.name}</span>
      </header>

      <Outlet context={context} />

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.to === 'list' && pendingItems.length > 0 && (
              <span className="tab-badge">{pendingItems.length}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
