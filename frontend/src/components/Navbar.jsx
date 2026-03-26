import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isOverride, exitOverride } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function handleExitOverride() {
    exitOverride();
    navigate('/admin');
  }

  const roleColors = {
    admin: '#dc2626', doctor: '#059669',
    nurse: '#0891b2', cardiopulmonary: '#7c3aed',
  };
  const color = roleColors[user?.role] || '#64748b';

  return (
    <>
      {isOverride && (
        <div style={styles.overrideBanner}>
          <span style={styles.overrideIcon}>⚠️</span>
          <span style={styles.overrideText}>
            <strong>EMERGENCY OVERRIDE ACTIVE</strong> — Viewing as&nbsp;
            <strong>{user?.name}</strong> ({user?.role})
            {user?.impersonatedBy && <> · Override by <strong>{user.impersonatedBy}</strong></>}
          </span>
          <button onClick={handleExitOverride} style={styles.exitBtn}>
            Exit Override
          </button>
        </div>
      )}

      <nav style={styles.nav}>
        <span style={styles.brand}>🏥 Healthcare Portal</span>
        <div style={styles.links}>
          <Link to="/welcome" style={{ ...styles.link, ...(location.pathname === '/welcome' ? styles.active : {}) }}>
            Home
          </Link>
          {user?.role !== 'admin' && (
            <Link to="/my-courses" style={{ ...styles.link, ...(location.pathname.startsWith('/my-courses') ? styles.active : {}) }}>
              My Courses
            </Link>
          )}
        {user?.role === 'admin' && !isOverride && (
            <Link to="/admin" style={{ ...styles.link, ...(location.pathname === '/admin' ? styles.active : {}) }}>
              Admin Panel
            </Link>
          )}
        </div>
        <div style={styles.right}>
          <span style={{ ...styles.badge, background: color }}>{user?.role}</span>
          <span style={styles.name}>{user?.name}</span>
          {!isOverride && (
            <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
          )}
        </div>
      </nav>
    </>
  );
}

const styles = {
  overrideBanner: {
    background: '#dc2626', color: 'white',
    padding: '0.5rem 2rem', display: 'flex', alignItems: 'center',
    gap: '0.75rem', fontSize: '0.875rem', flexWrap: 'wrap',
  },
  overrideIcon: { fontSize: '1rem' },
  overrideText: { flex: 1 },
  exitBtn: {
    padding: '0.3rem 0.85rem', background: 'white', color: '#dc2626',
    border: 'none', borderRadius: '6px', fontWeight: '700',
    cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap',
  },
  nav: { background: '#1e293b', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px', position: 'sticky', top: 0, zIndex: 100 },
  brand: { color: 'white', fontWeight: '700', fontSize: '1rem' },
  links: { display: 'flex', gap: '0.25rem' },
  link: { color: '#94a3b8', textDecoration: 'none', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.9rem' },
  active: { color: 'white', background: '#334155' },
  right: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  badge: { padding: '0.2rem 0.65rem', borderRadius: '999px', color: 'white', fontSize: '0.75rem', fontWeight: '600', textTransform: 'capitalize' },
  name: { color: '#cbd5e1', fontSize: '0.875rem' },
  logoutBtn: { padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' },
};
