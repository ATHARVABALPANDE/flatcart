import { useState } from 'react';

export default function LivePricingPanel({ settings, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const hasLocation = settings.latitude != null && settings.longitude != null;

  async function save(e) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setError('');
    setBusy(true);
    try {
      await onUpdate({ apiKey: apiKey.trim() });
      setApiKey('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="store-settings-panel">
      <button className="link" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide live pricing settings' : `Live pricing: ${settings.configured ? 'configured' : 'not set up'}`}
      </button>
      {open && (
        <form className="store-settings-list" onSubmit={save}>
          <p className="muted small">
            Uses <strong>quickcommerceapi.com</strong> - a third-party paid API (not official Blinkit/Zepto/etc
            data), 100 free credits to start. Sign up there to get an API key.
          </p>
          {error && <p className="error">{error}</p>}

          <label className="muted small" style={{ display: 'block', marginTop: 10 }}>
            API key {settings.configured && '(already set - leave blank to keep it)'}
          </label>
          <input
            type="password"
            placeholder={settings.configured ? '••••••••' : 'paste your API key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
          />

          <p className="muted small" style={{ marginTop: 10 }}>
            {hasLocation
              ? 'Prices are checked against the delivery location set in household settings.'
              : 'Set a delivery location in household settings too — without one, prices cannot be checked.'}
          </p>

          <button type="submit" disabled={busy || !apiKey.trim()} style={{ marginTop: 10 }}>
            {busy ? 'Saving...' : 'Save API key'}
          </button>
        </form>
      )}
    </section>
  );
}
