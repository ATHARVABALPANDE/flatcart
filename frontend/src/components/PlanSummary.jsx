import { storeInfo } from '../stores.js';

function StoreCard({ storeStat }) {
  const info = storeInfo(storeStat.store);
  const short = storeStat.availableCount < storeStat.totalCoverable;
  return (
    <div className="store-card" style={{ '--store-color': info.color }}>
      <div className="store-card-head">
        <span className="store-card-name">{info.label}</span>
        <span className="store-card-subtotal">₹{storeStat.subtotal.toFixed(2)}</span>
      </div>
      <div className="store-card-line muted">
        covers {storeStat.availableCount}/{storeStat.totalCoverable} items
        {short && ' (missing some)'}
      </div>
      <div className={`store-card-line ${storeStat.qualifiesFreeDelivery ? 'ok' : 'muted'}`}>
        {storeStat.qualifiesFreeDelivery
          ? 'Free delivery'
          : `₹${storeStat.deliveryFee} delivery fee`}
      </div>
    </div>
  );
}

export default function PlanSummary({ perStore, plan, unchecked, unavailableEverywhere, items, onOrderStore }) {
  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]));

  return (
    <section className="plan-summary">
      <h2>Store comparison</h2>
      <div className="store-card-grid">
        {perStore.map((s) => (
          <StoreCard key={s.store} storeStat={s} />
        ))}
      </div>

      {plan.stores.length > 0 && (
        <div className="suggested-plan">
          <h3>
            Suggested plan &middot; {plan.storesUsed} store{plan.storesUsed === 1 ? '' : 's'} &middot; total ₹
            {plan.totalCost.toFixed(2)}
          </h3>
          {plan.stores.map((storePlan) => {
            const info = storeInfo(storePlan.store);
            return (
              <div key={storePlan.store} className="plan-store-block" style={{ '--store-color': info.color }}>
                <div className="plan-store-head">
                  <span className="plan-store-name">{info.label}</span>
                  <span className="muted">
                    ₹{storePlan.subtotal.toFixed(2)} + {storePlan.qualifiesFreeDelivery ? 'free delivery' : `₹${storePlan.deliveryFee} delivery`}
                  </span>
                  <button className="order-plan-btn" onClick={() => onOrderStore(storePlan.store, storePlan.items.map((i) => i.id))}>
                    Mark ordered from {info.label}
                  </button>
                </div>
                <ul className="plan-item-list muted">
                  {storePlan.items.map((i) => (
                    <li key={i.id}>{i.name} &middot; ₹{i.price}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {unchecked.length > 0 && (
        <p className="plan-note muted">
          Still need a price check: {unchecked.map((id) => itemsById[id]?.name).filter(Boolean).join(', ')}
        </p>
      )}
      {unavailableEverywhere.length > 0 && (
        <p className="plan-note muted">
          Out of stock everywhere checked so far: {unavailableEverywhere.map((id) => itemsById[id]?.name).filter(Boolean).join(', ')}
        </p>
      )}
    </section>
  );
}
