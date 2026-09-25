import { storeInfo } from '../stores.js';

export default function ItemRow({ item, onToggleOrdered, onDelete }) {
  const store = storeInfo(item.store);
  const isOrdered = item.status === 'ORDERED';

  return (
    <li className={`item-row ${isOrdered ? 'ordered' : ''}`}>
      <label className="item-check">
        <input type="checkbox" checked={isOrdered} onChange={() => onToggleOrdered(item)} />
        <div className="item-main">
          <span className="item-name">{item.name}</span>
          <span className="item-qty">x{item.quantity}</span>
        </div>
      </label>

      {item.note && <span className="item-note">{item.note}</span>}

      <span className="item-meta muted">
        added by {item.addedBy?.name}
        {isOrdered && item.orderedBy && ` · ordered by ${item.orderedBy.name}`}
      </span>

      <div className="item-actions">
        {store.searchUrl && (
          <a
            className="deep-link"
            href={store.searchUrl(item.name)}
            target="_blank"
            rel="noreferrer"
          >
            Open in {store.label}
          </a>
        )}
        <button className="link danger" onClick={() => onDelete(item)}>Remove</button>
      </div>
    </li>
  );
}
