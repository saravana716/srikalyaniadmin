import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import { FiSettings, FiBell, FiMenu, FiX } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import {
  subscribePlanPurchases,
  addPlanPurchase as addPlanPurchaseToDb,
  updatePlanPurchase as updatePlanPurchaseInDb,
  deletePlanPurchase as deletePlanPurchaseFromDb,
} from '../services/planPurchasesService';
import { subscribeCustomers } from '../services/customersService';
import { subscribePlans } from '../services/plansService';
import PlanPurchaseDetailModal from '../components/PlanPurchaseDetailModal';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

const AddEditPlanPurchaseModal = ({ planPurchase, onClose, onSave, error, customers, plans, saving }) => {
  const isEdit = !!planPurchase;
  const [customerId, setCustomerId] = useState(planPurchase?.customerId ?? '');
  const [customerName, setCustomerName] = useState(planPurchase?.customerName ?? '');
  const [planId, setPlanId] = useState(planPurchase?.planId ?? '');
  const [planName, setPlanName] = useState(planPurchase?.planName ?? '');
  const [startDate, setStartDate] = useState(planPurchase?.startDate ?? new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState(planPurchase?.status ?? 'Active');

  const handleCustomerChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setCustomerId('');
      setCustomerName('');
      return;
    }
    const selected = customers.find(c => c.cusId === val || c.id === val);
    if (selected) {
      setCustomerId(selected.cusId || selected.id);
      setCustomerName(selected.name);
    }
  };

  const handlePlanChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setPlanId('');
      setPlanName('');
      return;
    }
    const selected = plans.find(p => p.id === val);
    if (selected) {
      setPlanId(selected.id);
      setPlanName(selected.name || selected.planName);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    await onSave({ customerId, customerName, planId, planName, startDate, status }, planPurchase?.id);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Edit Plan Purchase' : 'Add Plan Purchase'}</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Customer</label>
            <select 
              value={customerId} 
              onChange={handleCustomerChange} 
              style={styles.formSelect} 
              required
            >
              <option value="">Select a Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.cusId || c.id}>
                  {c.name} ({c.cusId || 'No ID'})
                </option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Plan</label>
            <select 
              value={planId} 
              onChange={handlePlanChange} 
              style={styles.formSelect} 
              required
            >
              <option value="">Select a Plan</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name || p.planName}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={styles.formInput} required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.formSelect}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} style={styles.modalBtnCancel}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText={isEdit ? 'Updating…' : 'Adding…'} style={styles.modalBtnPrimary}>
              {isEdit ? 'Update' : 'Add Plan Purchase'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PlanPurchases = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionAnchorEl, setActionAnchorEl] = useState(null);
  const [openCardActionId, setOpenCardActionId] = useState(null);
  const [cardActionAnchorEl, setCardActionAnchorEl] = useState(null);
  const [viewModalRow, setViewModalRow] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const totalPages = Math.max(1, Math.ceil(list.length / 10));

  useEffect(() => {
    const unsubList = subscribePlanPurchases(setList);
    const unsubCustomers = subscribeCustomers(setCustomers);
    const unsubPlans = subscribePlans(setPlans);
    
    setLoading(false);
    return () => {
      unsubList();
      unsubCustomers();
      unsubPlans();
    };
  }, []);

  const handleView = (row) => {
    setOpenActionId(null);
    setOpenCardActionId(null);
    setViewModalRow(row);
  };
  const handleEdit = (row) => {
    setOpenActionId(null);
    setOpenCardActionId(null);
    setEditingRow(row);
  };
  const handleSave = async (data, id) => {
    setSaveError(null);
    setSaving(true);
    try {
      if (id) {
        await updatePlanPurchaseInDb(id, data);
        setEditingRow(null);
      } else {
        await addPlanPurchaseToDb(data);
        setShowAddModal(false);
      }
    } catch (e) {
      console.error('Save plan purchase failed', e);
      setSaveError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm('Delete this plan purchase?')) return;
    setDeleting(true);
    try {
      await deletePlanPurchaseFromDb(row.id);
      setOpenActionId(null);
      setOpenCardActionId(null);
      setViewModalRow(null);
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container plan-purchases-page">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}
      {viewModalRow && (
        <PlanPurchaseDetailModal row={viewModalRow} onClose={() => setViewModalRow(null)} />
      )}

      {showAddModal && (
        <AddEditPlanPurchaseModal
          onClose={() => { if (!saving) { setShowAddModal(false); setSaveError(null); } }}
          onSave={handleSave}
          error={saveError}
          customers={customers}
          plans={plans}
          saving={saving}
        />
      )}
      {editingRow && (
        <AddEditPlanPurchaseModal
          planPurchase={editingRow}
          onClose={() => { if (!saving) { setEditingRow(null); setSaveError(null); } }}
          onSave={handleSave}
          error={saveError}
          customers={customers}
          plans={plans}
          saving={saving}
        />
      )}

      <main style={styles.main} className="dashboard-main plan-purchases-main">
        <header style={styles.header} className="dashboard-header plan-purchases-header">
          <div style={styles.headerRow}>
            <button style={styles.hamburger} className="mobile-hamburger" onClick={() => setIsSidebarOpen(true)}>
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Plan Purchases</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <button type="button" style={styles.addBtn} onClick={() => setShowAddModal(true)}>+ Add Plan Purchase</button>
            <div style={styles.headerIcons}>
              <button style={styles.iconButton}><FiSettings /></button>
              <button style={styles.iconButton}>
                <span style={styles.notifBadge}>1</span>
                <FiBell />
              </button>
              <img src="https://ui-avatars.com/api/?name=User&background=random" alt="Profile" style={styles.avatar} />
            </div>
          </div>
        </header>

        <ActionMenu
          isOpen={!!openActionId}
          onClose={() => { setOpenActionId(null); setActionAnchorEl(null); }}
          anchorEl={actionAnchorEl}
          busy={deleting}
          onView={() => { const row = list.find((r) => r.id === openActionId); if (row) handleView(row); }}
          onEdit={() => { const row = list.find((r) => r.id === openActionId); if (row) handleEdit(row); }}
          onDelete={() => { const row = list.find((r) => r.id === openActionId); if (row) return handleDelete(row); }}
        />
        <ActionMenu
          isOpen={!!openCardActionId}
          onClose={() => { setOpenCardActionId(null); setCardActionAnchorEl(null); }}
          anchorEl={cardActionAnchorEl}
          busy={deleting}
          onView={() => { const row = list.find((r) => r.id === openCardActionId); if (row) handleView(row); }}
          onEdit={() => { const row = list.find((r) => r.id === openCardActionId); if (row) handleEdit(row); }}
          onDelete={() => { const row = list.find((r) => r.id === openCardActionId); if (row) return handleDelete(row); }}
        />

        <div style={styles.tableWrap} className="plan-purchases-table-wrap">
          <table style={styles.table} className="plan-purchases-table">
            <thead>
              <tr>
                <th style={styles.th}><span className="th-content">ID <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Name <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Mobile <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Plan <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Amount <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Status <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : list).map((row) => (
                <tr key={row.id} style={styles.tr}>
                  <td style={styles.td}>{row.cusId || row.customerId || 'N/A'}</td>
                  <td style={styles.td}>{row.name || row.customerName || 'N/A'}</td>
                  <td style={styles.td}>{row.mobile || 'N/A'}</td>
                  <td style={styles.td}>{row.planName || 'N/A'}</td>
                  <td style={styles.td}>₹{row.amount || 0}</td>
                  <td style={styles.td}>
                    <span style={row.status === 'Active' ? styles.badgeActive : styles.badgeInactive}>{row.status || 'Inactive'}</span>
                  </td>
                  <td style={styles.tdAction}>
                    <div style={styles.actionCellWrap}>
                      <button type="button" style={styles.actionTrigger} onClick={() => handleView(row)}>View More</button>
                      <button
                        type="button"
                        style={styles.actionMenuTrigger}
                        onClick={(e) => {
                          setOpenActionId(openActionId === row.id ? null : row.id);
                          setActionAnchorEl(openActionId === row.id ? null : e.currentTarget);
                        }}
                        aria-haspopup="true"
                        aria-expanded={openActionId === row.id}
                      >
                        ⋮
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <p style={{ marginBottom: 16, color: '#666' }}>Loading plan purchases…</p>}

        <div style={styles.pagination} className="plan-purchases-pagination">
          <span style={styles.pageInfo}>Showing page {currentPage} / {totalPages}</span>
          <div style={styles.paginationControls} className="pagination-controls">
            <button style={styles.pagBtn} disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button>
            <button style={{ ...styles.pagBtn, ...(currentPage === 1 ? styles.pagBtnActive : {}) }} onClick={() => setCurrentPage(1)}>1</button>
            <button style={styles.pagBtn}>...</button>
            <button style={styles.pagBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</button>
          </div>
        </div>
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
  headerIcons: { display: 'flex', alignItems: 'center', gap: '10px' },
  iconButton: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: LIGHT_GRAY, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666', fontSize: '18px', position: 'relative' },
  notifBadge: { position: 'absolute', top: '6px', right: '8px', minWidth: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ff4444', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  avatar: { width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  addBtn: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', marginBottom: '20px', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '700px' },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#333', backgroundColor: '#fafafa', borderBottom: `1px solid ${BORDER_GRAY}` },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  badgeActive: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: '500' },
  badgeInactive: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: '500' },
  tdAction: { padding: '14px 16px', fontSize: '14px', position: 'relative' },
  actionCellWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  actionTrigger: { color: MAROON, fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '14px', marginRight: '4px' },
  actionMenuTrigger: { background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '18px', color: '#666', lineHeight: 1 },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' },
  modalBox: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER_GRAY}` },
  modalTitle: { fontSize: '20px', fontWeight: '700', color: '#111', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '12px', fontSize: '14px' },
  modalLabel: { fontWeight: '500', color: '#4b5563' },
  modalValue: { fontWeight: '700', color: '#111' },
  detailSection: { marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${BORDER_GRAY}` },
  sectionTitle: { fontSize: '16px', fontWeight: '700', color: MAROON, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' },
  detailItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  detailLabel: { fontSize: '12px', color: '#666', fontWeight: '500' },
  detailValue: { fontSize: '14px', color: '#111', fontWeight: '600' },
  proofImage: { width: '100%', height: 'auto', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, marginTop: '8px', maxHeight: '200px', objectFit: 'cover' },
  modalBtnCancel: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #9ca3af', backgroundColor: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  modalBtnPrimary: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  pageInfo: { fontSize: '14px', color: '#333' },
  paginationControls: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  pagBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: LIGHT_GRAY, color: '#333', fontSize: '14px', cursor: 'pointer', minWidth: '36px' },
  pagBtnActive: { backgroundColor: MAROON, color: '#fff' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },
};

export default PlanPurchases;
