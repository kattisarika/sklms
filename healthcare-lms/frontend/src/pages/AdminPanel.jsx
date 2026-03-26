import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const TABS = ['Users', 'Learning Materials', 'Audit Logs'];

export default function AdminPanel() {
  const [tab, setTab] = useState('Users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [roles, setRoles] = useState({});
  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [courseSubTab, setCourseSubTab] = useState('Upload Course');
  const [matForm, setMatForm] = useState({ title: '', type: 'pdf', file: null });
  const [matError, setMatError] = useState('');
  const [matSuccess, setMatSuccess] = useState('');
  const [matLoading, setMatLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [launchForm, setLaunchForm] = useState({ material_id: '', targetRoles: [], targetUsers: [] });
  const [launchError, setLaunchError] = useState('');
  const [launchSuccess, setLaunchSuccess] = useState('');
  const [launchLoading, setLaunchLoading] = useState(false);
  const [multiSelected, setMultiSelected] = useState([]);
  const [multiRoles, setMultiRoles] = useState([]);
  const [multiUsers, setMultiUsers] = useState([]);
  const [multiError, setMultiError] = useState('');
  const [multiSuccess, setMultiSuccess] = useState('');
  const [multiLoading, setMultiLoading] = useState(false);
  const [quizForm, setQuizForm] = useState({ title: '', pass_score: 80, questions: [{ question: '', options: ['', '', '', ''], correct_index: 0 }] });
  const [quizError, setQuizError] = useState('');
  const [quizSuccess, setQuizSuccess] = useState('');
  const [quizLoading, setQuizLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState(null); // user object
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const { enterOverride } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
    api.get('/admin/roles').then(res => setRoles(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'Audit Logs') fetchLogs();
    if (tab === 'Learning Materials') { fetchMaterials(); fetchAssignments(); }
  }, [tab]);

  async function fetchMaterials() {
    const res = await api.get('/api/materials');
    setMaterials(res.data);
  }

  async function fetchAssignments() {
    const res = await api.get('/api/assignments');
    setAssignments(res.data);
  }

  async function handleMatUpload(e) {
    e.preventDefault();
    setMatError('');
    setMatSuccess('');
    if (!matForm.file) return setMatError('Please select a file');
    const ext = matForm.file.name.split('.').pop().toLowerCase();
    if (matForm.type === 'pdf' && ext !== 'pdf') return setMatError('Please select a PDF file');
    if (matForm.type === 'scorm' && ext !== 'zip') return setMatError('Please select a ZIP file for SCORM');

    const formData = new FormData();
    formData.append('title', matForm.title);
    formData.append('type', matForm.type);
    formData.append('file', matForm.file);

    setMatLoading(true);
    setUploadProgress(0);
    try {
      await api.post('/api/materials', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setUploadProgress(Math.round((e.loaded / e.total) * 100)),
      });
      setMatSuccess('Course uploaded successfully');
      setMatForm({ title: '', type: 'pdf', file: null });
      setUploadProgress(0);
      fetchMaterials();
    } catch (err) {
      setMatError(err.response?.data?.error || 'Upload failed');
    } finally {
      setMatLoading(false);
    }
  }

  async function handleLaunch(e) {
    e.preventDefault();
    setLaunchError('');
    setLaunchSuccess('');
    if (!launchForm.material_id) return setLaunchError('Please select a course');
    if (launchForm.targetRoles.length === 0 && launchForm.targetUsers.length === 0) {
      return setLaunchError('Please select at least one target role or user');
    }
    setLaunchLoading(true);
    try {
      await api.post('/api/assignments', {
        material_id: launchForm.material_id,
        target_roles: launchForm.targetRoles,
        target_users: launchForm.targetUsers,
      });
      setLaunchSuccess('Course launched successfully!');
      setLaunchForm({ material_id: '', targetRoles: [], targetUsers: [] });
      fetchAssignments();
    } catch (err) {
      setLaunchError(err.response?.data?.error || 'Launch failed');
    } finally {
      setLaunchLoading(false);
    }
  }

  async function handleMultiLaunch(e) {
    e.preventDefault();
    setMultiError('');
    setMultiSuccess('');
    if (multiSelected.length === 0) return setMultiError('Please select at least one course');
    if (multiRoles.length === 0 && multiUsers.length === 0) return setMultiError('Please select at least one target role or user');
    setMultiLoading(true);
    try {
      await Promise.all(multiSelected.map(id =>
        api.post('/api/assignments', {
          material_id: id,
          target_roles: multiRoles,
          target_users: multiUsers,
        })
      ));
      setMultiSuccess(`${multiSelected.length} course(s) launched successfully!`);
      setMultiSelected([]);
      setMultiRoles([]);
      setMultiUsers([]);
      fetchAssignments();
    } catch (err) {
      setMultiError(err.response?.data?.error || 'Launch failed');
    } finally {
      setMultiLoading(false);
    }
  }

  async function revokeAssignment(id) {
    if (!window.confirm('Revoke this course assignment?')) return;
    await api.delete(`/api/assignments/${id}`);
    fetchAssignments();
  }

  async function deleteMaterial(id, title) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    await api.delete(`/api/materials/${id}`);
    fetchMaterials();
  }

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function fetchUsers() {
    const res = await api.get('/admin/users');
    setUsers(res.data);
  }

  async function fetchLogs() {
    const res = await api.get('/admin/audit-logs');
    setLogs(res.data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setLoading(true);
    try {
      await api.post('/admin/users', form);
      setFormSuccess(`User ${form.email} created successfully`);
      setForm({ name: '', email: '', password: '', role: '' });
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(user) {
    await api.put(`/admin/users/${user.id}`, { is_active: !user.is_active });
    fetchUsers();
  }

  async function changeRole(userId, role) {
    await api.put(`/admin/users/${userId}`, { role });
    fetchUsers();
  }

  async function deleteUser(userId) {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    await api.delete(`/admin/users/${userId}`);
    fetchUsers();
  }

  async function unlockUser(userId) {
    await api.post(`/admin/users/${userId}/unlock`);
    fetchUsers();
  }

  function isLocked(u) {
    return u.locked_until && new Date(u.locked_until) > new Date();
  }

  function addQuestion() {
    setQuizForm(f => ({ ...f, questions: [...f.questions, { question: '', options: ['', '', '', ''], correct_index: 0 }] }));
  }

  function removeQuestion(qi) {
    setQuizForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== qi) }));
  }

  function updateQuestion(qi, value) {
    setQuizForm(f => {
      const qs = [...f.questions];
      qs[qi] = { ...qs[qi], question: value };
      return { ...f, questions: qs };
    });
  }

  function updateOption(qi, oi, value) {
    setQuizForm(f => {
      const qs = [...f.questions];
      const opts = [...qs[qi].options];
      opts[oi] = value;
      qs[qi] = { ...qs[qi], options: opts };
      return { ...f, questions: qs };
    });
  }

  async function handleCreateQuiz(e) {
    e.preventDefault();
    setQuizError('');
    setQuizSuccess('');
    setQuizLoading(true);
    try {
      await api.post('/api/quizzes', quizForm);
      setQuizSuccess(`Quiz "${quizForm.title}" created successfully! Go to Launch Course to assign it.`);
      setQuizForm({ title: '', pass_score: 80, questions: [{ question: '', options: ['', '', '', ''], correct_index: 0 }] });
      fetchMaterials();
    } catch (err) {
      setQuizError(err.response?.data?.error || 'Failed to create quiz');
    } finally {
      setQuizLoading(false);
    }
  }

  async function handleOverride(e) {
    e.preventDefault();
    setOverrideError('');
    if (!overrideReason.trim()) return setOverrideError('Please enter an emergency reason');
    setOverrideLoading(true);
    try {
      const res = await api.post(`/admin/users/${overrideTarget.id}/impersonate`, { reason: overrideReason });
      enterOverride(res.data.token, res.data.user);
      setOverrideTarget(null);
      setOverrideReason('');
      navigate('/welcome');
    } catch (err) {
      setOverrideError(err.response?.data?.error || 'Override failed');
    } finally {
      setOverrideLoading(false);
    }
  }

  const roleColor = { admin: '#dc2626', doctor: '#059669', nurse: '#0891b2', cardiopulmonary: '#7c3aed' };

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Admin Panel</h2>

      <div style={styles.tabs}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...styles.tab, ...(tab === t ? styles.activeTab : {}) }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Users' && (
        <>
          <div style={styles.header}>
            <p style={styles.count}>{users.length} users</p>
            <button onClick={() => setShowCreate(!showCreate)} style={styles.createBtn}>
              {showCreate ? 'Cancel' : '+ Add User'}
            </button>
          </div>

          {showCreate && (
            <div style={styles.formCard}>
              <h3 style={styles.formTitle}>Create New User</h3>
              <form onSubmit={handleCreate} style={styles.form}>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Full Name</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={styles.input} placeholder="Jane Doe" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required style={styles.input} placeholder="jane@hospital.com" />
                  </div>
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Temporary Password</label>
                    <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required style={styles.input} placeholder="Min 8 chars" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Role</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} required style={styles.input}>
                      <option value="">Select role...</option>
                      {Object.entries(roles).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {formError && <p style={styles.error}>{formError}</p>}
                {formSuccess && <p style={styles.success}>{formSuccess}</p>}
                <button type="submit" disabled={loading} style={styles.submitBtn}>
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </form>
            </div>
          )}

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Last Login</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={styles.td}>{u.name}</td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}>
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value)}
                        style={{ ...styles.roleSelect, borderColor: roleColor[u.role] || '#64748b', color: roleColor[u.role] || '#64748b' }}
                      >
                        {Object.entries(roles).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.statusBadge, background: u.is_active ? '#dcfce7' : '#fee2e2', color: u.is_active ? '#15803d' : '#b91c1c' }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {isLocked(u) && (
                        <span style={{ ...styles.statusBadge, background: '#fef3c7', color: '#b45309', marginLeft: '0.4rem' }}>
                          Locked
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                    <td style={styles.td}>
                      <button onClick={() => toggleActive(u)} style={styles.actionBtn}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      {isLocked(u) && (
                        <button onClick={() => unlockUser(u.id)} style={{ ...styles.actionBtn, color: '#d97706' }}>
                          Unlock
                        </button>
                      )}
                      {u.role !== 'admin' && u.is_active && (
                        <button onClick={() => { setOverrideTarget(u); setOverrideReason(''); setOverrideError(''); }} style={{ ...styles.actionBtn, color: '#7c3aed' }}>
                          Override
                        </button>
                      )}
                      <button onClick={() => deleteUser(u.id)} style={{ ...styles.actionBtn, color: '#dc2626' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'Learning Materials' && (
        <>
          {/* Sub-tabs */}
          <div style={styles.subTabs}>
            {['Upload Course', 'Launch Course', 'Launch Multiple Courses', 'Create Quiz'].map(st => (
              <button
                key={st}
                onClick={() => setCourseSubTab(st)}
                style={{ ...styles.subTab, ...(courseSubTab === st ? styles.activeSubTab : {}) }}
              >
                {st === 'Upload Course' ? '📤 Upload Course' : st === 'Launch Course' ? '🚀 Launch Course' : st === 'Launch Multiple Courses' ? '🚀📚 Launch Multiple' : '📝 Create Quiz'}
              </button>
            ))}
          </div>

          {/* ── Upload Course ── */}
          {courseSubTab === 'Upload Course' && (
            <>
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>Upload Course</h3>
                <form onSubmit={handleMatUpload} style={styles.form}>
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Course Title</label>
                      <input
                        value={matForm.title}
                        onChange={e => setMatForm({ ...matForm, title: e.target.value })}
                        required style={styles.input}
                        placeholder="e.g. CPR Training Module 1"
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Type</label>
                      <select
                        value={matForm.type}
                        onChange={e => setMatForm({ ...matForm, type: e.target.value, file: null })}
                        style={styles.input}
                      >
                        <option value="pdf">PDF Document</option>
                        <option value="scorm">SCORM Package (ZIP)</option>
                      </select>
                    </div>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{matForm.type === 'pdf' ? 'Select PDF File' : 'Select SCORM ZIP File'}</label>
                    <input
                      type="file"
                      accept={matForm.type === 'pdf' ? '.pdf' : '.zip'}
                      onChange={e => setMatForm({ ...matForm, file: e.target.files[0] })}
                      required style={styles.fileInput}
                    />
                    <p style={styles.fileHint}>{matForm.type === 'pdf' ? 'Accepted: .pdf — Max 500MB' : 'Accepted: .zip (SCORM package) — Max 500MB'}</p>
                  </div>
                  {matLoading && uploadProgress > 0 && (
                    <div style={styles.progressBar}>
                      <div style={{ ...styles.progressFill, width: `${uploadProgress}%` }} />
                      <span style={styles.progressText}>{uploadProgress}%</span>
                    </div>
                  )}
                  {matError && <p style={styles.error}>{matError}</p>}
                  {matSuccess && <p style={styles.success}>{matSuccess}</p>}
                  <button type="submit" disabled={matLoading} style={styles.submitBtn}>
                    {matLoading ? `Uploading... ${uploadProgress}%` : '📤 Upload Course'}
                  </button>
                </form>
              </div>

              {/* Uploaded courses list */}
              <div style={styles.tableWrapper}>
                {materials.length === 0
                  ? <p style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No courses uploaded yet.</p>
                  : (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Course Title</th>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Size</th>
                          <th style={styles.th}>Uploaded By</th>
                          <th style={styles.th}>Date</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materials.map(m => (
                          <tr key={m.id}>
                            <td style={styles.td}>{m.title}</td>
                            <td style={styles.td}>
                              <span style={{ ...styles.statusBadge, background: m.type === 'pdf' ? '#dbeafe' : '#ede9fe', color: m.type === 'pdf' ? '#1d4ed8' : '#6d28d9' }}>
                                {m.type === 'pdf' ? '📄 PDF' : '📦 SCORM'}
                              </span>
                            </td>
                            <td style={styles.td}>{formatSize(m.file_size)}</td>
                            <td style={styles.td}>{m.uploaded_by}</td>
                            <td style={styles.td}>{new Date(m.created_at).toLocaleString()}</td>
                            <td style={styles.td}>
                              <a href={m.entry_point} target="_blank" rel="noreferrer" style={{ ...styles.actionBtn, textDecoration: 'none' }}>View</a>
                              <button onClick={() => deleteMaterial(m.id, m.title)} style={{ ...styles.actionBtn, color: '#dc2626' }}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            </>
          )}

          {/* ── Launch Course ── */}
          {courseSubTab === 'Launch Course' && (
            <>
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>Launch Course</h3>
                <form onSubmit={handleLaunch} style={styles.form}>

                  {/* Select Course */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Select Course</label>
                    <select
                      value={launchForm.material_id}
                      onChange={e => setLaunchForm({ ...launchForm, material_id: e.target.value })}
                      required style={styles.input}
                    >
                      <option value="">— Choose a course —</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>{m.title} ({m.type.toUpperCase()})</option>
                      ))}
                    </select>
                  </div>

                  {/* Target Roles */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Target Roles</label>
                    <div style={styles.checkGrid}>
                      {Object.entries(roles).filter(([key]) => key !== 'admin').map(([key, val]) => (
                        <label key={key} style={styles.checkLabel}>
                          <input
                            type="checkbox"
                            checked={launchForm.targetRoles.includes(key)}
                            onChange={e => {
                              const updated = e.target.checked
                                ? [...launchForm.targetRoles, key]
                                : launchForm.targetRoles.filter(r => r !== key);
                              setLaunchForm({ ...launchForm, targetRoles: updated });
                            }}
                            style={{ marginRight: '0.4rem' }}
                          />
                          {val.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Target Individual Users */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Target Individual Users <span style={styles.optionalTag}>(optional)</span></label>
                    <select
                      value=""
                      onChange={e => {
                        const val = e.target.value;
                        if (val && !launchForm.targetUsers.includes(val))
                          setLaunchForm({ ...launchForm, targetUsers: [...launchForm.targetUsers, val] });
                      }}
                      style={styles.input}
                    >
                      <option value="">— Select a user to add —</option>
                      {users.filter(u => u.role !== 'admin' && u.is_active && !launchForm.targetUsers.includes(String(u.id))).map(u => (
                        <option key={u.id} value={String(u.id)}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                    {launchForm.targetUsers.length > 0 && (
                      <div style={styles.tagList}>
                        {launchForm.targetUsers.map(uid => {
                          const u = users.find(u => String(u.id) === uid);
                          return (
                            <span key={uid} style={styles.userTag}>
                              {u?.name || uid}
                              <button type="button" onClick={() => setLaunchForm({ ...launchForm, targetUsers: launchForm.targetUsers.filter(id => id !== uid) })} style={styles.removeTag}>×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {launchError && <p style={styles.error}>{launchError}</p>}
                  {launchSuccess && <p style={styles.success}>{launchSuccess}</p>}

                  <button type="submit" disabled={launchLoading} style={{ ...styles.submitBtn, background: '#059669' }}>
                    {launchLoading ? 'Launching...' : '🚀 Launch Course'}
                  </button>
                </form>
              </div>

              {/* Assignments list */}
              <div style={styles.tableWrapper}>
                {assignments.length === 0
                  ? <p style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No courses launched yet.</p>
                  : (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Course</th>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Target Roles</th>
                          <th style={styles.th}>Target Users</th>
                          <th style={styles.th}>Launched By</th>
                          <th style={styles.th}>Launched At</th>
                          <th style={styles.th}>Acknowledged</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map(a => (
                          <tr key={a.id}>
                            <td style={styles.td}>{a.title}</td>
                            <td style={styles.td}>
                              <span style={{ ...styles.statusBadge, background: a.type === 'pdf' ? '#dbeafe' : '#ede9fe', color: a.type === 'pdf' ? '#1d4ed8' : '#6d28d9' }}>
                                {a.type === 'pdf' ? '📄 PDF' : '📦 SCORM'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {(a.target_roles || []).length === 0
                                ? <span style={styles.allTag}>All</span>
                                : (a.target_roles || []).map(r => (
                                  <span key={r} style={{ ...styles.targetTag, background: '#dbeafe', color: '#1d4ed8' }}>{r}</span>
                                ))}
                            </td>
                            <td style={styles.td}>
                              {(a.target_users || []).length === 0
                                ? <span style={styles.allTag}>—</span>
                                : (a.target_users || []).map(uid => {
                                  const u = users.find(u => String(u.id) === uid);
                                  return <span key={uid} style={{ ...styles.targetTag, background: '#dcfce7', color: '#15803d' }}>{u?.name || uid}</span>;
                                })}
                            </td>
                            <td style={styles.td}>{a.launched_by}</td>
                            <td style={styles.td}>{new Date(a.launched_at).toLocaleString()}</td>
                            <td style={styles.td}>
                              <span style={{ ...styles.statusBadge, background: a.completions_count > 0 ? '#dcfce7' : '#f3f4f6', color: a.completions_count > 0 ? '#15803d' : '#9ca3af' }}>
                                {a.completions_count || 0} ✓
                              </span>
                            </td>
                            <td style={styles.td}>
                              <button onClick={() => revokeAssignment(a.id)} style={{ ...styles.actionBtn, color: '#dc2626' }}>Revoke</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            </>
          )}

          {/* ── Launch Multiple Courses ── */}
          {courseSubTab === 'Launch Multiple Courses' && (
            <>
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>Launch Multiple Courses</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  Select one or more courses, set the target roles and users, then click Launch.
                </p>
                <form onSubmit={handleMultiLaunch} style={styles.form}>

                  {/* Course list with checkboxes */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Select Courses</label>
                    <div style={styles.courseList}>
                      {materials.length === 0
                        ? <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No courses uploaded yet. Go to Upload Course tab first.</p>
                        : materials.map(m => (
                          <label key={m.id} style={{ ...styles.courseRow, background: multiSelected.includes(m.id) ? '#f0fdf4' : 'white', borderColor: multiSelected.includes(m.id) ? '#059669' : '#e2e8f0' }}>
                            <input
                              type="checkbox"
                              checked={multiSelected.includes(m.id)}
                              onChange={e => {
                                const updated = e.target.checked
                                  ? [...multiSelected, m.id]
                                  : multiSelected.filter(id => id !== m.id);
                                setMultiSelected(updated);
                              }}
                              style={{ marginRight: '0.75rem', width: '16px', height: '16px' }}
                            />
                            <span style={styles.courseRowTitle}>{m.title}</span>
                            <span style={{ ...styles.statusBadge, background: m.type === 'pdf' ? '#dbeafe' : '#ede9fe', color: m.type === 'pdf' ? '#1d4ed8' : '#6d28d9', marginLeft: 'auto' }}>
                              {m.type === 'pdf' ? '📄 PDF' : '📦 SCORM'}
                            </span>
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.75rem' }}>{formatSize(m.file_size)}</span>
                          </label>
                        ))
                      }
                    </div>
                    {multiSelected.length > 0 && (
                      <p style={{ color: '#059669', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: '600' }}>
                        {multiSelected.length} course(s) selected
                      </p>
                    )}
                  </div>

                  {/* Target Roles */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Target Roles</label>
                    <div style={styles.checkGrid}>
                      {Object.entries(roles).filter(([key]) => key !== 'admin').map(([key, val]) => (
                        <label key={key} style={styles.checkLabel}>
                          <input
                            type="checkbox"
                            checked={multiRoles.includes(key)}
                            onChange={e => {
                              const updated = e.target.checked
                                ? [...multiRoles, key]
                                : multiRoles.filter(r => r !== key);
                              setMultiRoles(updated);
                            }}
                            style={{ marginRight: '0.4rem' }}
                          />
                          {val.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Target Individual Users */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Target Individual Users <span style={styles.optionalTag}>(optional)</span></label>
                    <select
                      value=""
                      onChange={e => {
                        const val = e.target.value;
                        if (val && !multiUsers.includes(val))
                          setMultiUsers([...multiUsers, val]);
                      }}
                      style={styles.input}
                    >
                      <option value="">— Select a user to add —</option>
                      {users.filter(u => u.role !== 'admin' && u.is_active && !multiUsers.includes(String(u.id))).map(u => (
                        <option key={u.id} value={String(u.id)}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                    {multiUsers.length > 0 && (
                      <div style={styles.tagList}>
                        {multiUsers.map(uid => {
                          const u = users.find(u => String(u.id) === uid);
                          return (
                            <span key={uid} style={styles.userTag}>
                              {u?.name || uid}
                              <button type="button" onClick={() => setMultiUsers(multiUsers.filter(id => id !== uid))} style={styles.removeTag}>×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {multiError && <p style={styles.error}>{multiError}</p>}
                  {multiSuccess && <p style={styles.success}>{multiSuccess}</p>}

                  <button type="submit" disabled={multiLoading || multiSelected.length === 0} style={{ ...styles.submitBtn, background: '#7c3aed' }}>
                    {multiLoading ? 'Launching...' : `🚀 Launch ${multiSelected.length > 0 ? multiSelected.length : ''} Selected Course(s)`}
                  </button>
                </form>
              </div>

              {/* All assignments */}
              <div style={styles.tableWrapper}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', fontWeight: '600', color: '#374151' }}>
                  All Launched Assignments
                </div>
                {assignments.length === 0
                  ? <p style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No assignments yet.</p>
                  : (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Course</th>
                          <th style={styles.th}>Type</th>
                          <th style={styles.th}>Target Roles</th>
                          <th style={styles.th}>Target Users</th>
                          <th style={styles.th}>Launched By</th>
                          <th style={styles.th}>Launched At</th>
                          <th style={styles.th}>Acknowledged</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map(a => (
                          <tr key={a.id}>
                            <td style={styles.td}>{a.title}</td>
                            <td style={styles.td}>
                              <span style={{ ...styles.statusBadge, background: a.type === 'pdf' ? '#dbeafe' : '#ede9fe', color: a.type === 'pdf' ? '#1d4ed8' : '#6d28d9' }}>
                                {a.type === 'pdf' ? '📄 PDF' : '📦 SCORM'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {(a.target_roles || []).length === 0
                                ? <span style={styles.allTag}>All</span>
                                : (a.target_roles || []).map(r => (
                                  <span key={r} style={{ ...styles.targetTag, background: '#dbeafe', color: '#1d4ed8' }}>{r}</span>
                                ))}
                            </td>
                            <td style={styles.td}>
                              {(a.target_users || []).length === 0
                                ? <span style={styles.allTag}>—</span>
                                : (a.target_users || []).map(uid => {
                                  const u = users.find(u => String(u.id) === uid);
                                  return <span key={uid} style={{ ...styles.targetTag, background: '#dcfce7', color: '#15803d' }}>{u?.name || uid}</span>;
                                })}
                            </td>
                            <td style={styles.td}>{a.launched_by}</td>
                            <td style={styles.td}>{new Date(a.launched_at).toLocaleString()}</td>
                            <td style={styles.td}>
                              <span style={{ ...styles.statusBadge, background: a.completions_count > 0 ? '#dcfce7' : '#f3f4f6', color: a.completions_count > 0 ? '#15803d' : '#9ca3af' }}>
                                {a.completions_count || 0} ✓
                              </span>
                            </td>
                            <td style={styles.td}>
                              <button onClick={() => revokeAssignment(a.id)} style={{ ...styles.actionBtn, color: '#dc2626' }}>Revoke</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            </>
          )}
        </>
      )}

          {/* ── Create Quiz ── */}
          {courseSubTab === 'Create Quiz' && (
            <div style={styles.formCard}>
              <h3 style={styles.formTitle}>Create Quiz</h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                Build a quiz with multiple-choice questions. Once saved it appears in Launch Course for assignment.
              </p>
              <form onSubmit={handleCreateQuiz} style={styles.form}>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Quiz Title</label>
                    <input value={quizForm.title} onChange={e => setQuizForm(f => ({ ...f, title: e.target.value }))} required style={styles.input} placeholder="e.g. HIPAA Compliance Quiz" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Pass Score (%)</label>
                    <input type="number" min="1" max="100" value={quizForm.pass_score} onChange={e => setQuizForm(f => ({ ...f, pass_score: Number(e.target.value) }))} required style={styles.input} />
                    <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0.2rem 0 0' }}>Learner must score ≥ this % to pass</p>
                  </div>
                </div>

                {/* Questions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {quizForm.questions.map((q, qi) => (
                    <div key={qi} style={styles.questionBlock}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.875rem' }}>Question {qi + 1}</span>
                        {quizForm.questions.length > 1 && (
                          <button type="button" onClick={() => removeQuestion(qi)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' }}>✕ Remove</button>
                        )}
                      </div>
                      <input
                        value={q.question}
                        onChange={e => updateQuestion(qi, e.target.value)}
                        required
                        placeholder="Enter question text..."
                        style={{ ...styles.input, marginBottom: '0.75rem', width: '100%' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {q.options.map((opt, oi) => (
                          <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="radio"
                              name={`correct-${qi}`}
                              checked={q.correct_index === oi}
                              onChange={() => setQuizForm(f => {
                                const qs = [...f.questions];
                                qs[qi] = { ...qs[qi], correct_index: oi };
                                return { ...f, questions: qs };
                              })}
                              title="Mark as correct answer"
                            />
                            <span style={{ ...styles.optionLetter, background: q.correct_index === oi ? '#dcfce7' : '#f1f5f9', color: q.correct_index === oi ? '#15803d' : '#64748b' }}>
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <input
                              value={opt}
                              onChange={e => updateOption(qi, oi, e.target.value)}
                              required
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              style={{ ...styles.input, flex: 1 }}
                            />
                          </div>
                        ))}
                        <p style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.25rem' }}>
                          ● Select the radio button next to the correct answer
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={addQuestion} style={styles.addQBtn}>
                  + Add Question
                </button>

                {quizError && <p style={styles.error}>{quizError}</p>}
                {quizSuccess && <p style={styles.success}>{quizSuccess}</p>}

                <button type="submit" disabled={quizLoading} style={{ ...styles.submitBtn, background: '#7c3aed' }}>
                  {quizLoading ? 'Saving...' : '📝 Save Quiz'}
                </button>
              </form>
            </div>
          )}

      {/* ── Emergency Override Modal ── */}
      {overrideTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚨</div>
            <h3 style={{ color: '#7c3aed', marginBottom: '0.25rem' }}>Emergency Override</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              You are about to access the portal as <strong>{overrideTarget.name}</strong> ({overrideTarget.role}).
              This action will be logged in the audit trail.
            </p>
            <form onSubmit={handleOverride} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ ...styles.label, display: 'block', marginBottom: '0.4rem' }}>
                  Emergency Reason <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Describe the emergency that requires this override access..."
                  style={{ ...styles.input, resize: 'vertical', width: '100%' }}
                />
              </div>
              {overrideError && <p style={styles.error}>{overrideError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setOverrideTarget(null)} style={styles.cancelModalBtn}>
                  Cancel
                </button>
                <button type="submit" disabled={overrideLoading} style={styles.overrideConfirmBtn}>
                  {overrideLoading ? 'Activating...' : '🚨 Activate Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === 'Audit Logs' && (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Time</th>
                <th style={styles.th}>User</th>
                <th style={styles.th}>Action</th>
                <th style={styles.th}>Details</th>
                <th style={styles.th}>IP</th>
                <th style={styles.th}>Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={styles.td}>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={styles.td}>{log.user_email || '—'}</td>
                  <td style={styles.td}><code style={styles.code}>{log.action}</code></td>
                  <td style={styles.td}>{log.details || '—'}</td>
                  <td style={styles.td}>{log.ip_address || '—'}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.statusBadge, background: log.success ? '#dcfce7' : '#fee2e2', color: log.success ? '#15803d' : '#b91c1c' }}>
                      {log.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
  title: { color: '#1e293b', fontSize: '1.5rem', marginBottom: '1.5rem' },
  tabs: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' },
  tab: { padding: '0.5rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', color: '#64748b', fontWeight: '500' },
  activeTab: { background: '#1e40af', color: 'white', borderColor: '#1e40af' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  count: { color: '#64748b', fontSize: '0.875rem' },
  createBtn: { padding: '0.5rem 1rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
  formCard: { background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem' },
  formTitle: { color: '#1e293b', marginBottom: '1.25rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label: { fontWeight: '600', color: '#374151', fontSize: '0.8rem' },
  input: { padding: '0.65rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem' },
  submitBtn: { padding: '0.75rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', alignSelf: 'flex-start', minWidth: '140px' },
  error: { color: '#dc2626', fontSize: '0.85rem' },
  success: { color: '#16a34a', fontSize: '0.85rem' },
  tableWrapper: { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '2px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontWeight: '600', fontSize: '0.8rem', whiteSpace: 'nowrap' },
  td: { padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6', color: '#4b5563', fontSize: '0.875rem' },
  roleSelect: { padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid', fontWeight: '600', fontSize: '0.8rem', background: 'white', cursor: 'pointer' },
  statusBadge: { padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af', fontSize: '0.8rem', marginRight: '0.5rem', fontWeight: '500' },
  code: { background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace' },
  fileInput: { padding: '0.5rem', border: '1px dashed #d1d5db', borderRadius: '8px', width: '100%', cursor: 'pointer', background: '#f9fafb' },
  fileHint: { color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.35rem' },
  checkGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e2e8f0' },
  checkLabel: { display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#374151', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '6px', background: 'white', border: '1px solid #e2e8f0' },
  optionalTag: { color: '#9ca3af', fontWeight: '400', fontSize: '0.75rem', marginLeft: '0.5rem' },
  targetTag: { display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600', marginRight: '0.25rem', marginBottom: '0.15rem', textTransform: 'capitalize' },
  allTag: { color: '#9ca3af', fontSize: '0.8rem' },
  subTabs: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  subTab: { padding: '0.5rem 1.25rem', border: '2px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', color: '#64748b', fontWeight: '600', fontSize: '0.875rem' },
  activeSubTab: { background: '#f0fdf4', borderColor: '#059669', color: '#059669' },
  courseList: { display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto', padding: '0.25rem' },
  courseRow: { display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid', cursor: 'pointer', transition: 'all 0.15s' },
  courseRowTitle: { fontWeight: '500', color: '#1e293b', fontSize: '0.9rem' },
  tagList: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' },
  userTag: { display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.65rem', background: '#ede9fe', color: '#6d28d9', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600' },
  removeTag: { background: 'none', border: 'none', cursor: 'pointer', color: '#6d28d9', fontSize: '1rem', lineHeight: 1, padding: 0, fontWeight: '700' },
  progressBar: { background: '#e2e8f0', borderRadius: '999px', height: '20px', position: 'relative', overflow: 'hidden' },
  progressFill: { background: '#1e40af', height: '100%', borderRadius: '999px', transition: 'width 0.3s ease' },
  progressText: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '0.7rem', fontWeight: '700', color: 'white' },
  questionBlock: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' },
  optionLetter: { width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.75rem', flexShrink: 0 },
  addQBtn: { alignSelf: 'flex-start', padding: '0.5rem 1rem', background: 'white', border: '2px dashed #7c3aed', borderRadius: '8px', color: '#7c3aed', fontWeight: '700', cursor: 'pointer', fontSize: '0.875rem' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  modalBox: { background: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '460px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center' },
  cancelModalBtn: { padding: '0.6rem 1.25rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontWeight: '600' },
  overrideConfirmBtn: { padding: '0.6rem 1.25rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' },
};
