import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const timedOut = searchParams.get('reason') === 'timeout';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      navigate(res.data.user.mustChangePassword ? '/change-password' : '/welcome');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🏥</div>
        <h1 style={styles.title}>Healthcare Portal</h1>
        <p style={styles.subtitle}>Secure Staff Login</p>

        {timedOut && (
          <div style={styles.warnBox}>
            Your session expired due to inactivity. Please log in again.
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="staff@hospital.com"
              required
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>
          {error && <div style={styles.errorBox}>{error}</div>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={styles.hipaa}>🔒 HIPAA Compliant — All access is logged and monitored</p>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' },
  card: { background: 'white', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', width: '100%', maxWidth: '420px', textAlign: 'center' },
  logo: { fontSize: '2.5rem', marginBottom: '0.5rem' },
  title: { color: '#1e293b', fontSize: '1.6rem', marginBottom: '0.25rem' },
  subtitle: { color: '#64748b', marginBottom: '2rem', fontSize: '0.9rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' },
  label: { fontWeight: '600', color: '#374151', fontSize: '0.875rem', display: 'block', marginBottom: '0.4rem' },
  input: { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem' },
  button: { padding: '0.85rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', marginTop: '0.25rem' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem' },
  warnBox: { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem' },
  hipaa: { color: '#94a3b8', fontSize: '0.75rem', marginTop: '1.5rem' },
};
