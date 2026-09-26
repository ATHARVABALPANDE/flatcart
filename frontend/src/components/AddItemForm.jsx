import { useState } from 'react';

export default function AddItemForm({ onAdd }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onAdd({ name: name.trim(), quantity: quantity.trim() || '1', note: note.trim() || undefined });
      setName('');
      setQuantity('');
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
        placeholder="1, 2 L, 500 g"
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
