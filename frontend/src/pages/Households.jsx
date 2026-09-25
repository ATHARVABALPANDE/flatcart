import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function Households() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.myHouseholds();
      setHouseholds(data.households);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.createHousehold(newName);
      navigate(`/household/${data.household.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.joinHousehold(joinCode);
      navigate(`/household/${data.household.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>FlatCart</h1>
        <div>
          <span className="muted">{user?.name}</span>
          <button className="link" onClick={logout}>Log out</button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {!loading && households.length > 0 && (
        <section className="card">
          <h2>Your households</h2>
          <ul className="household-list">
            {households.map((h) => (
              <li key={h.id}>
                <button className="household-item" onClick={() => navigate(`/household/${h.id}`)}>
                  {h.name} <span className="muted">#{h.inviteCode}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Create a household</h2>
        <form onSubmit={onCreate} className="inline-form">
          <input placeholder="e.g. 42 Baker Street" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <button type="submit" disabled={busy}>Create</button>
        </form>
      </section>

      <section className="card">
        <h2>Join a household</h2>
        <form onSubmit={onJoin} className="inline-form">
          <input placeholder="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} required />
          <button type="submit" disabled={busy}>Join</button>
        </form>
      </section>
    </div>
  );
}
