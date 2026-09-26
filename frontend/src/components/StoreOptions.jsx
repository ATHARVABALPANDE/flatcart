import { useState } from 'react';
import { storeInfo } from '../stores.js';
import { formatPerUnit, packUnits, bestOption } from '../quantity.js';

function OptionForm({ initial, busy, onSubmit, onOutOfStock, onDelete, onCancel, showDelete }) {
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '');
  const [packSize, setPackSize] = useState(initial?.packSize || '');
  const [matchedName, setMatchedName] = useState(initial?.matchedName || '');

  function submit(e) {
    e.preventDefault();
    const value = parseFloat(price);
    if (isNaN(value) || value < 0) return;
    onSubmit({ price: value, inStock: true, packSize: packSize.trim() || undefined, matchedName: matchedName.trim() || undefined });
  }

  return (
    <form className="option-form" onSubmit={submit}>
      <input autoFocus type="number" min="0" step="0.01" placeholder="₹ price" value={price} onChange={(e) => setPrice(e.target.value)} />
      <input placeholder="pack size e.g. 1 pc, 3 pcs, 500 ml" value={packSize} onChange={(e) => setPackSize(e.target.value)} />
      <input placeholder="product name you see (optional)" value={matchedName} onChange={(e) => setMatchedName(e.target.value)} />
      <div className="option-form-actions">
        <button type="submit" disabled={busy || !price}>Save</button>
        <button type="button" className="link" disabled={busy} onClick={() => onOutOfStock(packSize.trim() || undefined)}>Out of stock</button>
        {showDelete && <button type="button" className="link" disabled={busy} onClick={onDelete}>Remove</button>}
        <button type="button" className="link" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function StoreOptions({ store, listings, itemName, wantCount, onSave, onClear }) {
  const [editingKey, setEditingKey] = useState(null); // packSize of listing being edited, or '__new__'
  const [busy, setBusy] = useState(false);
  const info = storeInfo(store);
  const inStockListings = listings.filter((l) => l.inStock);
  const best = inStockListings.length ? bestOption(inStockListings, wantCount) : null;

  async function handleSave(data) {
    setBusy(true);
    try {
      await onSave(data);
      setEditingKey(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleOutOfStock(packSize) {
    setBusy(true);
    try {
      await onSave({ price: 0, inStock: false, packSize });
      setEditingKey(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(packSize) {
    setBusy(true);
    try {
      await onClear(packSize);
      setEditingKey(null);
    } finally {
      setBusy(false);
    }
  }

  const verifyUrl = best?.listing.deeplink || (info.searchUrl ? info.searchUrl(itemName) : null);

  return (
    <div className="store-options" style={{ '--store-color': info.color }}>
      <div className="store-options-head">
        <span className="listing-store-label">{info.label}</span>
        {verifyUrl && (
          <a className="listing-verify" href={verifyUrl} target="_blank" rel="noreferrer" title={`Verify on ${info.label}`} onClick={(e) => e.stopPropagation()}>↗</a>
        )}
      </div>

      {listings.length === 0 && editingKey !== '__new__' && (
        <button type="button" className="link add-option-link" onClick={() => setEditingKey('__new__')}>add price</button>
      )}

      {listings.map((listing) => {
        const isBest = best && best.listing === listing;
        const units = packUnits(listing.packSize);
        const packsNeeded = Math.ceil(wantCount / units);
        const totalForQty = packsNeeded * listing.price;
        const perUnit = listing.inStock ? formatPerUnit(listing.price, listing.packSize) : null;

        if (editingKey === listing.packSize) {
          return (
            <OptionForm
              key={listing.packSize}
              initial={listing}
              busy={busy}
              showDelete
              onSubmit={handleSave}
              onOutOfStock={() => handleOutOfStock(listing.packSize)}
              onDelete={() => handleDelete(listing.packSize)}
              onCancel={() => setEditingKey(null)}
            />
          );
        }

        const qtyLine = listing.inStock && wantCount > 1 ? `${packsNeeded}× = ₹${totalForQty.toFixed(2)} for ${wantCount}` : null;
        const detailLine = [qtyLine, perUnit].filter(Boolean).join(' · ');
        const noteLine = [listing.matchedName, listing.eta].filter(Boolean).join(' · ');

        return (
          <div key={listing.packSize} className={`option-row ${isBest ? 'best' : ''}`} onClick={() => setEditingKey(listing.packSize)}>
            <div className="option-row-main">
              <span className="option-packsize">{listing.packSize}</span>
              {listing.inStock ? <span className="listing-price">₹{listing.price}</span> : <span className="listing-oos">out of stock</span>}
              {isBest && wantCount > 1 && <span className="best-badge">best for x{wantCount}</span>}
            </div>
            {detailLine && <div className="option-row-sub muted">{detailLine}</div>}
            {noteLine && <div className="option-row-sub muted listing-matchedname" title={noteLine}>{noteLine}</div>}
          </div>
        );
      })}

      {editingKey === '__new__' ? (
        <OptionForm
          busy={busy}
          onSubmit={handleSave}
          onOutOfStock={handleOutOfStock}
          onCancel={() => setEditingKey(null)}
        />
      ) : (
        listings.length > 0 && (
          <button type="button" className="link add-option-link" onClick={() => setEditingKey('__new__')}>+ add pack size</button>
        )
      )}
    </div>
  );
}
