import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function LivePricingPanel({ settings, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [latitude, setLatitude] = useState(settings.latitude ?? '');
  const [longitude, setLongitude] = useState(settings.longitude ?? '');
  const [pincode, setPincode] = useState(settings.pincode ?? '');
  const [locationLabel, setLocationLabel] = useState('');
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
    setError('');
    setLocationLabel('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        setLatitude(lat);
        setLongitude(lon);
        try {
          const geo = await api.reverseGeocode(lat, lon);
          if (geo.pincode) setPincode(geo.pincode);
          setLocationLabel(geo.displayName || '');
        } catch {
          setLocationLabel('Got your coordinates, but could not auto-detect a pincode - enter it manually if needed.');
        } finally {
          setLocating(false);
        }
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

          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={useMyLocation} disabled={locating}>
              {locating ? 'Locating...' : 'Use my current location'}
            </button>
            {locationLabel && <p className="muted small" style={{ marginTop: 6 }}>{locationLabel}</p>}
          </div>

          <p className="muted small" style={{ marginTop: 10 }}>
            Your flat's location - detected automatically above, or set it manually:
          </p>
          <div className="store-settings-row">
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
              <input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="auto-detected" />
            </label>
          </div>

          <button type="submit" disabled={busy} style={{ marginTop: 10 }}>Save</button>
        </form>
      )}
    </section>
  );
}
