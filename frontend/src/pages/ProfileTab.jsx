import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function ProfileTab() {
  const { household } = useOutletContext();
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  async function saveName(e) {
    e.preventDefault();
    setError('');
    setNameMsg('');
    setSavingName(true);
    try {
      await api.updateProfile({ name });
      await refreshUser();
      setNameMsg('Saved');
      setTimeout(() => setNameMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setError('');
    setPasswordMsg('');
    setSavingPassword(true);
    try {
      await api.updateProfile({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMsg('Password changed');
      setTimeout(() => setPasswordMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPassword(false);
    }
  }

  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : null;

  return (
    <section className="cart-section">
      <h2>Your profile</h2>
      {error && <p className="error">{error}</p>}

      <div className="household-card">
        <h3>Account</h3>
        <p className="muted small">
          {user?.email}
          {memberSince && ` · joined ${memberSince}`}
        </p>

        <form onSubmit={saveName} className="profile-form">
          <label className="field">
            Display name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <p className="muted small">This is the name your flatmates see on items you add.</p>
          <button type="submit" disabled={savingName || !name.trim() || name === user?.name}>
            {savingName ? 'Saving...' : nameMsg || 'Save name'}
          </button>
        </form>
      </div>

      <div className="household-card">
        <h3>Change password</h3>
        <form onSubmit={savePassword} className="profile-form">
          <label className="field">
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label className="field">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          <p className="muted small">At least 6 characters.</p>
          <button type="submit" disabled={savingPassword || !currentPassword || newPassword.length < 6}>
            {savingPassword ? 'Saving...' : passwordMsg || 'Change password'}
          </button>
        </form>
      </div>

      <div className="household-card">
        <h3>This household</h3>
        <p className="muted small">
          You're in <strong>{household?.name}</strong> with {(household?.members.length ?? 1) - 1} other flatmate
          {(household?.members.length ?? 1) - 1 === 1 ? '' : 's'}.
        </p>
        <button type="button" className="link" onClick={() => navigate('/')}>
          Switch household
        </button>
      </div>

      <div className="household-card">
        <button type="button" className="danger-btn" onClick={logout}>Log out</button>
      </div>
    </section>
  );
}
