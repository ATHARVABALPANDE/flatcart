import { Link } from 'react-router-dom';
import { storeInfo } from '../stores.js';

function StoreBlock({ store, items, subtotal, onOrderStore }) {
  const info = storeInfo(store);
  return (
    <div className="plan-store-block" style={{ '--store-color': info.color }}>
      <div className="plan-store-head">
        <span className="plan-store-name">{info.label}</span>
        <span className="muted">₹{subtotal.toFixed(2)}</span>
      </div>
      <ul className="plan-item-list muted">
        {items.map((i) => (
          <li key={i.id}>
            <a
              className="plan-item-link"
              href={i.deeplink || info.searchUrl(i.name)}
              target="_blank"
              rel="noreferrer"
            >
              {i.name} &middot; {i.packsNeeded > 1 ? `${i.packsNeeded}× ` : ''}
              {i.packSize} {i.packsNeeded > 1 ? `@ ₹${i.unitPrice} ` : ''}= ₹{i.price.toFixed(2)} ↗
            </a>
          </li>
        ))}
      </ul>
      <div className="plan-store-actions">
        <a className="open-store-btn" href={info.homeUrl} target="_blank" rel="noreferrer">
          Open {info.label} ↗
        </a>
        <button type="button" className="link" onClick={() => onOrderStore(store, items.map((i) => i.id))}>
          Mark ordered
        </button>
      </div>
    </div>
  );
}

export default function PlanSummary({
  plan,
  perStore = [],
  unchecked,
  unavailableEverywhere,
  items,
  onOrderStore,
  pickedStore,
  onPickStore,
}) {
  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]));

  const priced = perStore.filter((s) => s.availableCount > 0);
  const picked = pickedStore ? perStore.find((s) => s.store === pickedStore) : null;
  const missingNames = picked
    ? picked.missingItemIds.map((id) => itemsById[id]?.name).filter(Boolean)
    : [];

  return (
    <section className="plan-summary">
      <h2>{picked ? 'Your order' : 'Recommended order'}</h2>

      {picked ? (
        <div className="suggested-plan">
          <h3>
            {storeInfo(picked.store).label} only &middot; total ₹{picked.subtotal.toFixed(2)}
          </h3>
          <StoreBlock
            store={picked.store}
            items={picked.items}
            subtotal={picked.subtotal}
            onOrderStore={onOrderStore}
          />
          {missingNames.length > 0 && (
            <p className="plan-note warning">
              Not sold here: {missingNames.join(', ')} — you'll need a second app for those.
            </p>
          )}
          <button type="button" className="link" onClick={() => onPickStore(null)}>
            &larr; Back to the recommendation
          </button>
        </div>
      ) : plan.stores.length > 0 ? (
        <div className="suggested-plan">
          <h3>
            {plan.storesUsed} store{plan.storesUsed === 1 ? '' : 's'} &middot; total ₹{plan.totalCost.toFixed(2)}
          </h3>
          {plan.stores.map((storePlan) => (
            <StoreBlock
              key={storePlan.store}
              store={storePlan.store}
              items={storePlan.items}
              subtotal={storePlan.subtotal}
              onOrderStore={onOrderStore}
            />
          ))}
        </div>
      ) : (
        <p className="muted">Add a price for at least one item to get an order recommendation.</p>
      )}

      {priced.length > 1 && (
        <div className="store-picker">
          <h3>Or order everything from one app</h3>
          {perStore.map((s) => {
            const info = storeInfo(s.store);
            const covered = s.availableCount > 0;
            const isFull = covered && s.availableCount === s.totalCoverable;
            const isActive = pickedStore === s.store;
            // Only full-coverage stores are price-comparable to the plan; a
            // cheaper total that is missing items isn't actually cheaper.
            const diff = s.subtotal - plan.totalCost;

            return (
              <button
                key={s.store}
                type="button"
                className={`store-pick ${isActive ? 'active' : ''}`}
                style={{ '--store-color': info.color }}
                disabled={!covered}
                onClick={() => onPickStore(isActive ? null : s.store)}
              >
                <span className="store-pick-name">{info.label}</span>
                <span className="store-pick-cover muted">
                  {!covered
                    ? 'no prices yet'
                    : isFull
                      ? `all ${s.availableCount} item${s.availableCount === 1 ? '' : 's'}`
                      : `${s.availableCount} of ${s.totalCoverable} items`}
                </span>
                {covered && <span className="store-pick-price">₹{s.subtotal.toFixed(2)}</span>}
                {covered && (
                  <span className={`store-pick-delta ${isFull ? 'muted' : 'warning'}`}>
                    {!isFull
                      ? `missing ${s.missingItemIds.length}`
                      : Math.abs(diff) < 0.01
                        ? 'cheapest'
                        : `+₹${diff.toFixed(2)}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {unchecked.length > 0 && (
        <p className="plan-note muted">
          Still need a price check:{' '}
          {unchecked.map((id, idx) => (
            <span key={id}>
              {idx > 0 && ', '}
              <Link className="plan-note-link" to={`../list#item-${id}`}>{itemsById[id]?.name}</Link>
            </span>
          ))}
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
