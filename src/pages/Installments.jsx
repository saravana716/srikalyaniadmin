import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import { FiSettings, FiBell, FiMenu, FiX } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown, MdMonetizationOn, MdCalendarToday, MdBuild } from 'react-icons/md';
import { subscribeCustomers } from '../services/customersService';
import { subscribeInstallments, addInstallment as addInstallmentToDb, updateInstallment as updateInstallmentInDb, deleteInstallment as deleteInstallmentFromDb } from '../services/installmentsService';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

const statusToColor = (status) => {
  if (!status) return '#6b7280';
  const s = status.toLowerCase();
  if (s === 'paid' || s === 'completed') return '#16a34a';
  if (s === 'pending') return '#dc2626';
  if (s === 'due soon') return '#eab308';
  return MAROON;
};

const schemeCards = [
  { label: 'Gold Saving', duration: '12 Months', icon: MdMonetizationOn, gradient: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)' },
  { label: 'Monthly Plan', duration: '12 Months', icon: MdCalendarToday, gradient: 'linear-gradient(135deg, #f97316 0%, #e11d48 100%)' },
  { label: 'Custom', duration: 'Flexible', icon: MdBuild, gradient: 'linear-gradient(135deg, #ea580c 0%, #be123c 100%)' },
];

const InstallmentViewModal = ({ row, onClose, onCancel, onDownload, onSend, onEdit }) => {
  const [alertOption, setAlertOption] = useState('reminder');
  if (!row) return null;

  const details = [
    { label: 'Installment No:', value: row.installmentNo },
    { label: 'Due Date:', value: row.dueDate },
    { label: 'Paid Date:', value: row.paidDate },
    { label: 'Amount:', value: row.amount },
    { label: 'Mode:', value: row.mode },
    { label: 'Status:', value: row.status },
  ];

  return (
    <div style={styles.modalOverlay} className="installment-view-modal-overlay" onClick={onClose}>
      <div style={styles.modalBox} className="installment-view-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>View more</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <h3 style={styles.modalSectionTitle}>Installment Details</h3>
          <div style={styles.modalDetails} className="installment-view-modal-details">
            {details.map(({ label, value }) => (
              <div key={label} style={styles.modalRow}>
                <span style={styles.modalLabel}>{label}</span>
                <span style={styles.modalValue}>{value}</span>
              </div>
            ))}
          </div>
          <h3 style={{ ...styles.modalSectionTitle, marginTop: '24px' }}>Alerts & Actions</h3>
          <div style={styles.radioGroup}>
            <label style={styles.radioLabel}>
              <input type="radio" name="alert" value="reminder" checked={alertOption === 'reminder'} onChange={() => setAlertOption('reminder')} style={styles.radioInput} />
              <span style={alertOption === 'reminder' ? styles.radioTextSelected : styles.radioText}>Send Payment Reminder</span>
            </label>
            <label style={styles.radioLabel}>
              <input type="radio" name="alert" value="receipt" checked={alertOption === 'receipt'} onChange={() => setAlertOption('receipt')} style={styles.radioInput} />
              <span style={alertOption === 'receipt' ? styles.radioTextSelected : styles.radioText}>Send Receipt (SMS / WhatsApp)</span>
            </label>
            <label style={styles.radioLabel}>
              <input type="radio" name="alert" value="cancel" checked={alertOption === 'cancel'} onChange={() => setAlertOption('cancel')} style={styles.radioInput} />
              <span style={alertOption === 'cancel' ? styles.radioTextSelected : styles.radioText}>Cancel Scheme</span>
            </label>
          </div>
        </div>
        <div style={styles.modalFooter} className="installment-view-modal-footer">
          {onEdit && <button type="button" style={styles.modalBtnPrimary} onClick={() => { onClose(); onEdit(row); }}>Edit</button>}
          <button type="button" style={styles.modalBtnPrimary} onClick={onDownload}>Download Statement / Invoice</button>
          <button type="button" style={styles.modalBtnCancel} onClick={onCancel}>Cancel</button>
          <button type="button" style={styles.modalBtnPrimary} onClick={onSend}>Send</button>
        </div>
      </div>
    </div>
  );
};

const AddEditInstallmentModal = ({ installment, onClose, onSave, error, saving }) => {
  const isEdit = !!installment;
  const [installmentNo, setInstallmentNo] = useState(installment?.installmentNo ?? '');
  const [dueDate, setDueDate] = useState(installment?.dueDate ?? '');
  const [paidDate, setPaidDate] = useState(installment?.paidDate ?? '');
  const [amount, setAmount] = useState(installment?.amount ?? '');
  const [mode, setMode] = useState(installment?.mode ?? 'Cash');
  const [status, setStatus] = useState(installment?.status ?? 'Pending');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    await onSave({ installmentNo, dueDate, paidDate, amount, mode, status }, installment?.id);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Edit Installment' : 'Add Installment'}</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Installment No</label>
            <input type="text" value={installmentNo} onChange={(e) => setInstallmentNo(e.target.value)} style={styles.formInput} placeholder="e.g. 123456" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Due Date</label>
            <input type="text" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={styles.formInput} placeholder="e.g. 05-Jan-2025" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Paid Date</label>
            <input type="text" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} style={styles.formInput} placeholder="e.g. 05-Jan-2025" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Amount</label>
            <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.formInput} placeholder="e.g. ₹ 100" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} style={styles.formSelect}>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Bank">Bank</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.formSelect}>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Completed">Completed</option>
              <option value="Due Soon">Due Soon</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} style={styles.modalBtnCancel}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText={isEdit ? 'Updating…' : 'Adding…'} style={styles.modalBtnPrimary}>
              {isEdit ? 'Update' : 'Add Installment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Installments = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewModalRow, setViewModalRow] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingInstallments, setLoadingInstallments] = useState(true);
  const [showAddInstallmentModal, setShowAddInstallmentModal] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionAnchorEl, setActionAnchorEl] = useState(null);

  useEffect(() => {
    const unsub = subscribeCustomers((list) => {
      setCustomers(list.map((r) => ({ id: r.id, customerId: r.cusId, customerName: r.name, mobile: r.mobile, address: r.address || '' })));
      setLoadingCustomers(false);
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    const unsub = subscribeInstallments((list) => {
      setInstallments(list.map((r) => ({ ...r, statusColor: statusToColor(r.status) })));
      setLoadingInstallments(false);
    });
    return () => unsub();
  }, []);

  const handleSaveInstallment = async (data, id) => {
    setSaveError(null);
    setSaving(true);
    try {
      if (id) {
        await updateInstallmentInDb(id, data);
        setEditingInstallment(null);
      } else {
        await addInstallmentToDb(data);
        setShowAddInstallmentModal(false);
      }
    } catch (e) {
      console.error('Save installment failed', e);
      setSaveError(e?.message || 'Failed to save installment');
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteInstallment = async (row) => {
    if (!row?.id) return;
    if (!window.confirm('Delete this installment?')) return;
    setDeleting(true);
    try {
      await deleteInstallmentFromDb(row.id);
      setOpenActionId(null);
      setViewModalRow(null);
    } catch (e) {
      console.error('Delete installment failed', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container installments-page">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {viewModalRow && (
        <InstallmentViewModal
          row={viewModalRow}
          onClose={() => setViewModalRow(null)}
          onCancel={() => setViewModalRow(null)}
          onDownload={() => setViewModalRow(null)}
          onSend={() => setViewModalRow(null)}
          onEdit={(row) => { setViewModalRow(null); setEditingInstallment(row); }}
        />
      )}
      {showAddInstallmentModal && (
        <AddEditInstallmentModal
          onClose={() => { if (!saving) { setShowAddInstallmentModal(false); setSaveError(null); } }}
          onSave={handleSaveInstallment}
          error={saveError}
          saving={saving}
        />
      )}
      {editingInstallment && (
        <AddEditInstallmentModal
          installment={editingInstallment}
          onClose={() => { if (!saving) { setEditingInstallment(null); setSaveError(null); } }}
          onSave={handleSaveInstallment}
          error={saveError}
          saving={saving}
        />
      )}

      <main style={styles.main} className="dashboard-main installments-main">
        <header style={styles.header} className="dashboard-header installments-header">
          <div style={styles.headerRow}>
            <button style={styles.hamburger} className="mobile-hamburger" onClick={() => setIsSidebarOpen(true)}>
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Installments</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <button type="button" style={styles.addInstallmentBtn} onClick={() => setShowAddInstallmentModal(true)}>+ Add Installment</button>
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

        {/* Scheme / Plan Details */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Scheme / Plan Details</h2>
          <div style={styles.schemeCardsRow} className="installments-scheme-cards">
            {schemeCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} style={{ ...styles.schemeCard, background: card.gradient }} className="installments-scheme-card">
                  <span style={styles.schemeCardLabel}>{card.label}</span>
                  <span style={styles.schemeCardDuration}>{card.duration}</span>
                  <div style={styles.schemeCardIcon}><Icon size={32} color="rgba(255,255,255,0.9)" /></div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Customer Information */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Customer Information</h2>
          <div style={styles.tableWrap} className="installments-customer-table-wrap">
            <table style={styles.table} className="installments-customer-table">
              <thead>
                <tr>
                  <th style={styles.th}><span className="th-content">Customer ID <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                  <th style={styles.th}><span className="th-content">Customer Name <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                  <th style={styles.th}><span className="th-content">Mobile Number <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                  <th style={styles.th}><span className="th-content">Adderes <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                  <th style={styles.th}>ID Proof</th>
                </tr>
              </thead>
              <tbody>
                {(loadingCustomers ? [] : customers).map((row) => (
                  <tr key={row.id} style={styles.tr}>
                    <td style={styles.td}>{row.customerId}</td>
                    <td style={styles.td}>{row.customerName}</td>
                    <td style={styles.td}>{row.mobile}</td>
                    <td style={styles.td}>{row.address || '—'}</td>
                    <td style={styles.td}><button type="button" style={styles.uploadBtn}>Upload</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="installments-customer-cards" style={styles.cardsWrap}>
            {(loadingCustomers ? [] : customers).map((row) => (
              <div key={row.id} style={styles.customerCard} className="installments-customer-card">
                <div style={styles.cardRow}><span style={styles.cardLabel}>Customer ID</span><span>{row.customerId}</span></div>
                <div style={styles.cardRow}><span style={styles.cardLabel}>Customer Name</span><span>{row.customerName}</span></div>
                <div style={styles.cardRow}><span style={styles.cardLabel}>Mobile</span><span>{row.mobile}</span></div>
                <div style={styles.cardRow}><span style={styles.cardLabel}>Address</span><span>{row.address}</span></div>
                <button type="button" style={styles.uploadBtn}>Upload</button>
              </div>
            ))}
          </div>
        </section>

        {/* Installment History */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Installment History</h2>
          <ActionMenu
            isOpen={!!openActionId}
            onClose={() => { setOpenActionId(null); setActionAnchorEl(null); }}
            anchorEl={actionAnchorEl}
            busy={deleting}
            onView={() => { const row = installments.find((r) => r.id === openActionId); if (row) setViewModalRow(row); setOpenActionId(null); }}
            onEdit={() => { const row = installments.find((r) => r.id === openActionId); if (row) { setOpenActionId(null); setEditingInstallment(row); } }}
            onDelete={() => { const row = installments.find((r) => r.id === openActionId); if (row) return handleDeleteInstallment(row); }}
          />
          {loadingInstallments && <p style={{ marginBottom: 16, color: '#666' }}>Loading installments…</p>}
          <div style={styles.tableWrap} className="installments-history-table-wrap">
            <table style={styles.table} className="installments-history-table">
              <thead>
                <tr>
                  <th style={styles.th}><span className="th-content">Installment No <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                  <th style={styles.th}><span className="th-content">Due Date <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                  <th style={styles.th}><span className="th-content">Paid Date <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                  <th style={styles.th}><span className="th-content">Amount <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                  <th style={styles.th}><span className="th-content">Mode <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                  <th style={styles.th}><span className="th-content">Status <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(loadingInstallments ? [] : installments).map((row) => (
                  <tr key={row.id} style={styles.tr}>
                    <td style={styles.td}>{row.installmentNo}</td>
                    <td style={styles.td}>{row.dueDate}</td>
                    <td style={styles.td}>{row.paidDate}</td>
                    <td style={styles.td}>{row.amount}</td>
                    <td style={styles.td}>{row.mode}</td>
                    <td style={styles.td}>
                      <span style={styles.statusBadge}>
                        <span style={{ ...styles.statusDot, backgroundColor: row.statusColor }} />
                        {row.status}
                      </span>
                    </td>
                    <td style={styles.tdAction}>
                      <div style={styles.actionCellWrap}>
                        <button type="button" style={styles.viewMoreLink} onClick={() => setViewModalRow(row)}>View More</button>
                        <button type="button" style={styles.actionMenuTrigger} onClick={(e) => { setOpenActionId(openActionId === row.id ? null : row.id); setActionAnchorEl(openActionId === row.id ? null : e.currentTarget); }} aria-haspopup="true">⋮</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="installments-history-cards" style={styles.cardsWrap}>
            {(loadingInstallments ? [] : installments).map((row) => (
              <div key={row.id} style={styles.historyCard} className="installments-history-card">
                <div style={styles.cardRow}><span style={styles.cardLabel}>Installment No</span><span>{row.installmentNo}</span></div>
                <div style={styles.cardRow}><span style={styles.cardLabel}>Due Date</span><span>{row.dueDate}</span></div>
                <div style={styles.cardRow}><span style={styles.cardLabel}>Amount</span><span>{row.amount}</span></div>
                <div style={styles.cardRow}><span style={styles.cardLabel}>Status</span>
                  <span style={styles.statusBadge}><span style={{ ...styles.statusDot, backgroundColor: row.statusColor }} />{row.status}</span>
                </div>
                <button type="button" style={styles.viewMoreLink} onClick={() => setViewModalRow(row)}>View More</button>
              </div>
            ))}
          </div>
        </section>
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
  addInstallmentBtn: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' },
  tdAction: { padding: '14px 16px', fontSize: '14px', position: 'relative' },
  actionCellWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  actionMenuTrigger: { background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '18px', color: '#666', lineHeight: 1 },

  section: { marginBottom: '28px' },
  sectionTitle: { fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '16px', marginTop: 0 },
  schemeCardsRow: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  schemeCard: { flex: '1', minWidth: '180px', borderRadius: '12px', padding: '20px', color: '#fff', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
  schemeCardLabel: { display: 'block', fontSize: '20px', fontWeight: '700', marginBottom: '8px' },
  schemeCardDuration: { display: 'block', fontSize: '14px', opacity: 0.95 },
  schemeCardIcon: { position: 'absolute', top: '16px', right: '16px', opacity: 0.9 },

  tableWrap: { overflowX: 'auto', marginBottom: '0', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#333', backgroundColor: '#fafafa', borderBottom: `1px solid ${BORDER_GRAY}` },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  uploadBtn: { padding: '6px 14px', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg, #f97316 0%, ${MAROON} 100%)`, color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  statusBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  viewMoreLink: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '14px', color: '#64748b', fontWeight: '500' },

  cardsWrap: { display: 'none' },
  customerCard: { border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px', padding: '16px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  historyCard: { border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px', padding: '16px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardRow: { display: 'flex', justifyContent: 'space-between', fontSize: '14px' },
  cardLabel: { color: '#666', marginRight: '8px' },

  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' },
  modalBox: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxWidth: '540px', width: '100%', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER_GRAY}` },
  modalTitle: { fontSize: '20px', fontWeight: '700', color: '#111', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: '24px' },
  modalSectionTitle: { fontSize: '16px', fontWeight: '700', color: '#111', marginBottom: '16px', marginTop: 0 },
  modalDetails: { display: 'flex', flexDirection: 'column', gap: '12px' },
  modalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' },
  modalLabel: { fontSize: '14px', fontWeight: '500', color: '#4b5563', flexShrink: 0 },
  modalValue: { fontSize: '14px', fontWeight: '700', color: '#111', textAlign: 'right' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: '12px' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' },
  radioInput: { width: '18px', height: '18px', accentColor: MAROON },
  radioText: { color: '#374151' },
  radioTextSelected: { color: MAROON, fontWeight: '600' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: `1px solid ${BORDER_GRAY}`, flexWrap: 'wrap' },
  modalBtnCancel: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #9ca3af', backgroundColor: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  modalBtnPrimary: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },
};

export default Installments;
