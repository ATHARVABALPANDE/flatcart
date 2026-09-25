import { useState } from 'react';
import { storeInfo } from '../stores.js';

export default function StoreSettingsPanel({ storeSettings, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(null);

  function draftFor(store, field, fallback) {
    return drafts[store]?.[field] ?? fallback;
  }

  function setDraft(store, field, value) {
    setDrafts((d) => ({ ...d, [store]: { ...d[store], [field]: value } }));
  }

  async function save(store) {
    const setting = storeSettings.find((s) => s.store === store);
    const deliveryFee = parseFloat(draftFor(store, 'deliveryFee', setting.deliveryFee));
    const freeDeliveryThreshold = parseFloat(draftFor(store, 'freeDeliveryThreshold', setting.freeDeliveryThreshold));
    if (isNaN(deliveryFee) || isNaN(freeDeliveryThreshold)) return;
    setBusy(store);
    try {
      await onUpdate(store, { deliveryFee, freeDeliveryThreshold });
      setDrafts((d) => ({ ...d, [store]: {} }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="store-settings-panel">
      <button className="link" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide delivery fee settings' : 'Edit delivery fee settings'}
      </button>
      {open && (
        <div className="store-settings-list">
          <p className="muted small">
            These vary by city and change often — update them when a store's policy changes.
          </p>
          {storeSettings.map((s) => {
            const info = storeInfo(s.store);
            return (
              <div className="store-settings-row" key={s.store}>
                <span className="store-settings-name" style={{ '--store-color': info.color }}>{info.label}</span>
                <label>
                  Delivery fee ₹
                  <input
                    type="number"
                    min="0"
                    value={draftFor(s.store, 'deliveryFee', s.deliveryFee)}
                    onChange={(e) => setDraft(s.store, 'deliveryFee', e.target.value)}
                  />
                </label>
                <label>
                  Free above ₹
                  <input
                    type="number"
                    min="0"
                    value={draftFor(s.store, 'freeDeliveryThreshold', s.freeDeliveryThreshold)}
                    onChange={(e) => setDraft(s.store, 'freeDeliveryThreshold', e.target.value)}
                  />
                </label>
                <button disabled={busy === s.store} onClick={() => save(s.store)}>Save</button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
