import { storeInfo } from '../stores.js';

export default function PlanSummary({ plan, unchecked, unavailableEverywhere, items, onOrderStore }) {
  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]));

  return (
    <section className="plan-summary">
      <h2>Recommended order</h2>

      {plan.stores.length > 0 ? (
        <div className="suggested-plan">
          <h3>
            {plan.storesUsed} store{plan.storesUsed === 1 ? '' : 's'} &middot; total ₹{plan.totalCost.toFixed(2)}
          </h3>
          {plan.stores.map((storePlan) => {
            const info = storeInfo(storePlan.store);
            return (
              <div key={storePlan.store} className="plan-store-block" style={{ '--store-color': info.color }}>
                <div className="plan-store-head">
                  <span className="plan-store-name">{info.label}</span>
                  <span className="muted">₹{storePlan.subtotal.toFixed(2)}</span>
                  <button className="order-plan-btn" onClick={() => onOrderStore(storePlan.store, storePlan.items.map((i) => i.id))}>
                    Mark ordered from {info.label}
                  </button>
                </div>
                <ul className="plan-item-list muted">
                  {storePlan.items.map((i) => (
                    <li key={i.id}>
                      {i.name} &middot; {i.packsNeeded > 1 ? `${i.packsNeeded}× ` : ''}
                      {i.packSize} {i.packsNeeded > 1 ? `@ ₹${i.unitPrice} ` : ''}= ₹{i.price.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">Add a price for at least one item to get an order recommendation.</p>
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
