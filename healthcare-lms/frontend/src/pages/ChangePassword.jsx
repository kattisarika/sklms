import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPass !== confirm) return setError('Passwords do not match');

    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: newPass });
      // Refresh token
      const res = await api.post('/auth/login', { email: user.email, password: newPass });
      login(res.data.token, res.data.user);
      navigate('/welcome');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🔑</div>
        <h2 style={styles.title}>Change Your Password</h2>
        {user?.passwordExpired ? (
          <div style={styles.expiredBanner}>
            ⚠️ Your password has expired. You must set a new password to continue.
          </div>
        ) : (
          <p style={styles.subtitle}>You must change your password before continuing.</p>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div>
            <label style={styles.label}>Current Password</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>New Password</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required style={styles.input} />
            <p style={styles.hint}>Min 8 chars · 1 uppercase · 1 number · 1 special character (!@#$%^&*)</p>
          </div>
          <div>
            <label style={styles.label}>Confirm New Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={styles.input} />
          </div>
          {error && <div style={styles.errorBox}>{error}</div>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' },
  card: { background: 'white', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: '420px', textAlign: 'center' },
  icon: { fontSize: '2.5rem', marginBottom: '0.5rem' },
  title: { color: '#1e293b', marginBottom: '0.5rem' },
  subtitle: { color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' },
  label: { fontWeight: '600', color: '#374151', fontSize: '0.875rem', display: 'block', marginBottom: '0.4rem' },
  input: { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' },
  hint: { color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem' },
  button: { padding: '0.85rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem' },
  expiredBanner: { background: '#fffbeb', border: '1px solid #fbbf24', color: '#92400e', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.5' },
};
