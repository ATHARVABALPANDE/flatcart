import { useState } from 'react';
import { STORES, storeInfo } from '../stores.js';
import StoreOptions from './StoreOptions.jsx';
import { comparisonIssue, bestOption, desiredCount } from '../quantity.js';

export default function ItemRow({ item, onSaveListing, onClearListing, onToggleOrdered, onDelete, onRefreshPrice, liveConfigured }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [canForceRefresh, setCanForceRefresh] = useState(false);
  const isOrdered = item.status === 'ORDERED';
  const wantCount = desiredCount(item.quantity);

  const listingsByStore = Object.fromEntries(STORES.map((s) => [s.key, item.listings.filter((l) => l.store === s.key)]));
  const bestPerStore = STORES.map((s) => bestOption(listingsByStore[s.key].filter((l) => l.inStock), wantCount))
    .filter(Boolean)
    .map((b) => b.listing);
  const issue = !isOrdered ? comparisonIssue(bestPerStore) : null;

  async function handleRefresh(force) {
    setRefreshing(true);
    setRefreshMsg('');
    setCanForceRefresh(false);
    try {
      const result = await onRefreshPrice(item, force);
      if (result.skipped) {
        setRefreshMsg(result.reason);
        setCanForceRefresh(true);
        return;
      }
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
                <button className="link" disabled={refreshing} onClick={() => handleRefresh(false)}>
                  {refreshing ? 'Checking live prices...' : 'Refresh live price'}
                </button>
              )}
              <button className="link danger" onClick={() => onDelete(item)}>Remove</button>
            </>
          )}
        </div>
      </div>

      {refreshMsg && (
        <div className="item-meta muted">
          {refreshMsg}
          {canForceRefresh && (
            <>
              {' '}
              <button className="link" disabled={refreshing} onClick={() => handleRefresh(true)}>Refresh anyway</button>
            </>
          )}
        </div>
      )}
      {issue && <div className="item-meta warning">⚠ {issue}</div>}

      {!isOrdered && (
        <div className="listing-grid">
          {STORES.map((s) => (
            <StoreOptions
              key={s.key}
              store={s.key}
              listings={listingsByStore[s.key]}
              itemName={item.name}
              wantCount={wantCount}
              onSave={(data) => onSaveListing(item, s.key, data)}
              onClear={(packSize) => onClearListing(item, s.key, packSize)}
            />
          ))}
        </div>
      )}
    </li>
  );
}
