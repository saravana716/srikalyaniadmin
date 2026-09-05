import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import { FiSettings, FiBell, FiMenu, FiX, FiSearch, FiLayers, FiCheckCircle, FiDollarSign, FiPlusCircle } from 'react-icons/fi';
import { GiGoldBar } from 'react-icons/gi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import {
  subscribePlanPurchases,
  addPlanPurchase as addPlanPurchaseToDb,
  updatePlanPurchase as updatePlanPurchaseInDb,
  deletePlanPurchase as deletePlanPurchaseFromDb,
  cancelPlanPurchase as cancelPlanPurchaseInDb,
  closePlanPurchase as closePlanPurchaseInDb,
} from '../services/planPurchasesService';
import { subscribeCustomers } from '../services/customersService';
import { subscribePlans } from '../services/plansService';
import PlanPurchaseDetailModal from '../components/PlanPurchaseDetailModal';
import CloseAccountModal from '../components/CloseAccountModal';
import CancelChitModal from '../components/CancelChitModal';
import CustomerPaymentHistoryModal from '../components/CustomerPaymentHistoryModal';
import ChitPaymentModal from '../components/ChitPaymentModal';
import { formatINR } from '../utils/currencyUtils';
import { uploadCancelChitForm } from '../utils/uploadImage';
import { useLatestMetalRates } from '../hooks/useLatestMetalRates';
import { parseMoneyAmount, formatSavedWeightForDisplay } from '../utils/weightUtils';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

const AddEditPlanPurchaseModal = ({ planPurchase, onClose, onSave, error, customers, plans, saving }) => {
  const isEdit = !!planPurchase;
  const [customerId, setCustomerId] = useState(planPurchase?.customerId ?? '');
  const [cusId, setCusId] = useState(planPurchase?.cusId ?? '');
  const [customerName, setCustomerName] = useState(planPurchase?.customerName ?? planPurchase?.name ?? '');
  const [mobile, setMobile] = useState(planPurchase?.mobile ?? '');
  const [planId, setPlanId] = useState(planPurchase?.planId ?? '');
  const [planName, setPlanName] = useState(planPurchase?.planName ?? '');
  const [planType, setPlanType] = useState(planPurchase?.plan || 'Monthly');
  const [amount, setAmount] = useState(planPurchase?.amount ? String(planPurchase.amount) : '1000');
  const [durationMonths, setDurationMonths] = useState(planPurchase?.durationMonths ? String(planPurchase.durationMonths) : '11');
  const [nomineeName, setNomineeName] = useState(planPurchase?.nomineeName ?? '');
  const [startDate, setStartDate] = useState(planPurchase?.startDate ?? new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState(planPurchase?.status ?? 'Active');

  const handleCustomerChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setCustomerId('');
      setCusId('');
      setCustomerName('');
      setMobile('');
      return;
    }
    const selected = customers.find(c => c.id === val || c.cusId === val);
    if (selected) {
      setCustomerId(selected.id || selected.cusId);
      setCusId(selected.cusId || '');
      setCustomerName(selected.name || '');
      setMobile(selected.mobile || '');
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
      setPlanType(selected.type || selected.plan || 'Monthly');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    await onSave(
      {
        customerId,
        cusId,
        customerName,
        name: customerName,
        mobile,
        planId,
        planName,
        plan: planType,
        amount: Number(amount) || 0,
        durationMonths: Number(durationMonths) || 11,
        nomineeName,
        startDate,
        status,
      },
      planPurchase?.id
    );
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Edit Chit Enrollment' : 'Enroll in Chit / Gold Scheme'}</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Customer <span style={{ color: '#dc2626' }}>*</span></label>
            <select 
              value={customerId} 
              onChange={handleCustomerChange} 
              style={styles.formSelect} 
              required
            >
              <option value="">Select a Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id || c.cusId}>
                  {c.name} ({c.cusId || 'No ID'}) {c.mobile ? `• ${c.mobile}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Chit / Gold Scheme <span style={{ color: '#dc2626' }}>*</span></label>
            <select 
              value={planId} 
              onChange={handlePlanChange} 
              style={styles.formSelect} 
              required
            >
              <option value="">Select a Scheme</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name || p.planName} ({p.type || 'Monthly'})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Monthly Installment (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={styles.formInput}
                placeholder="1000"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Duration (Months)</label>
              <input
                type="number"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                style={styles.formInput}
                placeholder="11"
                required
              />
            </div>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Nominee Name (Optional)</label>
            <input
              type="text"
              value={nomineeName}
              onChange={(e) => setNomineeName(e.target.value)}
              style={styles.formInput}
              placeholder="e.g. Spouse / Sibling"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Enrollment Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={styles.formInput} required />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.formSelect}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Completed">Completed</option>
                <option value="Closed">Closed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText={isEdit ? 'Updating…' : 'Enrolling…'}>
              {isEdit ? 'Update Enrollment' : 'Enroll Customer'}
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
  const [closeRow, setCloseRow] = useState(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState(null);
  const [cancelRow, setCancelRow] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [historyRow, setHistoryRow] = useState(null);
  const [chitPayRow, setChitPayRow] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { rates } = useLatestMetalRates();

  useEffect(() => {
    const unsubList = subscribePlanPurchases(setList);
    const unsubCust = subscribeCustomers(setCustomers);
    const unsubPlans = subscribePlans(setPlans);
    setLoading(false);
    return () => {
      if (typeof unsubList === 'function') unsubList();
      if (typeof unsubCust === 'function') unsubCust();
      if (typeof unsubPlans === 'function') unsubPlans();
    };
  }, []);

  // Merge planPurchases with any scheme enrollments from customers if not already present
  const effectiveList = useMemo(() => {
    const map = new Map();
    // 1. Add all from planPurchases collection
    list.forEach((r) => {
      const pKey = `${String(r.cusId || r.customerId || '').trim().toLowerCase()}_${String(r.planName || r.name || '').trim().toLowerCase()}`;
      map.set(r.id || pKey, r);
    });

    // 2. Add customer records with schemes if not already present
    customers.forEach((c) => {
      if (c.type === 'scheme_enrollment' || c.planName || c.plan) {
        const pName = c.planName || (c.plan ? `${c.plan} Gold Plan` : '');
        if (!pName) return;
        const alreadyHas = Array.from(map.values()).some((existing) => {
          const eCus = String(existing.cusId || existing.customerId || '').trim().toLowerCase();
          const eName = String(existing.planName || existing.name || '').trim().toLowerCase();
          const thisCus = String(c.cusId || c.id || '').trim().toLowerCase();
          return (eCus === thisCus && eName === pName.trim().toLowerCase()) || existing.id === c.id;
        });

        if (!alreadyHas) {
          map.set(c.id, {
            id: c.id,
            cusId: c.cusId || c.id,
            customerId: c.id,
            name: c.name,
            customerName: c.name,
            mobile: c.mobile,
            parent_mobile: c.parent_mobile || c.mobile,
            planName: pName,
            plan: c.plan || 'Monthly',
            amount: c.amount || 0,
            savedAmount: c.accountBalance ?? c.savedAmount ?? c.amount ?? 0,
            savedWeight: c.savedWeight || null,
            paidInstallments: c.paidInstallments ?? 0,
            durationMonths: c.durationMonths || 11,
            status: c.status || 'Active',
            createdAt: c.createdAt,
            joinedDate: c.joinedDate,
            _synthesizedFromCustomer: true,
          });
        }
      }
    });

    return Array.from(map.values());
  }, [list, customers]);

  // Compute chit fund statistics
  const stats = useMemo(() => {
    const totalEnrolled = effectiveList.length;
    const activeEnrolled = effectiveList.filter((r) => String(r.status || '').toLowerCase() === 'active').length;
    const totalSavedAmount = effectiveList.reduce(
      (acc, r) => acc + parseMoneyAmount(r.savedAmount ?? r.amount ?? 0),
      0
    );
    const totalWeightGrams = effectiveList.reduce(
      (acc, r) => acc + (Number(r.savedWeight) || 0),
      0
    );
    return {
      totalEnrolled,
      activeEnrolled,
      totalSavedAmount,
      totalWeightGrams,
    };
  }, [effectiveList]);

  // Unique schemes for filter dropdown
  const uniqueSchemes = useMemo(() => {
    const names = new Set();
    plans.forEach((p) => {
      if (p.name || p.planName) names.add(p.name || p.planName);
    });
    effectiveList.forEach((r) => {
      if (r.planName || r.name) names.add(r.planName || r.name);
    });
    return Array.from(names).sort();
  }, [plans, effectiveList]);

  // Filtered plan purchases list
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return effectiveList.filter((row) => {
      // Scheme filter
      if (schemeFilter !== 'all') {
        const pName = String(row.planName || row.name || '').toLowerCase();
        if (!pName.includes(schemeFilter.toLowerCase())) return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        const s = String(row.status || '').toLowerCase();
        if (s !== statusFilter.toLowerCase()) return false;
      }
      // Search query
      if (q) {
        const hay = [
          row.cusId,
          row.customerId,
          row.customerName,
          row.name,
          row.mobile,
          row.planName,
          row.plan,
          row.status,
          row.amount,
        ]
          .map((x) => String(x || '').toLowerCase())
          .join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [effectiveList, searchQuery, schemeFilter, statusFilter]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, schemeFilter, statusFilter]);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage]);

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

  const handleEdit = (row) => {
    setEditingRow(row);
    setShowAddModal(false);
    setOpenActionId(null);
    setOpenCardActionId(null);
    setActionAnchorEl(null);
    setCardActionAnchorEl(null);
  };

  const handleView = (row) => {
    setViewModalRow(row);
    setOpenActionId(null);
    setOpenCardActionId(null);
    setActionAnchorEl(null);
    setCardActionAnchorEl(null);
  };

  const handlePaymentHistory = (row) => {
    setHistoryRow(row);
    setOpenActionId(null);
    setOpenCardActionId(null);
    setActionAnchorEl(null);
    setCardActionAnchorEl(null);
  };

  const handlePayInstallment = (row) => {
    setChitPayRow(row);
    setOpenActionId(null);
    setOpenCardActionId(null);
    setActionAnchorEl(null);
    setCardActionAnchorEl(null);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete plan purchase for "${row.customerName || row.name || 'this customer'}"?`)) return;
    setDeleting(true);
    try {
      await deletePlanPurchaseFromDb(row.id);
      setOpenActionId(null);
      setOpenCardActionId(null);
      setActionAnchorEl(null);
      setCardActionAnchorEl(null);
    } catch (e) {
      console.error('Delete failed', e);
      alert(e?.message || 'Failed to delete plan purchase');
    } finally {
      setDeleting(false);
    }
  };

  const openCloseAccount = (row) => {
    if (!row) return;
    if (['cancelled', 'closed'].includes(String(row.status || '').toLowerCase())) {
      alert('This account is already closed or cancelled.');
      return;
    }
    setOpenActionId(null);
    setOpenCardActionId(null);
    setActionAnchorEl(null);
    setCardActionAnchorEl(null);
    setCloseError(null);
    setCloseRow(row);
  };

  const handleCloseAccount = async (closeData) => {
    if (!closeRow?.id) return;
    setCloseError(null);
    setClosing(true);
    try {
      await closePlanPurchaseInDb(closeRow.id, closeData);
      setCloseRow(null);
      setViewModalRow(null);
    } catch (e) {
      console.error('Close account failed', e);
      setCloseError(e?.message || 'Failed to close account');
    } finally {
      setClosing(false);
    }
  };

  const openCancelChit = (row) => {
    if (!row) return;
    if (['cancelled', 'closed'].includes(String(row.status || '').toLowerCase())) {
      alert('This chit is already cancelled or closed.');
      return;
    }
    setOpenActionId(null);
    setOpenCardActionId(null);
    setActionAnchorEl(null);
    setCardActionAnchorEl(null);
    setCancelError(null);
    setCancelRow(row);
  };

  const handleCancelChit = async (cancelData) => {
    if (!cancelRow?.id) return;
    setCancelError(null);
    setCancelling(true);
    try {
      const { signedFormFile, ...fields } = cancelData || {};
      const signedCancelFormUrl = await uploadCancelChitForm(signedFormFile, cancelRow.id);
      await cancelPlanPurchaseInDb(cancelRow.id, {
        ...fields,
        signedCancelFormUrl,
      });
      setCancelRow(null);
      setViewModalRow(null);
    } catch (e) {
      console.error('Cancel chit failed', e);
      setCancelError(e?.message || 'Failed to cancel chit');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container plan-purchases-page">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}
      {viewModalRow && (
        <PlanPurchaseDetailModal
          row={viewModalRow}
          onClose={() => setViewModalRow(null)}
          onCloseAccount={() => openCloseAccount(viewModalRow)}
          onCancelChit={() => openCancelChit(viewModalRow)}
          onOpenPaymentHistory={(row) => { setViewModalRow(null); setHistoryRow(row); }}
        />
      )}
      {historyRow && (
        <CustomerPaymentHistoryModal
          customer={historyRow}
          initialPlan={historyRow.planName || historyRow.name || 'all'}
          onClose={() => setHistoryRow(null)}
        />
      )}
      {closeRow && (
        <CloseAccountModal
          planPurchase={closeRow}
          onClose={() => { if (!closing) { setCloseRow(null); setCloseError(null); } }}
          onSubmit={handleCloseAccount}
          saving={closing}
          error={closeError}
        />
      )}
      {cancelRow && (
        <CancelChitModal
          planPurchase={cancelRow}
          onClose={() => { if (!cancelling) { setCancelRow(null); setCancelError(null); } }}
          onSubmit={handleCancelChit}
          saving={cancelling}
          error={cancelError}
        />
      )}

      {/* Chit Installment Payment Modal */}
      {(showPayModal || chitPayRow) && (
        <ChitPaymentModal
          initialPlanPurchase={chitPayRow}
          initialCustomer={
            chitPayRow
              ? {
                  id: chitPayRow.customerId || chitPayRow.cusId,
                  cusId: chitPayRow.cusId,
                  name: chitPayRow.customerName || chitPayRow.name,
                  mobile: chitPayRow.mobile,
                }
              : null
          }
          onClose={() => {
            setShowPayModal(false);
            setChitPayRow(null);
          }}
          onSuccess={() => {
            setShowPayModal(false);
            setChitPayRow(null);
          }}
        />
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
            <div>
              <h1 style={styles.pageTitle}>Plan Purchases</h1>
              <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                Chit Fund & Gold Savings Scheme Enrollments
              </p>
            </div>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <button
              type="button"
              style={styles.payInstallmentBtn}
              onClick={() => setShowPayModal(true)}
            >
              <FiPlusCircle size={16} />
              <span>+ Pay Installment</span>
            </button>
            <Button type="button" onClick={() => setShowAddModal(true)}>
              + Enroll in Scheme
            </Button>
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

        {/* Chit Fund Summary Metric Cards */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statIconWrap}>
              <FiLayers size={22} color={MAROON} />
            </div>
            <div>
              <div style={styles.statLabel}>Total Enrolled Schemes</div>
              <div style={styles.statValue}>{stats.totalEnrolled}</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, backgroundColor: '#dcfce7' }}>
              <FiCheckCircle size={22} color="#15803d" />
            </div>
            <div>
              <div style={styles.statLabel}>Active Accounts</div>
              <div style={{ ...styles.statValue, color: '#15803d' }}>{stats.activeEnrolled}</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, backgroundColor: '#fef3c7' }}>
              <FiDollarSign size={22} color="#b45309" />
            </div>
            <div>
              <div style={styles.statLabel}>Total Scheme Gold Savings</div>
              <div style={{ ...styles.statValue, color: '#b45309' }}>{formatINR(stats.totalSavedAmount)}</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, backgroundColor: '#fdf4ff' }}>
              <GiGoldBar size={22} color="#9333ea" />
            </div>
            <div>
              <div style={styles.statLabel}>Total Gold Weight Saved</div>
              <div style={{ ...styles.statValue, color: '#9333ea' }}>
                {stats.totalWeightGrams > 0 ? `${stats.totalWeightGrams.toFixed(3)}g` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <FiSearch style={{ color: '#999', marginRight: 8 }} />
            <input
              type="text"
              placeholder="Search customer, ID, mobile, scheme…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <select
            value={schemeFilter}
            onChange={(e) => setSchemeFilter(e.target.value)}
            style={styles.filterSelect}
            aria-label="Filter by scheme"
          >
            <option value="all">All Chit Schemes</option>
            {uniqueSchemes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.filterSelect}
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Closed">Closed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <ActionMenu
          isOpen={!!openActionId}
          onClose={() => { setOpenActionId(null); setActionAnchorEl(null); }}
          anchorEl={actionAnchorEl}
          busy={deleting || closing || cancelling}
          onView={() => { const row = list.find((r) => r.id === openActionId); if (row) handleView(row); }}
          onPayInstallment={
            ['closed', 'cancelled'].includes(String(list.find((r) => r.id === openActionId)?.status || '').toLowerCase())
              ? null
              : () => { const row = list.find((r) => r.id === openActionId); if (row) handlePayInstallment(row); }
          }
          onPaymentHistory={() => { const row = list.find((r) => r.id === openActionId); if (row) handlePaymentHistory(row); }}
          onEdit={() => { const row = list.find((r) => r.id === openActionId); if (row) handleEdit(row); }}
          onCloseAccount={
            ['closed', 'cancelled'].includes(String(list.find((r) => r.id === openActionId)?.status || '').toLowerCase())
              ? null
              : () => { const row = list.find((r) => r.id === openActionId); if (row) openCloseAccount(row); }
          }
          onCancelChit={
            ['closed', 'cancelled'].includes(String(list.find((r) => r.id === openActionId)?.status || '').toLowerCase())
              ? null
              : () => { const row = list.find((r) => r.id === openActionId); if (row) openCancelChit(row); }
          }
          onDelete={() => { const row = list.find((r) => r.id === openActionId); if (row) return handleDelete(row); }}
        />
        <ActionMenu
          isOpen={!!openCardActionId}
          onClose={() => { setOpenCardActionId(null); setCardActionAnchorEl(null); }}
          anchorEl={cardActionAnchorEl}
          busy={deleting || closing || cancelling}
          onView={() => { const row = list.find((r) => r.id === openCardActionId); if (row) handleView(row); }}
          onPayInstallment={
            ['closed', 'cancelled'].includes(String(list.find((r) => r.id === openCardActionId)?.status || '').toLowerCase())
              ? null
              : () => { const row = list.find((r) => r.id === openCardActionId); if (row) handlePayInstallment(row); }
          }
          onPaymentHistory={() => { const row = list.find((r) => r.id === openCardActionId); if (row) handlePaymentHistory(row); }}
          onEdit={() => { const row = list.find((r) => r.id === openCardActionId); if (row) handleEdit(row); }}
          onCloseAccount={
            ['closed', 'cancelled'].includes(String(list.find((r) => r.id === openCardActionId)?.status || '').toLowerCase())
              ? null
              : () => { const row = list.find((r) => r.id === openCardActionId); if (row) openCloseAccount(row); }
          }
          onCancelChit={
            ['closed', 'cancelled'].includes(String(list.find((r) => r.id === openCardActionId)?.status || '').toLowerCase())
              ? null
              : () => { const row = list.find((r) => r.id === openCardActionId); if (row) openCancelChit(row); }
          }
          onDelete={() => { const row = list.find((r) => r.id === openCardActionId); if (row) return handleDelete(row); }}
        />

        <div style={styles.tableWrap} className="plan-purchases-table-wrap">
          <table style={styles.table} className="plan-purchases-table">
            <thead>
              <tr>
                <th style={{ ...styles.th, minWidth: '160px' }}>
                  <span className="th-content">Customer <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span>
                </th>
                <th style={{ ...styles.th, minWidth: '180px' }}>
                  <span className="th-content">Chit Scheme <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span>
                </th>
                <th style={{ ...styles.th, minWidth: '130px' }}>
                  <span className="th-content">Savings & Gold <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span>
                </th>
                <th style={{ ...styles.th, minWidth: '100px' }}>
                  <span className="th-content">Paid Inst. <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span>
                </th>
                <th style={{ ...styles.th, minWidth: '90px' }}>
                  <span className="th-content">Status <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span>
                </th>
                <th style={{ ...styles.th, minWidth: '130px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : pageRows).map((row) => (
                <tr key={row.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#111827' }}>
                        {row.name || row.customerName || 'Customer'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
                        <span style={{ fontWeight: 600, color: MAROON }}>
                          {row.cusId || row.customerId || 'No ID'}
                        </span>
                        {row.mobile && <span style={{ color: '#6b7280' }}>· {row.mobile}</span>}
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                        {row.planName || 'Gold Scheme'}
                      </strong>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Installment: <strong style={{ color: '#334155' }}>{formatINR(row.amount || 0)}</strong>/mo
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#15803d' }}>
                        {formatINR(row.savedAmount ?? row.amount ?? 0)}
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>
                        {formatSavedWeightForDisplay(
                          parseMoneyAmount(row.savedAmount ?? row.amount),
                          rates,
                          row
                        )}
                      </span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.installmentPill}>
                      {row.paidInstallments ?? 0} / {row.durationMonths || 11}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={
                      String(row.status || '').toLowerCase() === 'active' ? styles.badgeActive
                        : String(row.status || '').toLowerCase() === 'completed' ? styles.badgeCompleted
                        : ['cancelled', 'closed'].includes(String(row.status || '').toLowerCase()) ? styles.badgeCancelled
                          : styles.badgeInactive
                    }>{row.status || 'Active'}</span>
                  </td>
                  <td style={{ ...styles.tdAction, textAlign: 'right' }}>
                    <div style={{ ...styles.actionCellWrap, justifyContent: 'flex-end' }}>
                      {!['closed', 'cancelled'].includes(String(row.status || '').toLowerCase()) ? (
                        <button
                          type="button"
                          style={styles.quickPayBtn}
                          onClick={() => handlePayInstallment(row)}
                          title="Record Installment Payment"
                        >
                          + Pay
                        </button>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: '#6b7280', fontWeight: 600, padding: '4px 6px' }}>
                          {row.status}
                        </span>
                      )}
                      <button type="button" style={styles.actionTrigger} onClick={() => handleView(row)}>View</button>
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
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#666' }}>
                    No enrolled chit plans found matching criteria.
                  </td>
                </tr>
              )}
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
  payInstallmentBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 18px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#15803d',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 20px',
    borderRadius: '12px',
    backgroundColor: '#fff',
    border: `1px solid ${BORDER_GRAY}`,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: '10px',
    backgroundColor: '#fbebf0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: MAROON,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: LIGHT_GRAY,
    borderRadius: '24px',
    padding: '8px 16px',
    minWidth: '260px',
    flex: 1,
    maxWidth: '380px',
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '14px',
    width: '100%',
    color: '#333',
  },
  filterSelect: {
    padding: '9px 14px',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
    fontSize: '13px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    color: '#374151',
  },
  searchContainer: { position: 'relative', backgroundColor: LIGHT_GRAY, borderRadius: '24px', padding: '10px 16px', display: 'flex', alignItems: 'center', width: '300px' },
  searchIcon: { color: '#999', marginRight: '8px', fontSize: '18px' },
  headerIcons: { display: 'flex', alignItems: 'center', gap: '10px' },
  iconButton: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: LIGHT_GRAY, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666', fontSize: '18px', position: 'relative' },
  notifBadge: { position: 'absolute', top: '6px', right: '8px', minWidth: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ff4444', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  avatar: { width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  addBtn: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' },
  tableWrap: { 
    overflowX: 'auto', 
    marginBottom: '20px', 
    border: `1px solid ${BORDER_GRAY}`, 
    borderRadius: '10px',
    backgroundColor: '#fff',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  },
  table: { 
    width: '100%', 
    borderCollapse: 'collapse', 
    tableLayout: 'auto' 
  },
  th: { 
    textAlign: 'left', 
    padding: '12px 16px', 
    fontSize: '13px', 
    fontWeight: '600', 
    color: '#374151', 
    backgroundColor: '#f9fafb', 
    borderBottom: `1px solid ${BORDER_GRAY}`,
    whiteSpace: 'nowrap'
  },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { 
    padding: '12px 16px', 
    fontSize: '13px', 
    color: '#333',
    verticalAlign: 'middle'
  },
  badgeActive: { display: 'inline-block', padding: '3px 10px', borderRadius: '6px', backgroundColor: '#16a34a', color: '#fff', fontSize: '12px', fontWeight: '600' },
  badgeCompleted: { display: 'inline-block', padding: '3px 10px', borderRadius: '6px', backgroundColor: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '600' },
  badgeInactive: { display: 'inline-block', padding: '3px 10px', borderRadius: '6px', backgroundColor: '#dc2626', color: '#fff', fontSize: '12px', fontWeight: '600' },
  badgeCancelled: { display: 'inline-block', padding: '3px 10px', borderRadius: '6px', backgroundColor: '#b45309', color: '#fff', fontSize: '12px', fontWeight: '600' },
  installmentPill: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '12px',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '12px',
    fontWeight: '600',
  },
  quickPayBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    marginRight: '6px',
  },
  tdAction: { padding: '12px 16px', fontSize: '13px', position: 'relative', verticalAlign: 'middle' },
  actionCellWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  actionTrigger: { color: MAROON, fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '13px', marginRight: '6px' },
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
