import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api.js';
import LivePricingPanel from '../components/LivePricingPanel.jsx';

export default function FlatTab() {
  const {
    household,
    user,
    livePricing,
    onUpdateLivePricing,
    onLeave,
    onDeleteHousehold,
  } = useOutletContext();

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [pincode, setPincode] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [accuracy, setAccuracy] = useState(null);
  const [locating, setLocating] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [showDanger, setShowDanger] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!livePricing) return;
    setLatitude(livePricing.latitude ?? '');
    setLongitude(livePricing.longitude ?? '');
    setPincode(livePricing.pincode ?? '');
  }, [livePricing]);

  if (!household || !livePricing) return <p className="muted">Loading...</p>;

  const isCreator = household.createdById === user?.id;
  const hasLocation = livePricing.latitude != null && livePricing.longitude != null;

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('This browser cannot detect location — enter the coordinates manually.');
      return;
    }
    setError('');
    setLocationLabel('');
    setAccuracy(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setAccuracy(Math.round(pos.coords.accuracy));
        try {
          const geo = await api.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (geo.pincode) setPincode(geo.pincode);
          setLocationLabel(geo.displayName || '');
        } catch {
          setLocationLabel('Got the coordinates, but could not look up an address — add the pincode yourself if you know it.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was blocked. Allow it for this site in your browser, or type the coordinates in below.'
            : `Could not get your location: ${err.message}`
        );
        setLocating(false);
      },
      // Quick-commerce prices and delivery areas are street-level, so the
      // low-accuracy default (which can be off by kilometres on desktop) isn't
      // good enough. The timeout stops it hanging on a fix that never arrives.
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  async function saveLocation(e) {
    e.preventDefault();
    setError('');
    setSavingLocation(true);
    setLocationSaved(false);
    try {
      await onUpdateLivePricing({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        pincode: pincode || undefined,
      });
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingLocation(false);
    }
  }

  function copyInvite() {
    navigator.clipboard?.writeText(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function run(fn) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="cart-section">
      <h2>{household.name}</h2>
      {error && <p className="error">{error}</p>}

      <div className="household-card">
        <h3>Members</h3>
        <ul className="member-list">
          {household.members.map((m) => (
            <li key={m.id} className="member-row">
              <span className="member-name">
                {m.name}
                {m.id === user?.id && <span className="member-tag">you</span>}
                {m.id === household.createdById && <span className="member-tag creator">created this</span>}
              </span>
              <span className="muted small">{m.email}</span>
            </li>
          ))}
        </ul>

        <h3>Invite a flatmate</h3>
        <p className="muted small">Share this code — they enter it under &ldquo;Join a household&rdquo;.</p>
        <div className="invite-row">
          <code className="invite-code-box">{household.inviteCode}</code>
          <button type="button" onClick={copyInvite}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>

      <div className="household-card">
        <h3>Delivery location</h3>
        <p className="muted small">
          {hasLocation
            ? 'Live prices and delivery times are checked against this spot.'
            : 'Set this so live prices are checked against your flat, not a default.'}
        </p>
        <form onSubmit={saveLocation}>
          <div className="location-actions">
            <button type="button" onClick={useMyLocation} disabled={locating}>
              {locating ? 'Locating...' : 'Use my current location'}
            </button>
            {accuracy != null && (
              <span className="muted small">
                accurate to about {accuracy} m{accuracy > 100 ? ' — move near a window or use your phone for a better fix' : ''}
              </span>
            )}
          </div>
          {locationLabel && <p className="muted small location-label">{locationLabel}</p>}

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
              <input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="auto-filled" />
            </label>
          </div>
          <button type="submit" disabled={savingLocation}>
            {savingLocation ? 'Saving...' : locationSaved ? 'Saved' : 'Save location'}
          </button>
        </form>
      </div>

      <LivePricingPanel settings={livePricing} onUpdate={onUpdateLivePricing} />

      <div className="household-card">
        <h3 className="danger-heading">Leaving this household</h3>
        {showDanger ? (
          <div className="danger-zone">
            <p className="muted small">
              Leaving removes you from the shared list.{' '}
              {isCreator ? 'Since you created it, it passes to whoever joined next.' : 'Everyone else keeps it.'}
            </p>
            <button type="button" className="danger-btn" disabled={busy} onClick={() => run(onLeave)}>
              Leave household
            </button>

            {isCreator && (
              <>
                <p className="muted small delete-warning">
                  Or delete it for everyone — the list, prices and order history all go, for all{' '}
                  {household.members.length} of you. This cannot be undone. Type{' '}
                  <strong>{household.name}</strong> to confirm.
                </p>
                <div className="invite-row">
                  <input
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={household.name}
                    aria-label="Type the household name to confirm deletion"
                  />
                  <button
                    type="button"
                    className="danger-btn"
                    disabled={busy || confirmName !== household.name}
                    onClick={() => run(() => onDeleteHousehold(confirmName))}
                  >
                    Delete for everyone
                  </button>
                </div>
              </>
            )}
            <button type="button" className="link" onClick={() => setShowDanger(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="link danger" onClick={() => setShowDanger(true)}>
            Leave or delete this household
          </button>
        )}
      </div>
    </section>
  );
}
