import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import { FiSettings, FiBell, FiMenu, FiX } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import { subscribePayments, addPayment as addPaymentToDb, updatePayment as updatePaymentInDb, deletePayment as deletePaymentFromDb } from '../services/paymentsService';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

const AddEditPaymentModal = ({ payment, onClose, onSave, error, saving }) => {
  const isEdit = !!payment;
  const [customerName, setCustomerName] = useState(payment?.customerName ?? '');
  const [chitPlan, setChitPlan] = useState(payment?.chitPlan ?? '');
  const [dueAmount, setDueAmount] = useState(payment?.dueAmount ?? '');
  const [paidAmount, setPaidAmount] = useState(payment?.paidAmount ?? '');
  const [dueDate, setDueDate] = useState(payment?.dueDate ?? '');
  const [status, setStatus] = useState(payment?.status ?? 'Pending');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    await onSave({ customerName, chitPlan, dueAmount, paidAmount, dueDate, status }, payment?.id);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Edit Payment' : 'Add Payment'}</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Customer Name</label>
            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={styles.formInput} placeholder="Customer Name" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Chit Plan</label>
            <input type="text" value={chitPlan} onChange={(e) => setChitPlan(e.target.value)} style={styles.formInput} placeholder="e.g. Basic, Premium" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Due Amount</label>
            <input type="text" value={dueAmount} onChange={(e) => setDueAmount(e.target.value)} style={styles.formInput} placeholder="e.g. ₹ 10,000" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Paid Amount</label>
            <input type="text" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} style={styles.formInput} placeholder="e.g. ₹ 10,000" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={styles.formInput} required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.formSelect}>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} style={styles.modalBtnCancel}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText={isEdit ? 'Updating…' : 'Adding…'} style={styles.modalBtnDownload}>
              {isEdit ? 'Update' : 'Add Payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PaymentViewModal = ({ payment, onClose, onCancel, onDownload }) => {
  if (!payment) return null;

  const rows = [
    { label: 'Customer Name:', value: payment.customerName },
    { label: 'Chit Plan:', value: payment.chitPlan },
    { label: 'Due Amount:', value: payment.dueAmount },
    { label: 'Paid Amount:', value: payment.paidAmount },
    { label: 'Due Date:', value: payment.dueDate },
    { label: 'Status:', value: payment.status },
  ];

  return (
    <div style={styles.paymentViewOverlay} className="payment-view-modal-overlay payment-view-more-panel-overlay" onClick={onClose}>
      <div style={styles.paymentViewPanel} className="payment-view-modal-box payment-view-more-panel" onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>View more</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <h3 style={styles.modalSectionTitle}>Payment Details</h3>
          <div style={styles.modalDetails} className="payment-view-modal-details">
            {rows.map(({ label, value }) => (
              <div key={label} style={styles.modalRow}>
                <span style={styles.modalLabel}>{label}</span>
                <span style={styles.modalValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={styles.modalFooter} className="payment-view-modal-footer">
          <button type="button" style={styles.modalBtnCancel} onClick={onCancel}>Cancel</button>
          <button type="button" style={styles.modalBtnDownload} onClick={onDownload}>Download</button>
        </div>
      </div>
    </div>
  );
};

const Payment = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionAnchorEl, setActionAnchorEl] = useState(null);
  const [openCardActionId, setOpenCardActionId] = useState(null);
  const [cardActionAnchorEl, setCardActionAnchorEl] = useState(null);
  const [viewModalPayment, setViewModalPayment] = useState(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const totalPages = Math.max(1, Math.ceil(payments.length / 10));

  useEffect(() => {
    const unsub = subscribePayments(setPayments);
    setLoading(false);
    return () => unsub();
  }, []);

  const handleView = (row) => {
    setOpenActionId(null);
    setOpenCardActionId(null);
    setViewModalPayment(row);
  };
  const handleEdit = (row) => {
    setOpenActionId(null);
    setOpenCardActionId(null);
    setEditingPayment(row);
  };
  const handleSavePayment = async (data, id) => {
    setSaveError(null);
    setSaving(true);
    try {
      if (id) {
        await updatePaymentInDb(id, data);
        setEditingPayment(null);
      } else {
        await addPaymentToDb(data);
        setShowAddPaymentModal(false);
      }
    } catch (e) {
      console.error('Save payment failed', e);
      setSaveError(e?.message || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm('Delete this payment?')) return;
    setDeleting(true);
    try {
      await deletePaymentFromDb(row.id);
      setOpenActionId(null);
      setOpenCardActionId(null);
    } catch (e) {
      console.error('Delete payment failed', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container payment-page">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {viewModalPayment && (
        <PaymentViewModal
          payment={viewModalPayment}
          onClose={() => setViewModalPayment(null)}
          onCancel={() => setViewModalPayment(null)}
          onDownload={() => { setViewModalPayment(null); }}
        />
      )}

      {showAddPaymentModal && (
        <AddEditPaymentModal
          onClose={() => { if (!saving) { setShowAddPaymentModal(false); setSaveError(null); } }}
          onSave={handleSavePayment}
          error={saveError}
          saving={saving}
        />
      )}
      {editingPayment && (
        <AddEditPaymentModal
          payment={editingPayment}
          onClose={() => { if (!saving) { setEditingPayment(null); setSaveError(null); } }}
          onSave={handleSavePayment}
          error={saveError}
          saving={saving}
        />
      )}

      <main style={styles.main} className="dashboard-main payment-main">
        {/* Header */}
        <header style={styles.header} className="dashboard-header payment-header">
          <div style={styles.headerRow}>
            <button
              style={styles.hamburger}
              className="mobile-hamburger"
              onClick={() => setIsSidebarOpen(true)}
            >
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Payment</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <button type="button" style={styles.addPaymentBtn} onClick={() => setShowAddPaymentModal(true)}>+ Add Payment</button>
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

        {/* Table - desktop */}
        <div style={styles.tableWrap} className="payment-table-wrap">
          <table style={styles.table} className="payment-table">
            <thead>
              <tr>
                <th style={styles.th}><span className="th-content">Customer Name <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Chit Plan <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Due Amount <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Paid Amount <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Due Date <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Status <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : payments).map((row) => (
                <tr key={row.id} style={styles.tr}>
                  <td style={styles.td}>{row.customerName}</td>
                  <td style={styles.td}>{row.chitPlan}</td>
                  <td style={styles.td}>{row.dueAmount}</td>
                  <td style={styles.td}>{row.paidAmount}</td>
                  <td style={styles.td}>{row.dueDate}</td>
                  <td style={styles.td}>
                    <span style={row.status === 'Completed' ? styles.badgeCompleted : styles.badgePending}>
                      {row.status}
                    </span>
                  </td>
                  <td style={styles.tdAction}>
                    <div style={styles.actionCellWrap}>
                      <button type="button" style={styles.actionTrigger} onClick={() => handleView(row)}>
                        View More
                      </button>
                      <div style={styles.actionMenuWrap}>
                        <button
                          type="button"
                          style={styles.actionMenuTrigger}
                          onClick={(e) => {
                            const id = row.id;
                            setOpenActionId(openActionId === id ? null : id);
                            setActionAnchorEl(openActionId === id ? null : e.currentTarget);
                          }}
                          aria-haspopup="true"
                          aria-expanded={openActionId === row.id}
                        >
                          ⋮
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ActionMenu
          isOpen={!!openActionId}
          onClose={() => { setOpenActionId(null); setActionAnchorEl(null); }}
          anchorEl={actionAnchorEl}
          busy={deleting}
          onView={() => { const row = payments.find((r) => r.id === openActionId); if (row) handleView(row); }}
          onEdit={() => { const row = payments.find((r) => r.id === openActionId); if (row) handleEdit(row); }}
          onDelete={() => { const row = payments.find((r) => r.id === openActionId); if (row) return handleDelete(row); }}
        />

        {loading && <p style={{ marginBottom: 16, color: '#666' }}>Loading payments…</p>}

        {/* Cards - mobile only */}
        <div className="payment-cards" style={styles.cardsWrap}>
          {(loading ? [] : payments).map((row) => (
            <div key={row.id} style={styles.paymentCard} className="payment-card">
              <div style={styles.cardRow}><span style={styles.cardLabel}>Customer Name</span><span>{row.customerName}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Chit Plan</span><span>{row.chitPlan}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Due Amount</span><span>{row.dueAmount}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Paid Amount</span><span>{row.paidAmount}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Due Date</span><span>{row.dueDate}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Status</span>
                <span style={row.status === 'Completed' ? styles.badgeCompleted : styles.badgePending}>{row.status}</span>
              </div>
              <div style={styles.cardActionWrap}>
                <button type="button" style={styles.actionTrigger} onClick={() => handleView(row)}>View More</button>
                <div style={styles.actionMenuWrap}>
                  <button
                    type="button"
                    style={styles.actionMenuTrigger}
                    onClick={(e) => {
                      const id = row.id;
                      setOpenCardActionId(openCardActionId === id ? null : id);
                      setCardActionAnchorEl(openCardActionId === id ? null : e.currentTarget);
                    }}
                  >
                    ⋮
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <ActionMenu
          isOpen={!!openCardActionId}
          onClose={() => { setOpenCardActionId(null); setCardActionAnchorEl(null); }}
          anchorEl={cardActionAnchorEl}
          busy={deleting}
          onView={() => { const row = payments.find((r) => r.id === openCardActionId); if (row) handleView(row); }}
          onEdit={() => { const row = payments.find((r) => r.id === openCardActionId); if (row) handleEdit(row); }}
          onDelete={() => { const row = payments.find((r) => r.id === openCardActionId); if (row) return handleDelete(row); }}
        />

        {/* Pagination */}
        <div style={styles.pagination} className="payment-pagination">
          <span style={styles.pageInfo}>Showing page {currentPage} / {totalPages}</span>
          <div style={styles.paginationControls} className="pagination-controls">
            <button style={styles.pagBtn} disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button>
            <button style={{ ...styles.pagBtn, ...(currentPage === 1 ? styles.pagBtnActive : {}) }} onClick={() => setCurrentPage(1)}>1</button>
            <button style={{ ...styles.pagBtn, ...(currentPage === 2 ? styles.pagBtnActive : {}) }} onClick={() => setCurrentPage(2)}>2</button>
            <button style={{ ...styles.pagBtn, ...(currentPage === 3 ? styles.pagBtnActive : {}) }} onClick={() => setCurrentPage(3)}>3</button>
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
  pageTitle: { fontSize: '28px', color: '#1f2937', fontWeight: '700' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  searchContainer: { position: 'relative', backgroundColor: LIGHT_GRAY, borderRadius: '24px', padding: '10px 16px', display: 'flex', alignItems: 'center', width: '300px' },
  searchIcon: { color: '#999', marginRight: '8px', fontSize: '18px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '100%', color: '#333' },
  headerIcons: { display: 'flex', alignItems: 'center', gap: '10px' },
  iconButton: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: LIGHT_GRAY, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666', fontSize: '18px', position: 'relative' },
  notifBadge: { position: 'absolute', top: '6px', right: '8px', minWidth: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ff4444', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  avatar: { width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  addPaymentBtn: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' },

  tableWrap: { overflowX: 'auto', marginBottom: '20px', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#333', backgroundColor: '#fafafa', borderBottom: `1px solid ${BORDER_GRAY}` },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  badgeCompleted: { display: 'inline-block', padding: '4px 12px', borderRadius: '9999px', backgroundColor: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: '500' },
  badgePending: { display: 'inline-block', padding: '4px 12px', borderRadius: '9999px', backgroundColor: MAROON, color: '#fff', fontSize: '13px', fontWeight: '500' },
  tdAction: { padding: '14px 16px', fontSize: '14px', position: 'relative' },
  actionCellWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  actionMenuWrap: { position: 'relative', display: 'inline-block' },
  actionTrigger: { color: MAROON, fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '14px', marginRight: '4px' },
  actionMenuTrigger: { background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '18px', color: '#666', lineHeight: 1 },
  actionDropdown: { position: 'absolute', top: '100%', left: 'auto', right: 0, marginTop: '4px', minWidth: '120px', backgroundColor: '#fafafa', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px 0', zIndex: 50, display: 'flex', flexDirection: 'column' },
  actionDropdownPos: {},
  actionDropdownPosCard: { top: 'auto', bottom: '100%', marginTop: 0, marginBottom: '4px' },
  actionItem: { display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: '#333' },
  cardActionWrap: { position: 'relative', marginTop: '12px', display: 'inline-block' },

  cardsWrap: { display: 'none' },
  paymentCard: { border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px', padding: '16px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardRow: { display: 'flex', justifyContent: 'space-between', fontSize: '14px' },
  cardLabel: { color: '#666', marginRight: '8px' },

  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  pageInfo: { fontSize: '14px', color: '#333' },
  paginationControls: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  pagBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: LIGHT_GRAY, color: '#333', fontSize: '14px', cursor: 'pointer', minWidth: '36px' },
  pagBtnActive: { backgroundColor: MAROON, color: '#fff' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },

  paymentViewOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 1100 },
  paymentViewPanel: { width: '100%', maxWidth: '420px', backgroundColor: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', overflow: 'auto', display: 'flex', flexDirection: 'column' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' },
  modalBox: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER_GRAY}` },
  modalTitle: { fontSize: '20px', fontWeight: '700', color: '#111', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: '24px' },
  modalSectionTitle: { fontSize: '16px', fontWeight: '700', color: '#111', marginBottom: '16px', marginTop: 0 },
  modalDetails: { display: 'flex', flexDirection: 'column', gap: '12px' },
  modalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' },
  modalLabel: { fontSize: '14px', fontWeight: '500', color: '#4b5563', flexShrink: 0 },
  modalValue: { fontSize: '14px', fontWeight: '700', color: '#111', textAlign: 'right' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: `1px solid ${BORDER_GRAY}` },
  modalBtnCancel: { padding: '10px 20px', borderRadius: '8px', border: `1px solid #9ca3af`, backgroundColor: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  modalBtnDownload: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
};

export default Payment;
