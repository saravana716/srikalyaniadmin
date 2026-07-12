import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import { FiSettings, FiBell, FiMenu, FiX } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown, MdMonetizationOn, MdStar, MdDiamond } from 'react-icons/md';
import { subscribePlans, addPlan as addPlanToDb, updatePlan as updatePlanInDb, deletePlan as deletePlanFromDb } from '../services/plansService';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

const ViewMoreModal = ({ plan, onClose, onReminder, onNotification }) => {
  if (!plan) return null;

  const rows = [
    { label: 'Name:', value: plan.name || plan.planName },
    { label: 'Type:', value: plan.type },
    { label: 'Description:', value: plan.description },
  ];

  return (
    <div style={styles.viewMoreOverlay} className="view-more-modal-overlay plans-view-more-panel-overlay" onClick={onClose}>
      <div style={styles.viewMorePanel} className="view-more-modal-box plans-view-more-panel" onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>View more</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <h3 style={styles.modalSectionTitle}>Chit Fund Plans</h3>
          <div style={styles.modalDetails} className="view-more-modal-details">
            {rows.map(({ label, value }) => (
              <div key={label} style={styles.modalRow}>
                <span style={styles.modalLabel}>{label}</span>
                <span style={styles.modalValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={styles.modalFooter} className="view-more-modal-footer">
          <button type="button" style={styles.modalBtnReminder} onClick={onReminder}>Reminder</button>
          <button type="button" style={styles.modalBtnNotification} onClick={onNotification}>Notification</button>
        </div>
      </div>
    </div>
  );
};

const summaryCardMeta = [
  { label: 'Daily', icon: MdMonetizationOn, gradient: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)' },
  { label: 'Monthly', icon: MdStar, gradient: 'linear-gradient(135deg, #f97316 0%, #e11d48 100%)' },
  { label: 'Weekly', icon: MdDiamond, gradient: 'linear-gradient(135deg, #ea580c 0%, #be123c 100%)' },
];

function buildSummaryCards(plans) {
  return summaryCardMeta.map((card) => {
    const match = plans.find((p) =>
      (p.type || '').toLowerCase() === card.label.toLowerCase()
    );
    return {
      ...card,
      value: match?.name || (plans.length ? '—' : 'No plans'),
    };
  });
}

const AddEditPlanModal = ({ plan, onClose, onSave, error, saving }) => {
  const isEdit = !!plan;
  const [name, setName] = useState(plan?.name ?? plan?.planName ?? '');
  const [type, setType] = useState(plan?.type ?? 'Daily');
  const [description, setDescription] = useState(plan?.description ?? '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    await onSave({ name, type, description }, plan?.id);
  };

  return (
    <div style={styles.modalOverlay} className="add-edit-plan-modal-overlay" onClick={onClose}>
      <div style={styles.modalBox} className="add-edit-plan-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Edit Plan' : 'Add Plan'}</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={styles.formInput} placeholder="e.g. Daily Gold Saving Plan" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={styles.formSelect} required>
              <option value="Daily">Daily</option>
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...styles.formInput, minHeight: 90 }} placeholder="e.g. Pay for Daily, get gold" required />
          </div>
          <div style={styles.modalFooterForm} className="add-edit-plan-modal-footer">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} style={styles.modalBtnCancel}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText={isEdit ? 'Updating…' : 'Adding…'} style={styles.modalBtnPrimary}>
              {isEdit ? 'Update Plan' : 'Add Plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChitFundPlans = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionAnchorEl, setActionAnchorEl] = useState(null);
  const [openCardActionId, setOpenCardActionId] = useState(null);
  const [cardActionAnchorEl, setCardActionAnchorEl] = useState(null);
  const [viewModalPlan, setViewModalPlan] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const totalPages = Math.max(1, Math.ceil(plans.length / 10));
  const summaryCards = buildSummaryCards(plans);

  useEffect(() => {
    const unsub = subscribePlans(
      (list) => {
        setPlans(list);
        setLoading(false);
        setLoadError(null);
      },
      (err) => {
        setLoading(false);
        setLoadError(err?.message || 'Failed to load plans');
      }
    );
    return () => unsub();
  }, []);

  const handleView = (row) => {
    setOpenActionId(null);
    setOpenCardActionId(null);
    setViewModalPlan(row);
  };
  const handleEdit = (row) => {
    setOpenActionId(null);
    setOpenCardActionId(null);
    setEditingPlan(row);
    setShowPlanModal(true);
  };
  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete plan "${row.name || row.planName}"?`)) return;
    setDeleting(true);
    try {
      await deletePlanFromDb(row.id);
      setOpenActionId(null);
      setOpenCardActionId(null);
    } catch (e) {
      console.error('Delete plan failed', e);
      alert(e?.message || 'Failed to delete plan');
    } finally {
      setDeleting(false);
    }
  };

  const handleSavePlan = async (data, id) => {
    setSaveError(null);
    setSaving(true);
    try {
      if (id) {
        await updatePlanInDb(id, data);
      } else {
        await addPlanToDb(data);
      }
      setShowPlanModal(false);
      setEditingPlan(null);
    } catch (e) {
      console.error('Save plan failed', e);
      setSaveError(e?.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container plans-page">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {showPlanModal && (
        <AddEditPlanModal
          plan={editingPlan}
          onClose={() => { if (!saving) { setShowPlanModal(false); setEditingPlan(null); setSaveError(null); } }}
          onSave={handleSavePlan}
          error={saveError}
          saving={saving}
        />
      )}

      {viewModalPlan && (
        <ViewMoreModal
          plan={viewModalPlan}
          onClose={() => setViewModalPlan(null)}
          onReminder={() => setViewModalPlan(null)}
          onNotification={() => setViewModalPlan(null)}
        />
      )}

      <main style={styles.main} className="dashboard-main plans-main">
        {/* Header */}
        <header style={styles.header} className="dashboard-header plans-header">
          <div style={styles.headerRow}>
            <button
              style={styles.hamburger}
              className="mobile-hamburger"
              onClick={() => setIsSidebarOpen(true)}
            >
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Chit Fund Plans</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
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

        {/* Plan Summary Cards */}
        <div style={styles.cardsRow} className="plans-cards-row">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} style={{ ...styles.summaryCard, background: card.gradient }} className="plans-summary-card">
                <span style={styles.summaryCardLabel}>{card.label}</span>
                <span style={styles.summaryCardValue}>{card.value}</span>
                <div style={card.label === 'Weekly' ? { ...styles.summaryCardIcon, color: 'rgba(147, 197, 253, 0.95)' } : styles.summaryCardIcon}>
                  <Icon size={32} color={card.label === 'Weekly' ? 'rgba(147, 197, 253, 0.95)' : 'rgba(255,255,255,0.9)'} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Plan button */}
        <div style={styles.toolbar} className="plans-toolbar">
          <button type="button" style={styles.addPlanBtn} className="add-plan-btn" onClick={() => { setEditingPlan(null); setShowPlanModal(true); }}>+ Add Plan</button>
        </div>

        {/* Table - desktop */}
        <div style={styles.tableWrap} className="plans-table-wrap">
          <table style={styles.table} className="plans-table">
            <thead>
              <tr>
                <th style={styles.th}><span className="th-content">Name <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Type <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Description <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : plans).map((row) => (
                <tr key={row.id} style={styles.tr}>
                  <td style={styles.td}>{row.name || row.planName}</td>
                  <td style={styles.td}>
                    <span style={styles.typeBadge}>{row.type || '—'}</span>
                  </td>
                  <td style={styles.td}>{row.description || '—'}</td>
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
          onView={() => { const row = plans.find((r) => r.id === openActionId); if (row) handleView(row); }}
          onEdit={() => { const row = plans.find((r) => r.id === openActionId); if (row) handleEdit(row); }}
          onDelete={() => { const row = plans.find((r) => r.id === openActionId); if (row) return handleDelete(row); }}
        />

        {loading && <p style={{ marginBottom: 16, color: '#666' }}>Loading plans…</p>}
        {loadError && (
          <p style={{ marginBottom: 16, color: '#dc2626' }}>
            {loadError}. Update Firestore rules to allow read on the plans collection.
          </p>
        )}
        {!loading && !loadError && plans.length === 0 && (
          <p style={{ marginBottom: 16, color: '#666' }}>No plans yet. Click <strong>+ Add Plan</strong> to create one.</p>
        )}

        {/* Cards - mobile only */}
        <div className="plans-cards" style={styles.cardsWrap}>
          {(loading ? [] : plans).map((row) => (
            <div key={row.id} style={styles.planCard} className="plan-card">
              <div style={styles.planCardRow}><span style={styles.planCardLabel}>Name</span><span>{row.name || row.planName}</span></div>
              <div style={styles.planCardRow}><span style={styles.planCardLabel}>Type</span><span>{row.type || '—'}</span></div>
              <div style={styles.planCardRow}><span style={styles.planCardLabel}>Description</span><span>{row.description || '—'}</span></div>
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
          onView={() => { const row = plans.find((r) => r.id === openCardActionId); if (row) handleView(row); }}
          onEdit={() => { const row = plans.find((r) => r.id === openCardActionId); if (row) handleEdit(row); }}
          onDelete={() => { const row = plans.find((r) => r.id === openCardActionId); if (row) return handleDelete(row); }}
        />

        {/* Pagination */}
        <div style={styles.pagination} className="plans-pagination">
          <span style={styles.pageInfo}>Showing page {currentPage}/{totalPages}</span>
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

  cardsRow: { display: 'flex', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' },
  toolbar: { display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' },
  addPlanBtn: { padding: '12px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
  summaryCard: { flex: '1', minWidth: '180px', borderRadius: '12px', padding: '20px', color: '#fff', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
  summaryCardLabel: { display: 'block', fontSize: '20px', fontWeight: '700', marginBottom: '8px' },
  summaryCardValue: { display: 'block', fontSize: '24px', fontWeight: '700' },
  summaryCardIcon: { position: 'absolute', top: '16px', right: '16px', opacity: 0.9 },

  tableWrap: { overflowX: 'auto', marginBottom: '20px', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '500px' },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#333', backgroundColor: '#fafafa', borderBottom: `1px solid ${BORDER_GRAY}` },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  typeBadge: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#801A39', color: '#fff', fontSize: '13px', fontWeight: '500' },
  badgeActive: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: '500' },
  badgeInactive: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: '500' },
  tdAction: { padding: '14px 16px', fontSize: '14px', position: 'relative' },
  actionCellWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  actionMenuWrap: { position: 'relative', display: 'inline-block' },
  actionTrigger: { color: MAROON, fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '14px', marginRight: '4px' },
  actionMenuTrigger: { background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '18px', color: '#666', lineHeight: 1 },
  actionDropdown: { position: 'absolute', top: '100%', left: 0, marginTop: '4px', minWidth: '120px', backgroundColor: '#fafafa', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px 0', zIndex: 50, display: 'flex', flexDirection: 'column' },
  actionDropdownPos: { left: 'auto', right: 0 },
  actionDropdownPosCard: { top: 'auto', bottom: '100%', marginTop: 0, marginBottom: '4px' },
  actionItem: { display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: '#333' },
  cardActionWrap: { position: 'relative', marginTop: '12px', display: 'inline-block' },

  cardsWrap: { display: 'none' },
  planCard: { border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px', padding: '16px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  planCardRow: { display: 'flex', justifyContent: 'space-between', fontSize: '14px' },
  planCardLabel: { color: '#666', marginRight: '8px' },

  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  pageInfo: { fontSize: '14px', color: '#333' },
  paginationControls: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  pagBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: LIGHT_GRAY, color: '#333', fontSize: '14px', cursor: 'pointer', minWidth: '36px' },
  pagBtnActive: { backgroundColor: MAROON, color: '#fff' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },

  viewMoreOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 1100 },
  viewMorePanel: { width: '100%', maxWidth: '420px', backgroundColor: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', overflow: 'auto', display: 'flex', flexDirection: 'column' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' },
  modalBox: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER_GRAY}` },
  modalTitle: { fontSize: '20px', fontWeight: '700', color: '#1f2937', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: '24px' },
  modalSectionTitle: { fontSize: '16px', fontWeight: '700', color: '#1f2937', marginBottom: '16px', marginTop: 0 },
  modalDetails: { display: 'flex', flexDirection: 'column', gap: '12px' },
  modalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' },
  modalLabel: { fontSize: '14px', fontWeight: '600', color: '#374151', flexShrink: 0 },
  modalValue: { fontSize: '14px', color: '#4b5563', textAlign: 'right' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: `1px solid ${BORDER_GRAY}` },
  modalBtnReminder: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: LIGHT_GRAY, color: '#333', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  modalBtnNotification: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },

  form: { padding: '24px' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', color: '#333', boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', color: '#333', backgroundColor: '#fff', cursor: 'pointer', boxSizing: 'border-box' },
  modalFooterForm: { display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', marginTop: '8px', borderTop: `1px solid ${BORDER_GRAY}` },
  modalBtnCancel: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #9ca3af', backgroundColor: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  modalBtnPrimary: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
};

export default ChitFundPlans;
