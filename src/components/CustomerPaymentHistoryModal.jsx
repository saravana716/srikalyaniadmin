import React, { useState, useEffect, useMemo } from 'react';
import { FiX, FiSearch, FiCreditCard, FiDollarSign, FiClock, FiCheckCircle, FiLayers, FiCalendar, FiTrash2 } from 'react-icons/fi';
import Button from './Button';
import { subscribeCustomerAllPayments, subscribeCustomerPlans } from '../services/customersService';
import { deleteUnifiedPayment } from '../services/paymentsService';
import { formatINR } from '../utils/currencyUtils';
import { formatToIST, formatPaidDate } from '../utils/dateUtils';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';

function formatPaymentTime(entry) {
  return formatPaidDate(entry);
}

function normalizePlanName(str) {
  return String(str || '').trim().toLowerCase().replace(/[\s-_]+/g, '');
}

const CustomerPaymentHistoryModal = ({ customer, initialPlan = 'all', onClose, onAddFunds }) => {
  const [payments, setPayments] = useState([]);
  const [customerPlans, setCustomerPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanKey, setSelectedPlanKey] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Set initial plan if specified
  useEffect(() => {
    if (initialPlan) {
      setSelectedPlanKey(initialPlan);
    }
  }, [initialPlan]);

  // Subscribe to live payments for this customer
  useEffect(() => {
    if (!customer) {
      setPayments([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubPayments = subscribeCustomerAllPayments(customer, (list) => {
      setPayments(list);
      setLoading(false);
    });
    const unsubPlans = subscribeCustomerPlans(customer, (list) => {
      setCustomerPlans(list);
    });

    return () => {
      if (typeof unsubPayments === 'function') unsubPayments();
      if (typeof unsubPlans === 'function') unsubPlans();
    };
  }, [customer]);

  // Build the list of available plans for this customer
  const availablePlans = useMemo(() => {
    const map = new Map();

    // 1. From enrolled planPurchases
    customerPlans.forEach((p) => {
      const name = (p.planName || p.name || 'Scheme Plan').trim();
      const norm = normalizePlanName(name);
      if (!norm) return;
      map.set(norm, {
        id: p.id,
        normKey: norm,
        name,
        planType: p.plan || p.type || customer?.plan || 'Monthly',
        status: p.status || 'Active',
        savedAmount: p.savedAmount ?? p.amount ?? 0,
        paidInstallments: p.paidInstallments ?? 0,
        planPurchase: p,
      });
    });

    // 2. From payment records (if any payment has a plan name not in planPurchases)
    payments.forEach((pay) => {
      const payPlan = (pay.chitPlan || pay.planName || '').trim();
      const norm = normalizePlanName(payPlan);
      if (norm && !map.has(norm)) {
        map.set(norm, {
          id: pay.planId || pay.planPurchaseId || norm,
          normKey: norm,
          name: payPlan,
          planType: customer?.plan || 'Monthly',
          status: 'Active',
          savedAmount: 0,
          paidInstallments: 0,
          planPurchase: null,
        });
      }
    });

    // 3. Fallback: if customer has a plan name on customer record (e.g. "Monthly")
    if (map.size === 0 && customer?.plan) {
      const norm = normalizePlanName(customer.plan);
      map.set(norm, {
        id: norm,
        normKey: norm,
        name: `${customer.plan} Plan`,
        planType: customer.plan,
        status: 'Active',
        savedAmount: customer.accountBalance ?? customer.amount ?? 0,
        paidInstallments: 0,
        planPurchase: null,
      });
    }

    // Convert map to array and calculate per-plan payment totals
    const list = Array.from(map.values()).map((p) => {
      const planPayments = payments.filter((item) => {
        const itemPlan = normalizePlanName(item.chitPlan || item.planName);
        if (itemPlan && itemPlan === p.normKey) return true;
        if (p.id && (item.planId === p.id || item.planPurchaseId === p.id)) return true;
        return false;
      });

      const totalPaid = planPayments.reduce((sum, item) => {
        const val = Number(item.paidAmount ?? item.amount ?? 0) || 0;
        return sum + val;
      }, 0);

      return {
        ...p,
        count: planPayments.length,
        totalPaid,
      };
    });

    return list;
  }, [customerPlans, payments, customer]);

  // If initialPlan was passed as a name/id, resolve it
  useEffect(() => {
    if (!initialPlan || initialPlan === 'all') {
      setSelectedPlanKey('all');
      return;
    }
    const norm = normalizePlanName(initialPlan);
    const found = availablePlans.find((p) => p.normKey === norm || p.id === initialPlan || p.name.toLowerCase() === initialPlan.toLowerCase());
    if (found) {
      setSelectedPlanKey(found.normKey);
    }
  }, [initialPlan, availablePlans]);

  // Selected plan object (or null for all)
  const activePlan = useMemo(() => {
    if (selectedPlanKey === 'all') return null;
    return availablePlans.find((p) => p.normKey === selectedPlanKey || p.id === selectedPlanKey) || null;
  }, [selectedPlanKey, availablePlans]);

  // Filter payments by selected plan
  const planFilteredPayments = useMemo(() => {
    if (!activePlan) return payments;
    return payments.filter((item) => {
      const itemPlan = normalizePlanName(item.chitPlan || item.planName);
      if (itemPlan && itemPlan === activePlan.normKey) return true;
      if (activePlan.id && (item.planId === activePlan.id || item.planPurchaseId === activePlan.id)) return true;
      return false;
    });
  }, [payments, activePlan]);

  // Filter payments further by source (Cash / Installment / Payment) and Search Query
  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return planFilteredPayments.filter((item) => {
      if (filterSource !== 'all') {
        if (filterSource === 'cash' && item.source !== 'customer_cash') return false;
        if (filterSource === 'installment' && item.source !== 'installment') return false;
        if (filterSource === 'payment' && item.source !== 'payment') return false;
      }
      if (q) {
        const text = [
          item.sourceLabel,
          item.chitPlan,
          item.planName,
          item.mode,
          item.paymentMode,
          item.status,
          item.note,
          item.paidAmount,
          item.amount,
          item.dueAmount,
          item.paidDate,
          item.dueDate,
          formatPaymentTime(item),
        ]
          .map((v) => String(v || '').toLowerCase())
          .join(' ');
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [planFilteredPayments, filterSource, searchQuery]);

  // Stats calculation based on active plan
  const stats = useMemo(() => {
    const totalPaid = planFilteredPayments.reduce((sum, item) => {
      const val = Number(item.paidAmount ?? item.amount ?? 0) || 0;
      return sum + val;
    }, 0);

    let balance = 0;
    if (activePlan) {
      balance = activePlan.savedAmount || activePlan.totalPaid || 0;
    } else {
      balance = Number(customer?.accountBalance ?? customer?.amount ?? 0) || 0;
    }

    return {
      balance,
      totalPaid,
      count: planFilteredPayments.length,
    };
  }, [planFilteredPayments, activePlan, customer]);

  if (!customer) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.modalHeader}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={styles.modalTitle}>
                {activePlan ? `${activePlan.name} — Payment History` : 'Customer Payment History'}
              </h2>
            </div>
            <p style={styles.modalSubtitle}>
              <strong>{customer.name}</strong> {customer.cusId ? `(${customer.cusId})` : ''} · {customer.mobile}
              {customer.plan ? ` · Primary Plan: ${customer.plan}` : ''}
            </p>
          </div>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>

        {/* Plan Selector Section */}
        <div style={styles.planSelectorWrap}>
          <div style={styles.planSelectorHeader}>
            <span style={styles.planSelectorTitle}>
              <FiLayers style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
              Customer Plans (Select a plan to view its specific payment history):
            </span>
          </div>
          <div style={styles.planChipsContainer}>
            <button
              type="button"
              style={{
                ...styles.planChip,
                ...(selectedPlanKey === 'all' ? styles.planChipActive : {}),
              }}
              onClick={() => setSelectedPlanKey('all')}
            >
              <div style={styles.planChipTitle}>All Plans</div>
              <div style={styles.planChipMeta}>
                {payments.length} record{payments.length === 1 ? '' : 's'}
              </div>
            </button>

            {availablePlans.map((p) => {
              const isActive = selectedPlanKey === p.normKey || selectedPlanKey === p.id;
              return (
                <button
                  key={p.normKey}
                  type="button"
                  style={{
                    ...styles.planChip,
                    ...(isActive ? styles.planChipActive : {}),
                  }}
                  onClick={() => setSelectedPlanKey(p.normKey)}
                >
                  <div style={styles.planChipTopRow}>
                    <span style={styles.planChipTitle}>{p.name}</span>
                    {p.status && (
                      <span
                        style={{
                          ...styles.planStatusBadge,
                          backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#dcfce7',
                          color: isActive ? '#fff' : '#15803d',
                        }}
                      >
                        {p.status}
                      </span>
                    )}
                  </div>
                  <div style={{ ...styles.planChipMeta, color: isActive ? '#fce7f0' : '#6b7280' }}>
                    <span>{p.planType}</span>
                    <span>·</span>
                    <span>{p.count} record{p.count === 1 ? '' : 's'}</span>
                    <span>·</span>
                    <strong style={{ color: isActive ? '#fff' : '#16a34a' }}>
                      {formatINR(p.totalPaid)}
                    </strong>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div style={styles.statsContainer}>
          <div style={styles.statCard}>
            <div style={styles.statIconWrap}>
              <FiDollarSign size={20} color={MAROON} />
            </div>
            <div>
              <span style={styles.statLabel}>
                {activePlan ? `${activePlan.name} Balance` : 'Total Account Balance'}
              </span>
              <div style={styles.statValue}>{formatINR(stats.balance)}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, backgroundColor: '#dcfce7' }}>
              <FiCheckCircle size={20} color="#16a34a" />
            </div>
            <div>
              <span style={styles.statLabel}>
                {activePlan ? 'Total Paid for this Plan' : 'Total Paid History'}
              </span>
              <div style={{ ...styles.statValue, color: '#16a34a' }}>
                {formatINR(stats.totalPaid)}
              </div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, backgroundColor: '#e0f2fe' }}>
              <FiCreditCard size={20} color="#0284c7" />
            </div>
            <div>
              <span style={styles.statLabel}>
                {activePlan ? 'Plan Transactions' : 'Total Transactions'}
              </span>
              <div style={styles.statValue}>
                {stats.count} record{stats.count === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div style={styles.toolbar}>
          <div style={styles.tabFilterGroup}>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(filterSource === 'all' ? styles.tabBtnActive : {}) }}
              onClick={() => setFilterSource('all')}
            >
              All ({planFilteredPayments.length})
            </button>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(filterSource === 'cash' ? styles.tabBtnActive : {}) }}
              onClick={() => setFilterSource('cash')}
            >
              Add Cash
            </button>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(filterSource === 'installment' ? styles.tabBtnActive : {}) }}
              onClick={() => setFilterSource('installment')}
            >
              Installments
            </button>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(filterSource === 'payment' ? styles.tabBtnActive : {}) }}
              onClick={() => setFilterSource('payment')}
            >
              Direct Payments
            </button>
          </div>

          <div style={styles.searchBox}>
            <FiSearch style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search date, amount, mode, note…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {/* Content Body */}
        <div style={styles.modalBody}>
          {loading ? (
            <div style={styles.loadingState}>Loading payment history…</div>
          ) : filteredPayments.length === 0 ? (
            <div style={styles.emptyState}>
              <FiClock size={32} color="#9ca3af" />
              <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: 14 }}>
                {planFilteredPayments.length === 0
                  ? activePlan
                    ? `No payments recorded for "${activePlan.name}" yet.`
                    : 'No payments or cash credits recorded for this customer yet.'
                  : 'No payment records match your search filter.'}
              </p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Paid Date</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Payment Mode</th>
                    <th style={styles.th}>Plan Name</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Note / Remarks</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((item) => {
                    const isCash = item.source === 'customer_cash';
                    const isInstallment = item.source === 'installment';
                    const statusClass =
                      item.status === 'Completed' || item.status === 'Paid'
                        ? styles.statusCompleted
                        : styles.statusPending;

                    const handleDeletePayment = async (row) => {
                      if (!window.confirm(`Are you sure you want to delete this payment entry (${formatINR(row.paidAmount || row.amount || 0)})?`)) return;
                      try {
                        await deleteUnifiedPayment(row);
                      } catch (err) {
                        console.error('Delete payment failed', err);
                        alert(err?.message || 'Failed to delete payment');
                      }
                    };

                    return (
                      <tr key={item.id} style={styles.tr}>
                        <td style={styles.td}>
                          <span style={styles.dateText}>{formatPaymentTime(item)}</span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badgeSource,
                              backgroundColor: isCash ? '#fef3c7' : isInstallment ? '#e0e7ff' : '#f3e8ff',
                              color: isCash ? '#92400e' : isInstallment ? '#3730a3' : '#6b21a8',
                            }}
                          >
                            {item.sourceLabel || (isCash ? 'Add Cash' : isInstallment ? 'Installment' : 'Payment')}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <strong style={{ color: '#16a34a', fontSize: 14 }}>
                            + {formatINR(item.paidAmount ?? item.amount ?? 0)}
                          </strong>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.badgeMode}>{item.mode || item.paymentMode || 'Cash'}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.planText}>{item.chitPlan || item.planName || '—'}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ ...styles.statusBadge, ...statusClass }}>
                            {item.status || 'Completed'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.noteText}>{item.note || '—'}</span>
                        </td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(item)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc2626',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}
                            title="Delete Payment Record"
                          >
                            <FiTrash2 size={14} /> Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={styles.modalFooter}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px' }}>
            {activePlan ? (
              <span>
                Filtered by: <strong>{activePlan.name}</strong> ({filteredPayments.length} of {payments.length} total payments)
              </span>
            ) : (
              <span>
                Showing <strong>All Plans</strong> ({filteredPayments.length} records)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            {onAddFunds && (
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onAddFunds(customer);
                }}
              >
                + Add Cash / Credit Account
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '20px',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
    width: '100%',
    maxWidth: '960px',
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: MAROON,
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '4px 0 0 0',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  planSelectorWrap: {
    backgroundColor: '#f8fafc',
    padding: '12px 24px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  planSelectorHeader: {
    marginBottom: '8px',
  },
  planSelectorTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  planChipsContainer: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  planChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '3px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: `1.5px solid ${BORDER_GRAY}`,
    backgroundColor: '#fff',
    color: '#334155',
    cursor: 'pointer',
    transition: 'all 0.18s ease-in-out',
    minWidth: '130px',
    textAlign: 'left',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  planChipActive: {
    backgroundColor: MAROON,
    borderColor: MAROON,
    color: '#fff',
    boxShadow: '0 4px 12px rgba(128, 26, 57, 0.25)',
  },
  planChipTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: '8px',
  },
  planChipTitle: {
    fontSize: '13px',
    fontWeight: '700',
    whiteSpace: 'nowrap',
  },
  planStatusBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '1px 6px',
    borderRadius: '999px',
    textTransform: 'uppercase',
  },
  planChipMeta: {
    fontSize: '11px',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
  },
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    padding: '14px 24px',
    backgroundColor: '#fff',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
  },
  statIconWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: '#fce7f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statLabel: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: '600',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  statValue: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#0f172a',
    marginTop: '2px',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 24px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
    backgroundColor: '#f8fafc',
    flexWrap: 'wrap',
  },
  tabFilterGroup: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  tabBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: `1px solid ${BORDER_GRAY}`,
    backgroundColor: '#fff',
    color: '#4b5563',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabBtnActive: {
    backgroundColor: MAROON,
    borderColor: MAROON,
    color: '#fff',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: `1px solid ${BORDER_GRAY}`,
    padding: '6px 12px',
    width: '260px',
  },
  searchIcon: {
    color: '#9ca3af',
    marginRight: '6px',
    flexShrink: 0,
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '13px',
    width: '100%',
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 24px',
    backgroundColor: '#fff',
  },
  loadingState: {
    padding: '40px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: `2px solid ${BORDER_GRAY}`,
    color: '#374151',
    fontWeight: '600',
    backgroundColor: '#f8fafc',
  },
  tr: {
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  td: {
    padding: '12px',
    verticalAlign: 'middle',
    color: '#1f2937',
  },
  dateText: {
    fontSize: '12px',
    color: '#4b5563',
  },
  badgeSource: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  badgeMode: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: '#fce7f0',
    color: MAROON,
  },
  planText: {
    fontWeight: '500',
    color: '#374151',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
  },
  noteText: {
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  modalFooter: {
    padding: '14px 24px',
    borderTop: `1px solid ${BORDER_GRAY}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#fff',
    flexWrap: 'wrap',
  },
};

export default CustomerPaymentHistoryModal;
