import { useState } from 'react';
import { storeInfo } from '../stores.js';

export default function ListingCell({ store, listing, onSave, onClear }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(listing ? String(listing.price) : '');
  const [busy, setBusy] = useState(false);
  const info = storeInfo(store);

  async function saveInStock(e) {
    e.preventDefault();
    const value = parseFloat(price);
    if (isNaN(value) || value < 0) return;
    setBusy(true);
    try {
      await onSave({ price: value, inStock: true });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function saveOutOfStock() {
    setBusy(true);
    try {
      await onSave({ price: 0, inStock: false });
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
        <div className="listing-cell-actions">
          <button type="submit" disabled={busy || !price}>Save</button>
          <button type="button" className="link" disabled={busy} onClick={saveOutOfStock}>Out of stock</button>
          {listing && <button type="button" className="link" disabled={busy} onClick={clear}>Clear</button>}
          <button type="button" className="link" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <button type="button" className="listing-cell" style={{ '--store-color': info.color }} onClick={() => setEditing(true)}>
      <span className="listing-store-label">{info.label}</span>
      {!listing && <span className="listing-unknown">add price</span>}
      {listing && listing.inStock && <span className="listing-price">₹{listing.price}</span>}
      {listing && !listing.inStock && <span className="listing-oos">out of stock</span>}
    </button>
  );
}
