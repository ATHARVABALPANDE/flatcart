import { useState } from 'react';
import { STORES, storeInfo } from '../stores.js';
import ListingCell from './ListingCell.jsx';

export default function ItemRow({ item, onSaveListing, onClearListing, onToggleOrdered, onDelete, onRefreshPrice, liveConfigured }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const isOrdered = item.status === 'ORDERED';
  const listingByStore = Object.fromEntries(item.listings.map((l) => [l.store, l]));

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg('');
    try {
      const result = await onRefreshPrice(item);
      const updatedLabels = result.updated.map((u) => storeInfo(u.store).label);
      const notFoundLabels = result.notFound.map((s) => storeInfo(s).label);
      let msg = updatedLabels.length ? `Updated: ${updatedLabels.join(', ')}` : 'No matches found';
      if (notFoundLabels.length) msg += ` · not found: ${notFoundLabels.join(', ')}`;
      setRefreshMsg(msg);
    } catch (err) {
      setRefreshMsg(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <li className={`item-row ${isOrdered ? 'ordered' : ''}`}>
      <div className="item-top">
        <div className="item-main">
          <span className="item-name">{item.name}</span>
          <span className="item-qty">x{item.quantity}</span>
          {item.note && <span className="item-note">{item.note}</span>}
        </div>
        <span className="item-meta muted">
          added by {item.addedBy?.name}
          {isOrdered && (
            <>
              {' '}· ordered from {storeInfo(item.orderedStore)?.label || item.orderedStore} by {item.orderedBy?.name}
            </>
          )}
        </span>
        <div className="item-actions">
          {isOrdered ? (
            <button className="link" onClick={() => onToggleOrdered(item)}>Mark pending</button>
          ) : (
            <>
              {liveConfigured && (
                <button className="link" disabled={refreshing} onClick={handleRefresh}>
                  {refreshing ? 'Checking live prices...' : 'Refresh live price'}
                </button>
              )}
              <button className="link danger" onClick={() => onDelete(item)}>Remove</button>
            </>
          )}
        </div>
      </div>

      {refreshMsg && <div className="item-meta muted">{refreshMsg}</div>}

      {!isOrdered && (
        <div className="listing-grid">
          {STORES.map((s) => (
            <ListingCell
              key={s.key}
              store={s.key}
              listing={listingByStore[s.key]}
              onSave={(data) => onSaveListing(item, s.key, data)}
              onClear={() => onClearListing(item, s.key)}
            />
          ))}
        </div>
      )}
    </li>
  );
}
