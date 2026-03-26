import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const AuthContext = createContext(null);
const TIMEOUT_MS = 15 * 60 * 1000;   // 15 min inactivity
const WARNING_MS = 2 * 60 * 1000;    // warn 2 min before logout

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('hp_token'));
  const [loading, setLoading] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_MS / 1000);
  const [isOverride, setIsOverride] = useState(!!localStorage.getItem('hp_admin_token'));

  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const countdownRef = useRef(null);

  const clearAllTimers = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearTimeout(warningRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const logout = useCallback(async (silent = false) => {
    if (!silent) {
      try { await api.post('/auth/logout'); } catch {}
    }
    localStorage.removeItem('hp_token');
    setToken(null);
    setUser(null);
    setShowWarning(false);
    clearAllTimers();
  }, [clearAllTimers]);

  const resetTimer = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    // Show warning 2 min before auto-logout
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(WARNING_MS / 1000);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);

    // Auto-logout after full timeout
    timeoutRef.current = setTimeout(() => {
      logout(true);
      window.location.href = '/login?reason=timeout';
    }, TIMEOUT_MS);
  }, [logout, clearAllTimers]);

  function stayLoggedIn() {
    resetTimer();
  }

  // Attach activity listeners
  useEffect(() => {
    if (!token) return;
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearAllTimers();
    };
  }, [token, resetTimer, clearAllTimers]);

  // Load user on mount
  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => logout(true))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  function login(newToken, userData) {
    localStorage.setItem('hp_token', newToken);
    setToken(newToken);
    setUser(userData);
  }

  function enterOverride(overrideToken, overrideUser) {
    // Save admin token so we can restore it later
    localStorage.setItem('hp_admin_token', localStorage.getItem('hp_token'));
    localStorage.setItem('hp_token', overrideToken);
    setToken(overrideToken);
    setUser(overrideUser);
    setIsOverride(true);
    resetTimer();
  }

  function exitOverride() {
    const adminToken = localStorage.getItem('hp_admin_token');
    localStorage.setItem('hp_token', adminToken);
    localStorage.removeItem('hp_admin_token');
    setToken(adminToken);
    setIsOverride(false);
    // Reload admin user from token
    api.get('/auth/me').then(res => setUser(res.data)).catch(() => {});
  }

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const countdownStr = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isOverride, enterOverride, exitOverride }}>
      {children}

      {showWarning && token && (
        <div style={overlay}>
          <div style={modal}>
            <div style={iconRow}>⏳</div>
            <h3 style={modalTitle}>Session Expiring Soon</h3>
            <p style={modalBody}>
              Your session will expire due to inactivity in
            </p>
            <div style={countdownBox}>{countdownStr}</div>
            <p style={modalBody}>Do you want to stay logged in?</p>
            <div style={btnRow}>
              <button onClick={stayLoggedIn} style={stayBtn}>Stay Logged In</button>
              <button onClick={() => { logout(false); window.location.href = '/login'; }} style={logoutBtn}>Log Out Now</button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999,
};
const modal = {
  background: 'white', borderRadius: '16px', padding: '2.5rem 2rem',
  maxWidth: '380px', width: '90%', textAlign: 'center',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};
const iconRow = { fontSize: '2.5rem', marginBottom: '0.75rem' };
const modalTitle = { color: '#1e293b', fontSize: '1.2rem', fontWeight: '700', marginBottom: '0.5rem' };
const modalBody = { color: '#64748b', fontSize: '0.9rem', marginBottom: '0.75rem' };
const countdownBox = {
  fontSize: '2.5rem', fontWeight: '800', color: '#dc2626',
  background: '#fef2f2', borderRadius: '12px', padding: '0.5rem 1.5rem',
  display: 'inline-block', marginBottom: '1rem', letterSpacing: '2px',
};
const btnRow = { display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' };
const stayBtn = {
  padding: '0.7rem 1.5rem', background: '#1e40af', color: 'white',
  border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem',
};
const logoutBtn = {
  padding: '0.7rem 1.25rem', background: 'white', color: '#dc2626',
  border: '1px solid #fecaca', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
};
