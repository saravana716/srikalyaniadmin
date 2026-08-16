import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiMenu, FiX } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import {
  subscribeAdmins,
  addAdmin as addAdminToDb,
  updateAdmin as updateAdminInDb,
  deleteAdmin as deleteAdminFromDb,
} from '../services/adminService';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

const AddEditAdminModal = ({ admin, onClose, onSave, error, saving }) => {
  const isEdit = !!admin;
  const [email, setEmail] = useState(admin?.Email ?? '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(admin?.Name ?? '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    await onSave(
      { email, password: password || undefined, name },
      admin?.id
    );
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Edit Admin' : 'Add Admin Account'}</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.formInput}
              placeholder="admin@gmail.com"
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>
              Password {isEdit && <span style={{ fontWeight: 400, color: '#666' }}>(leave blank to keep current)</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.formInput}
              placeholder={isEdit ? '••••••' : 'Enter password'}
              required={!isEdit}
              minLength={isEdit ? 0 : 4}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.formInput}
              placeholder="Admin name"
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText={isEdit ? 'Updating…' : 'Creating…'}>
              {isEdit ? 'Update' : 'Create Admin'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminAccounts = () => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionAnchorEl, setActionAnchorEl] = useState(null);

  useEffect(() => {
    const unsub = subscribeAdmins((data) => {
      setList(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = list.filter((row) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return [row.Email, row.Name].some((v) => String(v || '').toLowerCase().includes(q));
  });

  const handleSave = async (data, id) => {
    setSaveError(null);
    setSaving(true);
    try {
      if (id) await updateAdminInDb(id, data);
      else await addAdminToDb(data);
      setShowAddModal(false);
      setEditingRow(null);
    } catch (e) {
      setSaveError(e?.message || 'Failed to save admin');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (row.id === user?.id) {
      alert('You cannot delete your own account while logged in.');
      return;
    }
    if (list.length <= 1) {
      alert('At least one admin account must remain.');
      return;
    }
    if (!window.confirm(`Delete admin ${row.Email}?`)) return;
    setDeleting(true);
    try {
      await deleteAdminFromDb(row.id);
      setOpenActionId(null);
    } catch (e) {
      console.error('Delete admin failed', e);
      alert(e?.message || 'Failed to delete admin');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

      {showAddModal && (
        <AddEditAdminModal onClose={() => { if (!saving) { setShowAddModal(false); setSaveError(null); } }} onSave={handleSave} error={saveError} saving={saving} />
      )}
      {editingRow && (
        <AddEditAdminModal admin={editingRow} onClose={() => { if (!saving) { setEditingRow(null); setSaveError(null); } }} onSave={handleSave} error={saveError} saving={saving} />
      )}

      <main style={styles.main} className="dashboard-main">
        <header style={styles.header} className="dashboard-header">
          <div style={styles.headerRow}>
            <button style={styles.hamburger} className="mobile-hamburger" onClick={() => setIsSidebarOpen(true)}>
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Admin Accounts</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <Button type="button" onClick={() => setShowAddModal(true)}>+ Add Admin</Button>
            <div style={styles.searchContainer} className="search-container">
              <FiSearch style={styles.searchIcon} />
              <input type="text" placeholder="Search admins..." style={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </header>

        <p style={styles.hint}>
          Manage login accounts stored in Firestore <code style={styles.code}>admin</code> collection.
          Login uses <strong>Email</strong> + <strong>Password</strong> fields.
        </p>

        <ActionMenu
          isOpen={!!openActionId}
          onClose={() => { setOpenActionId(null); setActionAnchorEl(null); }}
          anchorEl={actionAnchorEl}
          busy={deleting}
          onView={() => { const row = list.find((r) => r.id === openActionId); if (row) setEditingRow(row); }}
          onEdit={() => { const row = list.find((r) => r.id === openActionId); if (row) setEditingRow(row); }}
          onDelete={() => { const row = list.find((r) => r.id === openActionId); if (row) return handleDelete(row); }}
        />

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}><span className="th-content">Email <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Password</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} style={styles.tr}>
                  <td style={styles.td}>
                    {row.Email}
                    {row.id === user?.id && <span style={styles.youBadge}>You</span>}
                  </td>
                  <td style={styles.td}>{row.Name || '—'}</td>
                  <td style={styles.td}>••••••</td>
                  <td style={styles.tdAction}>
                    <button
                      type="button"
                      style={styles.actionMenuTrigger}
                      onClick={(e) => {
                        setOpenActionId(openActionId === row.id ? null : row.id);
                        setActionAnchorEl(openActionId === row.id ? null : e.currentTarget);
                      }}
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <p style={{ color: '#666' }}>Loading admin accounts…</p>}
        {!loading && filtered.length === 0 && <p style={{ color: '#666' }}>No admin accounts found.</p>}
      </main>
    </div>
  );
};

const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#fff' },
  main: { marginLeft: '260px', flex: 1, padding: '24px 40px', backgroundColor: '#fff', maxWidth: '100vw', transition: 'margin-left 0.3s ease' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '20px', flexWrap: 'wrap' },
  headerRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  pageTitle: { fontSize: '28px', color: MAROON, fontWeight: '700' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  hint: { fontSize: '14px', color: '#666', marginBottom: '20px', lineHeight: 1.5 },
  code: { backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: '13px' },
  searchContainer: { position: 'relative', backgroundColor: LIGHT_GRAY, borderRadius: '24px', padding: '10px 16px', display: 'flex', alignItems: 'center', width: '280px' },
  searchIcon: { color: '#999', marginRight: '8px', fontSize: '18px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '100%', color: '#333' },
  addBtn: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', boxSizing: 'border-box' },
  tableWrap: { overflowX: 'auto', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '500px' },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#333', backgroundColor: '#fafafa', borderBottom: `1px solid ${BORDER_GRAY}` },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  tdAction: { padding: '14px 16px' },
  youBadge: { marginLeft: 8, fontSize: 11, backgroundColor: MAROON, color: '#fff', padding: '2px 8px', borderRadius: 10 },
  actionMenuTrigger: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#666' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' },
  modalBox: { backgroundColor: '#fff', borderRadius: '12px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER_GRAY}` },
  modalTitle: { fontSize: '20px', fontWeight: '700', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', color: '#666' },
  modalBtnCancel: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #9ca3af', backgroundColor: '#fff', cursor: 'pointer' },
  modalBtnPrimary: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', cursor: 'pointer' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },
};

export default AdminAccounts;
