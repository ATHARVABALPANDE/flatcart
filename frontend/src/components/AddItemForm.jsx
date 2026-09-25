import { useState } from 'react';

export default function AddItemForm({ store, onAdd }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onAdd({ name: name.trim(), quantity: quantity.trim() || '1', note: note.trim() || undefined, store });
      setName('');
      setQuantity('1');
      setNote('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add-item-form" onSubmit={onSubmit}>
      <input
        className="add-item-name"
        placeholder="Add an item..."
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="add-item-qty"
        placeholder="Qty"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <input
        className="add-item-note"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button type="submit" disabled={busy || !name.trim()}>Add</button>
    </form>
  );
}
