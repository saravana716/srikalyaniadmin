import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import { FiSearch, FiMenu, FiX } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import {
  subscribeOffers,
  addOffer as addOfferToDb,
  updateOffer as updateOfferInDb,
  deleteOffer as deleteOfferFromDb,
} from '../services/offersService';
import { formatToIST } from '../utils/dateUtils';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

const AddEditOfferModal = ({ offer, onClose, onSave, error, saving }) => {
  const isEdit = !!offer;
  const [title, setTitle] = useState(offer?.title ?? '');
  const [discount, setDiscount] = useState(offer?.discount ?? '');
  const [validFrom, setValidFrom] = useState(offer?.validFrom ?? '');
  const [validTo, setValidTo] = useState(offer?.validTo ?? '');
  const [description, setDescription] = useState(offer?.description ?? '');
  const [status, setStatus] = useState(offer?.status ?? 'Active');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    await onSave({ title, discount, validFrom, validTo, description, status }, offer?.id);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Edit Offer' : 'Add Offer'}</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Offer Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={styles.formInput} required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Discount</label>
            <input type="text" value={discount} onChange={(e) => setDiscount(e.target.value)} style={styles.formInput} placeholder="e.g. 10% or ₹5000 off" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Valid From</label>
            <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} style={styles.formInput} required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Valid To</label>
            <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} style={styles.formInput} required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.formSelect}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...styles.formInput, minHeight: 80 }} />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText={isEdit ? 'Updating…' : 'Adding…'}>
              {isEdit ? 'Update' : 'Add Offer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Offers = () => {
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
    const unsub = subscribeOffers((data) => {
      setList(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = list.filter((row) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return [row.title, row.discount, row.description, row.status].some((v) => String(v || '').toLowerCase().includes(q));
  });

  const handleSave = async (data, id) => {
    setSaveError(null);
    setSaving(true);
    try {
      if (id) await updateOfferInDb(id, data);
      else await addOfferToDb(data);
      setShowAddModal(false);
      setEditingRow(null);
    } catch (e) {
      setSaveError(e?.message || 'Failed to save offer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!row?.id || !window.confirm('Delete this offer?')) return;
    setDeleting(true);
    try {
      await deleteOfferFromDb(row.id);
      setOpenActionId(null);
    } catch (e) {
      console.error('Delete offer failed', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

      {showAddModal && (
        <AddEditOfferModal onClose={() => { if (!saving) { setShowAddModal(false); setSaveError(null); } }} onSave={handleSave} error={saveError} saving={saving} />
      )}
      {editingRow && (
        <AddEditOfferModal offer={editingRow} onClose={() => { if (!saving) { setEditingRow(null); setSaveError(null); } }} onSave={handleSave} error={saveError} saving={saving} />
      )}

      <main style={styles.main} className="dashboard-main">
        <header style={styles.header} className="dashboard-header">
          <div style={styles.headerRow}>
            <button style={styles.hamburger} className="mobile-hamburger" onClick={() => setIsSidebarOpen(true)}>
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Offers</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <Button type="button" onClick={() => setShowAddModal(true)}>+ Add Offer</Button>
            <div style={styles.searchContainer} className="search-container">
              <FiSearch style={styles.searchIcon} />
              <input type="text" placeholder="Search offers..." style={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </header>

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
                <th style={styles.th}><span className="th-content">Title <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}>Discount</th>
                <th style={styles.th}>Valid From</th>
                <th style={styles.th}>Valid To</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} style={styles.tr}>
                  <td style={styles.td}>{row.title}</td>
                  <td style={styles.td}>{row.discount}</td>
                  <td style={styles.td}>{row.validFrom ? formatToIST(row.validFrom + ' 00:00:00').split(' ')[0] : '—'}</td>
                  <td style={styles.td}>{row.validTo ? formatToIST(row.validTo + ' 00:00:00').split(' ')[0] : '—'}</td>
                  <td style={styles.td}>
                    <span style={row.status === 'Active' ? styles.badgeActive : styles.badgeInactive}>{row.status}</span>
                  </td>
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
        {loading && <p style={{ color: '#666' }}>Loading offers…</p>}
        {!loading && filtered.length === 0 && <p style={{ color: '#666' }}>No offers found. Add your first offer.</p>}
      </main>
    </div>
  );
};

const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#fff' },
  main: { marginLeft: '260px', flex: 1, padding: '24px 40px', backgroundColor: '#fff', maxWidth: '100vw', transition: 'margin-left 0.3s ease' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px', flexWrap: 'wrap' },
  headerRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  pageTitle: { fontSize: '28px', color: MAROON, fontWeight: '700' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  searchContainer: { position: 'relative', backgroundColor: LIGHT_GRAY, borderRadius: '24px', padding: '10px 16px', display: 'flex', alignItems: 'center', width: '300px' },
  searchIcon: { color: '#999', marginRight: '8px', fontSize: '18px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '100%', color: '#333' },
  addBtn: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', backgroundColor: '#fff' },
  tableWrap: { overflowX: 'auto', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '700px' },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#333', backgroundColor: '#fafafa', borderBottom: `1px solid ${BORDER_GRAY}` },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  tdAction: { padding: '14px 16px' },
  badgeActive: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#16a34a', color: '#fff', fontSize: '13px' },
  badgeInactive: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#dc2626', color: '#fff', fontSize: '13px' },
  actionMenuTrigger: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#666' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' },
  modalBox: { backgroundColor: '#fff', borderRadius: '12px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER_GRAY}` },
  modalTitle: { fontSize: '20px', fontWeight: '700', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', color: '#666' },
  modalBtnCancel: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #9ca3af', backgroundColor: '#fff', cursor: 'pointer' },
  modalBtnPrimary: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', cursor: 'pointer' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },
};

export default Offers;
