import { useState } from 'react';
import { storeInfo } from '../stores.js';
import { pricePerUnit } from '../quantity.js';

export default function ListingCell({ store, listing, onSave, onClear }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(listing ? String(listing.price) : '');
  const [packSize, setPackSize] = useState(listing?.packSize || '');
  const [busy, setBusy] = useState(false);
  const info = storeInfo(store);

  async function saveInStock(e) {
    e.preventDefault();
    const value = parseFloat(price);
    if (isNaN(value) || value < 0) return;
    setBusy(true);
    try {
      await onSave({ price: value, inStock: true, packSize: packSize.trim() || undefined });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function saveOutOfStock() {
    setBusy(true);
    try {
      await onSave({ price: 0, inStock: false, packSize: packSize.trim() || undefined });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await onClear();
      setPrice('');
      setPackSize('');
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form className="listing-cell editing" onSubmit={saveInStock}>
        <span className="listing-store-label" style={{ '--store-color': info.color }}>{info.label}</span>
        <input
          autoFocus
          type="number"
          min="0"
          step="0.01"
          placeholder="₹ price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <input
          placeholder="pack size e.g. 1 pc, 500 ml"
          value={packSize}
          onChange={(e) => setPackSize(e.target.value)}
        />
        <div className="listing-cell-actions">
          <button type="submit" disabled={busy || !price}>Save</button>
          <button type="button" className="link" disabled={busy} onClick={saveOutOfStock}>Out of stock</button>
          {listing && <button type="button" className="link" disabled={busy} onClick={clear}>Clear</button>}
          <button type="button" className="link" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    );
  }

  const perUnit = listing?.inStock ? pricePerUnit(listing.price, listing.packSize) : null;

  return (
    <button type="button" className="listing-cell" style={{ '--store-color': info.color }} onClick={() => setEditing(true)}>
      <span className="listing-store-label">
        {info.label}
        {listing?.source === 'LIVE_API' && <span title="Fetched via live pricing"> ⚡</span>}
      </span>
      {!listing && <span className="listing-unknown">add price</span>}
      {listing && listing.inStock && <span className="listing-price">₹{listing.price}</span>}
      {listing && !listing.inStock && <span className="listing-oos">out of stock</span>}
      {listing?.packSize && <span className="listing-packsize">{listing.packSize}</span>}
      {perUnit && <span className="listing-perunit">≈ ₹{perUnit.value.toFixed(2)}/{perUnit.unit}</span>}
      {listing?.eta && <span className="listing-eta">{listing.eta}</span>}
    </button>
  );
}
