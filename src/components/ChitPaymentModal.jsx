import React, { useState, useEffect, useMemo } from 'react';
import { FiX, FiCheckCircle, FiAlertCircle, FiSearch, FiCreditCard } from 'react-icons/fi';
import Button from './Button';
import { subscribeCustomers, subscribeCustomerPlans } from '../services/customersService';
import { recordChitPayment } from '../services/paymentsService';
import { formatINR } from '../utils/currencyUtils';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';
const LIGHT_BG = '#fafafa';

/**
 * ChitPaymentModal
 * Seamlessly records a Chit / Gold Savings Scheme installment payment,
 * atomically crediting the customer's enrolled plan, gold weight, and account balance.
 */
const ChitPaymentModal = ({
  onClose,
  onSuccess,
  initialCustomer = null,
  initialPlanPurchase = null,
}) => {
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // Selected customer
  const [selectedCustomer, setSelectedCustomer] = useState(initialCustomer);
  const [customerSearch, setCustomerSearch] = useState('');

  // Selected plan purchase
  const [customerPlans, setCustomerPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(
    initialPlanPurchase?.id || ''
  );

  // Form fields
  const [amount, setAmount] = useState(
    initialPlanPurchase?.amount ? String(initialPlanPurchase.amount) : ''
  );
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState('Cash');
  const [status, setStatus] = useState('Completed');
  const [note, setNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Subscribe to all customers
  useEffect(() => {
    const unsub = subscribeCustomers((custs) => {
      setCustomers(custs);
      setLoadingCustomers(false);

      // If initialCustomer was provided with just cusId or id, resolve full object
      if (initialCustomer && !selectedCustomer?.name) {
        const found = custs.find(
          (c) =>
            (initialCustomer.cusId && c.cusId === initialCustomer.cusId) ||
            (initialCustomer.id && c.id === initialCustomer.id) ||
            (initialCustomer.customerId && (c.id === initialCustomer.customerId || c.cusId === initialCustomer.customerId))
        );
        if (found) {
          setSelectedCustomer(found);
        }
      }
    });
    return () => unsub();
  }, [initialCustomer]);

  // 2. Subscribe to customer's enrolled plans when selectedCustomer changes
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerPlans([]);
      if (!initialPlanPurchase) setSelectedPlanId('');
      return;
    }

    const unsub = subscribeCustomerPlans(selectedCustomer, (plans) => {
      setCustomerPlans(plans);

      // If already has initialPlanPurchase, stick with it
      if (initialPlanPurchase?.id) {
        setSelectedPlanId(initialPlanPurchase.id);
        setAmount(String(initialPlanPurchase.amount || ''));
        return;
      }

      // If not set or current selection not in plans, pick the first active plan
      if (plans.length > 0) {
        const activePlans = plans.filter((p) => String(p.status || '').toLowerCase() === 'active');
        const defaultPlan = activePlans[0] || plans[0];
        setSelectedPlanId(defaultPlan.id);
        if (!amount || amount === '0') {
          setAmount(String(defaultPlan.amount || ''));
        }
      }
    });

    return () => unsub();
  }, [selectedCustomer, initialPlanPurchase]);

  // Active selected plan object
  const activePlan = useMemo(() => {
    if (initialPlanPurchase && initialPlanPurchase.id === selectedPlanId) {
      return initialPlanPurchase;
    }
    return customerPlans.find((p) => p.id === selectedPlanId) || null;
  }, [customerPlans, selectedPlanId, initialPlanPurchase]);

  // When active plan changes, update default amount if blank
  useEffect(() => {
    if (activePlan?.amount && !amount) {
      setAmount(String(activePlan.amount));
    }
  }, [activePlan]);

  // Filtered customers for search dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 30);
    const q = customerSearch.toLowerCase().trim();
    return customers.filter((c) => {
      const name = String(c.name || '').toLowerCase();
      const cusId = String(c.cusId || '').toLowerCase();
      const mobile = String(c.mobile || '').toLowerCase();
      return name.includes(q) || cusId.includes(q) || mobile.includes(q);
    });
  }, [customers, customerSearch]);

  const handleSelectCustomer = (c) => {
    setSelectedCustomer(c);
    setSelectedPlanId('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!selectedCustomer) {
      setError('Please select a customer.');
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid installment amount greater than ₹0.');
      return;
    }

    setSaving(true);
    try {
      await recordChitPayment({
        customerId: selectedCustomer.id || selectedCustomer.cusId,
        cusId: selectedCustomer.cusId || '',
        customerName: selectedCustomer.name || '',
        mobile: selectedCustomer.mobile || '',
        planId: activePlan?.id || '',
        planName: activePlan?.planName || activePlan?.name || selectedCustomer.plan || 'Gold Scheme',
        amount: numAmount,
        dueDate: dueDate || paidDate,
        paidDate: paidDate,
        mode: mode,
        status: status,
        note: note || `Chit Installment - ${activePlan?.planName || 'Scheme'}`,
        source: 'chit_installment',
      });

      setSuccessMsg('Installment payment recorded successfully!');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 900);
    } catch (err) {
      console.error('Failed to record chit payment', err);
      setError(err?.message || 'Failed to record installment payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={styles.headerIconWrap}>
              <FiCreditCard size={20} color="#fff" />
            </div>
            <div>
              <h2 style={styles.modalTitle}>Record Scheme Installment</h2>
              <p style={styles.modalSubtitle}>
                Chit Fund / Gold Savings Scheme payment
              </p>
            </div>
          </div>
          <button
            type="button"
            style={styles.modalClose}
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <FiX size={22} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.formContent}>
          {error && (
            <div style={styles.errorAlert}>
              <FiAlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={styles.successAlert}>
              <FiCheckCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Customer Selection */}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>
              Customer <span style={{ color: '#dc2626' }}>*</span>
            </label>
            {selectedCustomer ? (
              <div style={styles.selectedCustomerCard}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>
                    {selectedCustomer.name}
                  </div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                    ID: <strong style={{ color: MAROON }}>{selectedCustomer.cusId || 'N/A'}</strong>
                    {selectedCustomer.mobile ? ` • Mobile: ${selectedCustomer.mobile}` : ''}
                    {selectedCustomer.accountBalance != null
                      ? ` • Balance: ${formatINR(selectedCustomer.accountBalance)}`
                      : ''}
                  </div>
                </div>
                {!initialCustomer && (
                  <button
                    type="button"
                    style={styles.changeCustomerBtn}
                    onClick={() => {
                      setSelectedCustomer(null);
                      setSelectedPlanId('');
                    }}
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div style={styles.searchWrap}>
                  <FiSearch style={{ color: '#888', marginRight: 8 }} />
                  <input
                    type="text"
                    placeholder="Search by customer name, ID, or mobile…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    style={styles.searchInput}
                  />
                </div>
                <div style={styles.customerDropdownList}>
                  {loadingCustomers ? (
                    <div style={styles.emptyListText}>Loading customers…</div>
                  ) : filteredCustomers.length === 0 ? (
                    <div style={styles.emptyListText}>No matching customers found</div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <div
                        key={c.id || c.cusId}
                        style={styles.customerDropdownItem}
                        onClick={() => handleSelectCustomer(c)}
                      >
                        <span style={{ fontWeight: 600, color: '#222' }}>{c.name}</span>
                        <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
                          ({c.cusId || 'No ID'} • {c.mobile || 'No Mobile'})
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Scheme Selection */}
          {selectedCustomer && (
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>
                Enrolled Scheme / Plan <span style={{ color: '#dc2626' }}>*</span>
              </label>
              {customerPlans.length === 0 ? (
                <div style={styles.noPlansWarning}>
                  No active scheme purchase found for this customer.
                  Payment will be linked directly to customer balance ({selectedCustomer.plan || 'Gold Scheme'}).
                </div>
              ) : (
                <select
                  value={selectedPlanId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedPlanId(pid);
                    const chosen = customerPlans.find((p) => p.id === pid);
                    if (chosen?.amount) setAmount(String(chosen.amount));
                  }}
                  style={styles.formSelect}
                  required
                >
                  <option value="">Select Scheme</option>
                  {customerPlans.map((plan) => {
                    const pName = plan.planName || plan.name || 'Gold Saving Scheme';
                    const instAmt = plan.amount ? formatINR(plan.amount) : '₹—';
                    const saved = plan.savedAmount ? formatINR(plan.savedAmount) : '₹0';
                    const paidInst = plan.paidInstallments ?? 0;
                    const totalInst = plan.durationMonths || 11;
                    return (
                      <option key={plan.id} value={plan.id}>
                        {pName} — {instAmt} / inst (Saved: {saved}, {paidInst}/{totalInst} Paid) [{plan.status || 'Active'}]
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {/* 3. Scheme Details Overview Badge */}
          {activePlan && (
            <div style={styles.planInfoBadge}>
              <div style={styles.planInfoRow}>
                <span>Scheme:</span>
                <strong>{activePlan.planName || activePlan.name || 'Gold Scheme'}</strong>
              </div>
              <div style={styles.planInfoRow}>
                <span>Monthly Installment:</span>
                <strong>{formatINR(activePlan.amount || 0)}</strong>
              </div>
              <div style={styles.planInfoRow}>
                <span>Total Accumulated:</span>
                <span style={{ color: '#15803d', fontWeight: 600 }}>
                  {formatINR(activePlan.savedAmount || activePlan.amount || 0)}
                  {activePlan.savedWeight ? ` (${activePlan.savedWeight}g)` : ''}
                </span>
              </div>
              <div style={styles.planInfoRow}>
                <span>Installments Paid:</span>
                <strong>
                  {activePlan.paidInstallments || 0} / {activePlan.durationMonths || 11}
                </strong>
              </div>
            </div>
          )}

          {/* 4. Amount & Date */}
          <div style={styles.twoColumnGrid}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>
                Installment Amount (₹) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 1000"
                style={styles.formInput}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Payment Date</label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                style={styles.formInput}
                required
              />
            </div>
          </div>

          {/* 5. Payment Mode & Status */}
          <div style={styles.twoColumnGrid}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Payment Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={styles.formSelect}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="Card">Debit / Credit Card</option>
                <option value="Easebuzz">Easebuzz Payment Gateway</option>
                <option value="Net Banking">Net Banking / NEFT</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Payment Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={styles.formSelect}
              >
                <option value="Completed">Completed (Auto-credit Balance & Weight)</option>
                <option value="Pending">Pending (Awaiting Confirmation)</option>
              </select>
            </div>
          </div>

          {/* 6. Remarks */}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Note / Transaction Reference</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. UPI Ref: 48929104, Month 4 Installment"
              style={styles.formInput}
            />
          </div>

          {/* Actions */}
          <div style={styles.modalFooter}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={saving}
              loadingText="Recording Installment…"
            >
              Record Payment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    padding: 16,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '92vh',
    overflowY: 'auto',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    backgroundColor: MAROON,
    color: '#fff',
    borderTopLeftRadius: '12px',
    borderTopRightRadius: '12px',
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.85)',
    margin: '2px 0 0 0',
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  errorAlert: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  successAlert: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#15803d',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  formLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
  },
  formInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  formSelect: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '8px',
    padding: '8px 12px',
    backgroundColor: LIGHT_BG,
    marginBottom: 6,
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '13px',
    width: '100%',
  },
  customerDropdownList: {
    maxHeight: '160px',
    overflowY: 'auto',
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '8px',
    backgroundColor: '#fff',
  },
  customerDropdownItem: {
    padding: '9px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.15s',
    display: 'flex',
    alignItems: 'center',
  },
  emptyListText: {
    padding: '12px',
    fontSize: '13px',
    color: '#999',
    textAlign: 'center',
  },
  selectedCustomerCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    backgroundColor: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: '8px',
  },
  changeCustomerBtn: {
    backgroundColor: '#fff',
    border: `1px solid ${BORDER_GRAY}`,
    color: '#374151',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  noPlansWarning: {
    fontSize: '12px',
    color: '#b45309',
    backgroundColor: '#fffbeb',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #fef3c7',
  },
  planInfoBadge: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
  },
  planInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#475569',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px',
    paddingTop: '16px',
    borderTop: `1px solid ${BORDER_GRAY}`,
  },
};

export default ChitPaymentModal;
