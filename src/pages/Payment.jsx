import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import { FiSettings, FiBell, FiMenu, FiX, FiSearch } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import {
  subscribeAllPayments,
  addPayment as addPaymentToDb,
  updateUnifiedPayment,
  deleteUnifiedPayment,
} from '../services/paymentsService';
import { formatINR } from '../utils/currencyUtils';
import { downloadPaymentReceipt } from '../utils/paymentReceiptPdf';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';
const PAGE_SIZE = 10;

function displayMoney(value) {
  if (value == null || value === '') return '—';
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(n) && String(value).replace(/[^0-9.]/g, '') !== '') return formatINR(n);
  return String(value);
}

function statusStyle(status, styles) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed' || s === 'paid') return styles.badgeCompleted;
  return styles.badgePending;
}

const AddEditPaymentModal = ({ payment, onClose, onSave, error, saving }) => {
  const isEdit = !!payment;
  const [customerName, setCustomerName] = useState(payment?.customerName ?? '');
  const [chitPlan, setChitPlan] = useState(payment?.chitPlan ?? '');
  const [dueAmount, setDueAmount] = useState(payment?.dueAmount ?? '');
  const [paidAmount, setPaidAmount] = useState(payment?.paidAmount ?? '');
  const [dueDate, setDueDate] = useState(payment?.dueDate ?? '');
  const [mode, setMode] = useState(payment?.mode && payment.mode !== '—' ? payment.mode : 'Cash');
  const [status, setStatus] = useState(
    payment?.status === 'Paid' ? 'Completed' : (payment?.status ?? 'Pending')
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    await onSave(
      { customerName, chitPlan, dueAmount, paidAmount, dueDate, paidDate: dueDate, mode, status },
      payment
    );
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Edit Payment' : 'Add Payment'}</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} disabled={saving} aria-label="Close">
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
            <input type="text" value={dueAmount} onChange={(e) => setDueAmount(e.target.value)} style={styles.formInput} placeholder="e.g. 10000" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Paid Amount</label>
            <input type="text" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} style={styles.formInput} placeholder="e.g. 10000" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Due / Paid Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={styles.formInput} required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} style={styles.formSelect}>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.formSelect}>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div className="app-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText={isEdit ? 'Updating…' : 'Adding…'}>
              {isEdit ? 'Update' : 'Add Payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PaymentViewModal = ({ payment, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  if (!payment) return null;

  const rows = [
    { label: 'Source:', value: payment.sourceLabel || payment.source },
    { label: 'Customer Name:', value: payment.customerName || '—' },
    { label: 'Customer ID:', value: payment.cusId || '—' },
    { label: 'Chit Plan:', value: payment.chitPlan || '—' },
    { label: 'Due Amount:', value: displayMoney(payment.dueAmount) },
    { label: 'Paid Amount:', value: displayMoney(payment.paidAmount) },
    { label: 'Due Date:', value: payment.dueDate || '—' },
    { label: 'Paid Date:', value: payment.paidDate || '—' },
    { label: 'Mode:', value: payment.mode || '—' },
    { label: 'Status:', value: payment.status || '—' },
    { label: 'Note:', value: payment.note || '—' },
  ];

  const handleDownload = async () => {
    if (downloading) return;
    setDownloadError('');
    setDownloading(true);
    try {
      await downloadPaymentReceipt(payment);
    } catch (e) {
      console.error('Receipt download failed', e);
      setDownloadError(e?.message || 'Failed to download receipt');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={styles.paymentViewOverlay} className="payment-view-modal-overlay" onClick={onClose}>
      <div style={styles.paymentViewPanel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Payment Details</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.modalDetails}>
            {rows.map(({ label, value }) => (
              <div key={label} style={styles.modalRow}>
                <span style={styles.modalLabel}>{label}</span>
                <span style={styles.modalValue}>{value}</span>
              </div>
            ))}
          </div>
          {downloadError ? <p style={{ color: '#dc2626', fontSize: 13, marginTop: 16 }}>{downloadError}</p> : null}
        </div>
        <div style={styles.modalFooter} className="app-modal-footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={downloading}>Close</Button>
          <Button
            type="button"
            onClick={handleDownload}
            loading={downloading}
            loadingText="Preparing…"
          >
            Download Receipt
          </Button>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  useEffect(() => {
    const unsub = subscribeAllPayments((list) => {
      setPayments(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return payments.filter((row) => {
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
      if (!q) return true;
      const hay = [row.customerName, row.cusId, row.chitPlan, row.mode, row.status, row.sourceLabel, row.paidAmount]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [payments, searchQuery, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sourceFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const rowKey = (row) => `${row.source}:${row.id}`;

  const findRow = (key) => payments.find((r) => rowKey(r) === key);

  const handleView = (row) => {
    setOpenActionId(null);
    setOpenCardActionId(null);
    setViewModalPayment(row);
  };

  const handleEdit = (row) => {
    if (!row?._canEdit || row._fromLedger) {
      alert('This Add Cash entry is managed from the Customers page.');
      return;
    }
    setOpenActionId(null);
    setOpenCardActionId(null);
    setEditingPayment(row);
  };

  const handleSavePayment = async (data, existingRow) => {
    setSaveError(null);
    setSaving(true);
    try {
      if (existingRow?.id) {
        await updateUnifiedPayment(existingRow, data);
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
    if (!row._canDelete || row._fromLedger) {
      alert('This Add Cash entry cannot be deleted from Payment. Manage it from Customers.');
      return;
    }
    if (!window.confirm('Delete this payment?')) return;
    setDeleting(true);
    try {
      await deleteUnifiedPayment(row);
      setOpenActionId(null);
      setOpenCardActionId(null);
      setViewModalPayment(null);
    } catch (e) {
      console.error('Delete payment failed', e);
      alert(e?.message || 'Failed to delete payment');
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
            <Button type="button" onClick={() => setShowAddPaymentModal(true)}>+ Add Payment</Button>
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

        <div style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <FiSearch style={{ color: '#999' }} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, plan, mode, ID…"
              style={styles.searchInput}
            />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={styles.sourceSelect}
            aria-label="Filter by source"
          >
            <option value="all">All Sources</option>
            <option value="payment">Manual Payments</option>
            <option value="installment">Installments</option>
            <option value="customer_cash">Add Cash</option>
          </select>
        </div>

        <p style={styles.resultMeta}>
          Showing {pageRows.length} of {filtered.length} payment{filtered.length === 1 ? '' : 's'}
          {filtered.length !== payments.length ? ` (filtered from ${payments.length})` : ''}
        </p>

        <div style={styles.tableWrap} className="payment-table-wrap">
          <table style={styles.table} className="payment-table">
            <thead>
              <tr>
                <th style={styles.th}><span className="th-content">Customer <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Plan <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Source <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Paid Amount <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Mode <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Date <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Status <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : pageRows).map((row) => (
                <tr key={rowKey(row)} style={styles.tr}>
                  <td style={styles.td}>
                    <div>{row.customerName || '—'}</div>
                    {row.cusId ? <div style={styles.subText}>{row.cusId}</div> : null}
                  </td>
                  <td style={styles.td}>{row.chitPlan || '—'}</td>
                  <td style={styles.td}>
                    <span style={styles.sourcePill}>{row.sourceLabel}</span>
                  </td>
                  <td style={styles.td}>{displayMoney(row.paidAmount)}</td>
                  <td style={styles.td}>{row.mode || '—'}</td>
                  <td style={styles.td}>{row.paidDate || row.dueDate || '—'}</td>
                  <td style={styles.td}>
                    <span style={statusStyle(row.status, styles)}>
                      {row.status === 'Paid' ? 'Completed' : row.status}
                    </span>
                  </td>
                  <td style={styles.tdAction}>
                    <div style={styles.actionCellWrap}>
                      <button type="button" style={styles.actionTrigger} onClick={() => handleView(row)}>
                        View More
                      </button>
                      <button
                        type="button"
                        style={styles.actionMenuTrigger}
                        onClick={(e) => {
                          const key = rowKey(row);
                          setOpenActionId(openActionId === key ? null : key);
                          setActionAnchorEl(openActionId === key ? null : e.currentTarget);
                        }}
                        aria-haspopup="true"
                        aria-expanded={openActionId === rowKey(row)}
                      >
                        ⋮
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td style={{ ...styles.td, textAlign: 'center', padding: 24 }} colSpan={8}>
                    No payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <ActionMenu
          isOpen={!!openActionId}
          onClose={() => { setOpenActionId(null); setActionAnchorEl(null); }}
          anchorEl={actionAnchorEl}
          busy={deleting}
          onView={() => { const row = findRow(openActionId); if (row) handleView(row); }}
          onEdit={() => { const row = findRow(openActionId); if (row) handleEdit(row); }}
          onDelete={() => { const row = findRow(openActionId); if (row) return handleDelete(row); }}
        />

        <ActionMenu
          isOpen={!!openCardActionId}
          onClose={() => { setOpenCardActionId(null); setCardActionAnchorEl(null); }}
          anchorEl={cardActionAnchorEl}
          busy={deleting}
          onView={() => { const row = findRow(openCardActionId); if (row) handleView(row); }}
          onEdit={() => { const row = findRow(openCardActionId); if (row) handleEdit(row); }}
          onDelete={() => { const row = findRow(openCardActionId); if (row) return handleDelete(row); }}
        />

        {loading && <p style={{ marginBottom: 16, color: '#666' }}>Loading payments…</p>}

        <div className="payment-cards" style={styles.cardsWrap}>
          {(loading ? [] : pageRows).map((row) => (
            <div key={`card-${rowKey(row)}`} style={styles.paymentCard} className="payment-card">
              <div style={styles.cardRow}><span style={styles.cardLabel}>Customer</span><span>{row.customerName || '—'}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Plan</span><span>{row.chitPlan || '—'}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Source</span><span style={styles.sourcePill}>{row.sourceLabel}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Paid</span><span>{displayMoney(row.paidAmount)}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Mode</span><span>{row.mode || '—'}</span></div>
              <div style={styles.cardRow}><span style={styles.cardLabel}>Status</span>
                <span style={statusStyle(row.status, styles)}>{row.status === 'Paid' ? 'Completed' : row.status}</span>
              </div>
              <div style={styles.cardActions}>
                <button type="button" style={styles.actionTrigger} onClick={() => handleView(row)}>View More</button>
                <button
                  type="button"
                  style={styles.actionMenuTrigger}
                  onClick={(e) => {
                    const key = rowKey(row);
                    setOpenCardActionId(openCardActionId === key ? null : key);
                    setCardActionAnchorEl(openCardActionId === key ? null : e.currentTarget);
                  }}
                >
                  ⋮
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.pagination} className="payment-pagination">
          <span style={styles.pageInfo}>Showing page {currentPage} / {totalPages}</span>
          <div style={styles.paginationControls} className="pagination-controls">
            <button style={styles.pagBtn} disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button>
            <button style={{ ...styles.pagBtn, ...(currentPage === 1 ? styles.pagBtnActive : {}) }} onClick={() => setCurrentPage(1)}>1</button>
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '20px', flexWrap: 'wrap' },
  headerRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  pageTitle: { fontSize: '28px', color: '#1f2937', fontWeight: '700' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  headerIcons: { display: 'flex', alignItems: 'center', gap: '12px' },
  iconButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', position: 'relative' },
  notifBadge: { position: 'absolute', top: '-4px', right: '-4px', backgroundColor: MAROON, color: '#fff', fontSize: '10px', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: '36px', height: '36px', borderRadius: '50%' },
  hamburger: { display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  toolbar: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, backgroundColor: LIGHT_GRAY, borderRadius: 8, padding: '8px 14px', minWidth: 240, flex: '1 1 240px', maxWidth: 420 },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: 14, width: '100%', color: '#333' },
  sourceSelect: { padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER_GRAY}`, fontSize: 14, backgroundColor: '#fff', color: '#333', cursor: 'pointer' },
  resultMeta: { margin: '0 0 12px', fontSize: 13, color: '#6b7280' },
  tableWrap: { overflowX: 'auto', marginBottom: 20, border: `1px solid ${BORDER_GRAY}`, borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 920 },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#333', backgroundColor: '#fafafa', borderBottom: `1px solid ${BORDER_GRAY}` },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { padding: '14px 16px', fontSize: 14, color: '#333' },
  subText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  tdAction: { padding: '14px 16px' },
  actionCellWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  actionTrigger: { color: MAROON, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14 },
  actionMenuTrigger: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#666', padding: '0 4px' },
  badgeCompleted: { display: 'inline-block', padding: '4px 12px', borderRadius: 9999, backgroundColor: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 500 },
  badgePending: { display: 'inline-block', padding: '4px 12px', borderRadius: 9999, backgroundColor: MAROON, color: '#fff', fontSize: 13, fontWeight: 500 },
  sourcePill: { display: 'inline-block', padding: '3px 10px', borderRadius: 9999, backgroundColor: '#fce7f0', color: MAROON, fontSize: 12, fontWeight: 600 },
  cardsWrap: { display: 'none' },
  paymentCard: { border: `1px solid ${BORDER_GRAY}`, borderRadius: 8, padding: 16, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  cardRow: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 },
  cardLabel: { color: '#6b7280', fontWeight: 500 },
  cardActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  pageInfo: { fontSize: 14, color: '#666' },
  paginationControls: { display: 'flex', gap: 8 },
  pagBtn: { padding: '8px 14px', borderRadius: 8, border: `1px solid ${BORDER_GRAY}`, background: '#fff', cursor: 'pointer', fontSize: 14 },
  pagBtnActive: { backgroundColor: MAROON, color: '#fff', borderColor: MAROON },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: `1px solid ${BORDER_GRAY}` },
  modalTitle: { fontSize: 20, fontWeight: 700, color: '#111', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666' },
  formGroup: { marginBottom: 14 },
  formLabel: { display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 },
  formInput: { width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER_GRAY}`, fontSize: 14, boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER_GRAY}`, fontSize: 14, boxSizing: 'border-box' },
  paymentViewOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 1100 },
  paymentViewPanel: { width: '100%', maxWidth: 420, backgroundColor: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', overflow: 'auto', display: 'flex', flexDirection: 'column' },
  modalBody: { padding: 24, flex: 1 },
  modalDetails: { display: 'flex', flexDirection: 'column', gap: 12 },
  modalRow: { display: 'flex', justifyContent: 'space-between', gap: 16 },
  modalLabel: { fontSize: 14, fontWeight: 500, color: '#4b5563' },
  modalValue: { fontSize: 14, fontWeight: 700, color: '#111', textAlign: 'right' },
  modalFooter: { padding: '16px 20px', borderTop: `1px solid ${BORDER_GRAY}`, display: 'flex', justifyContent: 'flex-end', gap: 10 },
};

export default Payment;
