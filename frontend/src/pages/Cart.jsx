import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import ItemRow from '../components/ItemRow.jsx';
import AddItemForm from '../components/AddItemForm.jsx';
import PlanSummary from '../components/PlanSummary.jsx';
import LivePricingPanel from '../components/LivePricingPanel.jsx';
import HouseholdPanel from '../components/HouseholdPanel.jsx';
import StickyOrderBar from '../components/StickyOrderBar.jsx';

const POLL_MS = 5000;

export default function Cart() {
  const { householdId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [household, setHousehold] = useState(null);
  const [list, setList] = useState(null);
  const [livePricing, setLivePricing] = useState(null);
  const [error, setError] = useState('');
  const [showOrdered, setShowOrdered] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [priceMsg, setPriceMsg] = useState('');
  const [pickedStore, setPickedStore] = useState(null);
  const pollRef = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const data = await api.getList(householdId);
      setList(data);
    } catch (err) {
      setError(err.message);
    }
  }, [householdId]);

  const loadLivePricing = useCallback(async () => {
    try {
      const data = await api.getLivePricingSettings(householdId);
      setLivePricing(data);
    } catch (err) {
      setError(err.message);
    }
  }, [householdId]);

  useEffect(() => {
    api
      .getHousehold(householdId)
      .then((data) => setHousehold(data.household))
      .catch((err) => setError(err.message));
    loadList();
    loadLivePricing();

    pollRef.current = setInterval(loadList, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [householdId, loadList, loadLivePricing]);

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
    const nextStatus = item.status === 'ORDERED' ? 'PENDING' : 'ORDERED';
    await api.updateItem(item.id, { status: nextStatus });
    loadList();
  }

  async function handleDelete(item) {
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

  async function handleLeave() {
    await api.leaveHousehold(householdId);
    navigate('/');
  }

  async function handleDeleteHousehold(confirmName) {
    await api.deleteHousehold(householdId, confirmName);
    navigate('/');
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
      // Step aside so the bar can go back to showing the order total.
      setTimeout(() => setPriceMsg(''), 6000);
    } catch (err) {
      setPriceMsg(err.message);
    } finally {
      setPricing(false);
    }
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

  // Overriding the recommendation with a single store changes what the order
  // costs, so the bar has to follow the choice rather than keep quoting the
  // recommendation's total.
  const picked = pickedStore ? list?.perStore?.find((s) => s.store === pickedStore) : null;
  const shownPlan = picked
    ? { storesUsed: 1, totalCost: picked.subtotal, stores: [{ store: picked.store, items: picked.items, subtotal: picked.subtotal }] }
    : list?.plan;

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

      {household && livePricing && (
        <HouseholdPanel
          household={household}
          currentUserId={user?.id}
          location={livePricing}
          onSaveLocation={handleUpdateLivePricing}
          onLeave={handleLeave}
          onDelete={handleDeleteHousehold}
        />
      )}

      <section className="cart-section">
        <h2>Shopping list</h2>
        <AddItemForm onAdd={handleAdd} />

        {list === null ? (
          <p className="muted">Loading list...</p>
        ) : pendingItems.length === 0 ? (
          <p className="muted">No items yet. Add what you need above.</p>
        ) : (
          <ul className="item-list">
            {pendingItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onSaveListing={handleSaveListing}
                onClearListing={handleClearListing}
                onToggleOrdered={handleToggleOrdered}
                onDelete={handleDelete}
                onRefreshPrice={handleRefreshPrice}
                liveConfigured={!!livePricing?.configured}
              />
            ))}
          </ul>
        )}
      </section>

      {list && pendingItems.length > 0 && (
        <div id="recommended-order">
          <PlanSummary
            plan={list.plan}
            perStore={list.perStore}
            unchecked={list.unchecked}
            unavailableEverywhere={list.unavailableEverywhere}
            items={list.items}
            onOrderStore={handleOrderStore}
            pickedStore={pickedStore}
            onPickStore={setPickedStore}
          />
        </div>
      )}

      {livePricing && <LivePricingPanel settings={livePricing} onUpdate={handleUpdateLivePricing} />}

      {orderedItems.length > 0 && (
        <section className="cart-section">
          <button className="link" onClick={() => setShowOrdered((v) => !v)}>
            {showOrdered ? 'Hide' : 'Show'} already ordered ({orderedItems.length})
          </button>
          {showOrdered && (
            <ul className="item-list" style={{ marginTop: 10 }}>
              {orderedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onSaveListing={handleSaveListing}
                  onClearListing={handleClearListing}
                  onToggleOrdered={handleToggleOrdered}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <StickyOrderBar
        pendingCount={pendingItems.length}
        plan={shownPlan}
        needsPricingCount={list?.needsPricing?.length || 0}
        liveConfigured={!!livePricing?.configured}
        pricing={pricing}
        priceMsg={priceMsg}
        onPriceAll={handlePriceAll}
      />
    </div>
  );
}
