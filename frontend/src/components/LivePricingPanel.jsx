import { useEffect, useState } from 'react';

export default function LivePricingPanel({ settings, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [latitude, setLatitude] = useState(settings.latitude ?? '');
  const [longitude, setLongitude] = useState(settings.longitude ?? '');
  const [pincode, setPincode] = useState(settings.pincode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setLatitude(settings.latitude ?? '');
    setLongitude(settings.longitude ?? '');
    setPincode(settings.pincode ?? '');
  }, [settings.latitude, settings.longitude, settings.pincode]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Your browser does not support geolocation - enter lat/long manually.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setError(`Could not get your location: ${err.message}`);
        setLocating(false);
      }
    );
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const patch = { latitude: parseFloat(latitude), longitude: parseFloat(longitude), pincode: pincode || undefined };
      if (apiKey.trim()) patch.apiKey = apiKey.trim();
      await onUpdate(patch);
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

          <div className="store-settings-row" style={{ marginTop: 10 }}>
            <label>
              Latitude
              <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} required />
            </label>
            <label>
              Longitude
              <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} required />
            </label>
            <label>
              Pincode
              <input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="optional" />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={useMyLocation} disabled={locating}>
              {locating ? 'Locating...' : 'Use my current location'}
            </button>
            <button type="submit" disabled={busy}>Save</button>
          </div>
        </form>
      )}
    </section>
  );
}
