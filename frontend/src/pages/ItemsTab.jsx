import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AddItemForm from '../components/AddItemForm.jsx';
import ItemRow from '../components/ItemRow.jsx';
import StickyOrderBar from '../components/StickyOrderBar.jsx';

export default function ItemsTab() {
  const {
    list,
    livePricing,
    pendingItems,
    orderedItems,
    needsPricingCount,
    shownPlan,
    pricing,
    priceMsg,
    onAdd,
    onSaveListing,
    onClearListing,
    onToggleOrdered,
    onDeleteItem,
    onRefreshPrice,
    onPriceAll,
  } = useOutletContext();
  const [showOrdered, setShowOrdered] = useState(false);

  return (
    <>
      <section className="cart-section">
        <h2>Shopping list</h2>
        <AddItemForm onAdd={onAdd} />

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
                onSaveListing={onSaveListing}
                onClearListing={onClearListing}
                onToggleOrdered={onToggleOrdered}
                onDelete={onDeleteItem}
                onRefreshPrice={onRefreshPrice}
                liveConfigured={!!livePricing?.configured}
              />
            ))}
          </ul>
        )}
      </section>

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
                  onSaveListing={onSaveListing}
                  onClearListing={onClearListing}
                  onToggleOrdered={onToggleOrdered}
                  onDelete={onDeleteItem}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <StickyOrderBar
        pendingCount={pendingItems.length}
        plan={shownPlan}
        needsPricingCount={needsPricingCount}
        liveConfigured={!!livePricing?.configured}
        pricing={pricing}
        priceMsg={priceMsg}
        onPriceAll={onPriceAll}
      />
    </>
  );
}
