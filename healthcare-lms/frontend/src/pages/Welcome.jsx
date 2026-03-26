import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const roleIcons = {
  nurse: '👩‍⚕️',
  cardiopulmonary: '🫀',
  doctor: '🩺',
  admin: '🛡️',
};

export default function Welcome() {
  const { user } = useAuth();
  const [roleConfig, setRoleConfig] = useState(null);
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    api.get('/auth/me').then(res => setRoleConfig(res.data.roleConfig)).catch(() => {});
  }, []);

  const roleColor = roleConfig?.color || '#1e40af';
  const icon = roleIcons[user?.role] || '👤';

  const daysUntilExpiry = user?.daysUntilExpiry;
  const showExpiryWarning = typeof daysUntilExpiry === 'number' && daysUntilExpiry <= 14 && daysUntilExpiry > 0;

  return (
    <div style={styles.page}>
      {showExpiryWarning && (
        <div style={styles.expiryBanner}>
          ⚠️ Your password expires in <strong>{daysUntilExpiry} day{daysUntilExpiry === 1 ? '' : 's'}</strong>. Please <a href="/change-password" style={styles.expiryLink}>change it now</a> to avoid being locked out.
        </div>
      )}
      <div style={{ ...styles.card, borderTop: `6px solid ${roleColor}` }}>
        <div style={styles.icon}>{icon}</div>

        <h1 style={styles.greeting}>
          {roleConfig?.welcomeMessage || `Welcome, ${user?.name}`}
        </h1>

        <p style={styles.name}>{user?.name}</p>

        <div style={{ ...styles.roleBadge, background: roleColor }}>
          {roleConfig?.label || user?.role}
        </div>

        <div style={styles.divider} />

        <div style={styles.info}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Date</span>
            <span style={styles.infoValue}>{dateStr}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Time</span>
            <span style={styles.infoValue}>{timeStr}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Email</span>
            <span style={styles.infoValue}>{user?.email}</span>
          </div>
        </div>

        {roleConfig?.permissions?.length > 0 && (
          <div style={styles.permissions}>
            <p style={styles.permLabel}>Your Access</p>
            <div style={styles.permList}>
              {roleConfig.permissions.map(p => (
                <span key={p} style={{ ...styles.permBadge, borderColor: roleColor, color: roleColor }}>
                  {p.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        <p style={styles.hipaa}>🔒 This session is monitored in accordance with HIPAA regulations.<br />Session will expire after 15 minutes of inactivity.</p>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: 'calc(100vh - 60px)' },
  card: { background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', padding: '3rem 2.5rem', maxWidth: '560px', width: '100%', textAlign: 'center', marginTop: '2rem' },
  icon: { fontSize: '3.5rem', marginBottom: '1rem' },
  greeting: { color: '#1e293b', fontSize: '1.4rem', fontWeight: '600', marginBottom: '0.5rem', lineHeight: '1.5' },
  name: { color: '#64748b', fontSize: '1rem', marginBottom: '1rem' },
  roleBadge: { display: 'inline-block', color: 'white', padding: '0.35rem 1.25rem', borderRadius: '999px', fontWeight: '700', fontSize: '0.875rem', marginBottom: '1.5rem', textTransform: 'capitalize' },
  divider: { height: '1px', background: '#e2e8f0', margin: '1.5rem 0' },
  info: { display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', marginBottom: '1.5rem' },
  infoItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' },
  infoValue: { color: '#334155', fontSize: '0.9rem', fontWeight: '500' },
  permissions: { background: '#f8fafc', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' },
  permLabel: { color: '#64748b', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.75rem' },
  permList: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  permBadge: { padding: '0.25rem 0.75rem', borderRadius: '999px', border: '1px solid', fontSize: '0.75rem', fontWeight: '500', textTransform: 'capitalize' },
  hipaa: { color: '#94a3b8', fontSize: '0.75rem', lineHeight: '1.6' },
  expiryBanner: { background: '#fffbeb', border: '1px solid #fbbf24', color: '#92400e', padding: '0.85rem 1.25rem', borderRadius: '10px', fontSize: '0.875rem', marginBottom: '1rem', maxWidth: '560px', width: '100%', lineHeight: '1.6' },
  expiryLink: { color: '#b45309', fontWeight: '600' },
};
