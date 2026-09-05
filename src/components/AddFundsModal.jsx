import React, { useEffect, useState, useMemo } from 'react';
import { FiX, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { GiGoldBar } from 'react-icons/gi';
import Button from './Button';
import { formatINR } from '../utils/currencyUtils';
import { findPlanPurchasesForCustomer, pickBestPlanPurchase } from '../services/planPurchasesService';
import { useLatestMetalRates } from '../hooks/useLatestMetalRates';
import { pickRateForPlan, calcIncrementalWeight, formatWeightGrams } from '../utils/weightUtils';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';
const MODES = ['Cash', 'UPI', 'Card', 'Easebuzz', 'Net Banking'];

const QUALITY_OPTIONS = [
  { label: '22K Gold (916 Hallmarked)', value: '22K (916)' },
  { label: '24K Pure Gold (999)', value: '24K (999)' },
  { label: '18K Gold (750)', value: '18K (750)' },
  { label: 'Silver', value: 'Silver' },
];

/**
 * AddFundsModal
 * Admin credits customer account via Cash / UPI / Card / etc.,
 * automatically calculating incremental gold weight based on today's rate and quality,
 * and summing with the previous saved values (just like the mobile app).
 */
const AddFundsModal = ({ customer, onClose, onSubmit, saving, error }) => {
  const [mode, setMode] = useState('Cash');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [planPurchaseId, setPlanPurchaseId] = useState('');
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [localError, setLocalError] = useState('');

  // Metal Quality & Rate
  const [quality, setQuality] = useState('22K (916)');
  const [customRate, setCustomRate] = useState('');
  const { rates } = useLatestMetalRates();

  const currentBalance = Number(customer?.accountBalance ?? customer?.amount ?? 0) || 0;
  const selected = plans.find((p) => p.id === planPurchaseId);
  const selectedPlanAmount = Number(selected?.amount ?? selected?.savedAmount ?? 0) || 0;
  const prevPlanWeight = Number(selected?.savedWeight ?? selected?.SavedWeight ?? customer?.savedWeight ?? 0) || 0;

  // Determine rate per gram based on selected quality & metal rates
  const pickedRateInfo = useMemo(() => {
    return pickRateForPlan(selected, rates, quality);
  }, [selected, rates, quality]);

  const effectiveRate = useMemo(() => {
    if (customRate && Number(customRate) > 0) return Number(customRate);
    return pickedRateInfo.ratePerGram || 0;
  }, [customRate, pickedRateInfo]);

  // Incremental calculation (Sum previous value + newly bought weight)
  const calculation = useMemo(() => {
    return calcIncrementalWeight(amount, effectiveRate, prevPlanWeight);
  }, [amount, effectiveRate, prevPlanWeight]);

  useEffect(() => {
    let cancelled = false;
    if (!customer?.id && !customer?.cusId && !customer?.mobile) {
      setPlans([]);
      setLoadingPlans(false);
      return;
    }
    setLoadingPlans(true);
    findPlanPurchasesForCustomer(customer)
      .then((list) => {
        if (cancelled) return;
        // Filter strictly to Active plans only for this customer
        const activeOnly = (list || []).filter((p) => {
          const s = String(p.status || 'Active').toLowerCase();
          return s === 'active';
        });

        setPlans(activeOnly);

        const best = pickBestPlanPurchase(activeOnly);
        const chosen = best || activeOnly[0];
        if (chosen) {
          setPlanPurchaseId(chosen.id);
          if (chosen.quality || chosen.purity) {
            setQuality(chosen.quality || chosen.purity);
          }
        } else {
          setPlanPurchaseId('');
        }
      })
      .catch((err) => {
        console.error('Failed to load plans for customer', err);
        if (!cancelled) setPlans([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlans(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer?.id, customer?.cusId, customer?.mobile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      setLocalError('Enter a valid amount greater than 0');
      return;
    }
    setLocalError('');
    await onSubmit({
      amount: value,
      paymentMode: mode,
      note: note.trim(),
      planPurchaseId: planPurchaseId || null,
      quality,
      ratePerGram: effectiveRate,
    });
  };

  return (
    <div style={styles.overlay} onClick={() => { if (!saving) onClose(); }}>
      <div style={styles.box} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={styles.headerIconWrap}>
              <GiGoldBar size={20} color="#fff" />
            </div>
            <div>
              <h2 style={styles.title}>Add Cash & Gold Weight</h2>
              <p style={styles.subtitle}>
                Auto-calculates gold weight based on today's rate & quality
              </p>
            </div>
          </div>
          <button type="button" style={styles.close} onClick={onClose} aria-label="Close" disabled={saving}>
            <FiX size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.body}>
          {/* Customer info card */}
          <div style={styles.customerCard}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{customer?.name}</div>
              <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                ID: <strong style={{ color: MAROON }}>{customer?.cusId || 'N/A'}</strong>
                {customer?.mobile ? ` • Mobile: ${customer.mobile}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#666' }}>Current Balance</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#15803d' }}>
                {formatINR(currentBalance)}
              </div>
            </div>
          </div>

          {(localError || error) && (
            <div style={styles.errorBox}>
              <FiAlertCircle size={16} />
              <span>{localError || error}</span>
            </div>
          )}

          {/* 1. Target Plan Selection */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Apply to Plan Purchase</label>
            {loadingPlans ? (
              <p style={styles.hint}>Loading customer active plans…</p>
            ) : plans.length === 0 ? (
              <p style={{ ...styles.hint, color: '#b45309' }}>
                No active scheme enrollment found for ID {customer?.cusId || 'N/A'}. Cash and gold will credit directly to customer account ({customer?.plan || 'Gold Scheme'}).
              </p>
            ) : (
              <select
                value={planPurchaseId}
                onChange={(e) => {
                  const pid = e.target.value;
                  setPlanPurchaseId(pid);
                  const p = plans.find((x) => x.id === pid);
                  if (p?.quality || p?.purity) setQuality(p.quality || p.purity);
                }}
                style={styles.input}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.planName || p.plan || 'Gold Scheme')} ({p.cusId || p.customerId || 'ID'}) · Active · Saved: {formatINR(p.savedAmount || p.amount || 0)} ({p.savedWeight ? `${p.savedWeight}g` : '0g'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Metal Quality / Purity & Today's Rate */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Gold / Metal Quality</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                style={styles.input}
              >
                {QUALITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Today's Rate (₹ / gram)
              </label>
              <input
                type="number"
                step="any"
                value={customRate !== '' ? customRate : (effectiveRate || '')}
                onChange={(e) => setCustomRate(e.target.value)}
                placeholder={effectiveRate ? String(effectiveRate) : 'e.g. 7250'}
                style={styles.input}
              />
            </div>
          </div>

          {/* 3. Payment Mode */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Payment Mode</label>
            <div style={styles.modeRow}>
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  style={{
                    ...styles.modeBtn,
                    ...(mode === m ? styles.modeBtnActive : {}),
                  }}
                  onClick={() => setMode(m)}
                  disabled={saving}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Cash Amount */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Amount to Add (₹) <span style={{ color: '#dc2626' }}>*</span></label>
            <input
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ ...styles.input, fontSize: '16px', fontWeight: 600, color: '#15803d' }}
              placeholder="e.g. 1000"
              required
            />
          </div>

          {/* 5. LIVE GOLD WEIGHT & AMOUNT SUMMATION CARD */}
          {Number(amount) > 0 && (
            <div style={styles.summationCard}>
              <div style={styles.summationHeader}>
                <GiGoldBar size={18} color="#b45309" />
                <span style={{ fontWeight: 700, color: '#92400e' }}>
                  Live Gold & Amount Calculation (Mobile App Concept)
                </span>
              </div>

              <div style={styles.summationGrid}>
                <div style={styles.summationCol}>
                  <div style={styles.summationLabel}>Gold Rate Applied</div>
                  <div style={styles.summationValue}>
                    {effectiveRate > 0 ? `₹${effectiveRate.toLocaleString('en-IN')}/g (${quality})` : 'Rate not set'}
                  </div>
                </div>

                <div style={styles.summationCol}>
                  <div style={styles.summationLabel}>Gold Bought Today</div>
                  <div style={{ ...styles.summationValue, color: '#15803d' }}>
                    +{calculation.addedGrams} grams
                  </div>
                </div>

                <div style={styles.summationCol}>
                  <div style={styles.summationLabel}>Previous Gold Saved</div>
                  <div style={styles.summationValue}>
                    {prevPlanWeight > 0 ? `${prevPlanWeight} grams` : '0 grams'}
                  </div>
                </div>

                <div style={styles.summationCol}>
                  <div style={styles.summationLabel}>New Total Gold Weight</div>
                  <div style={{ ...styles.summationValue, fontWeight: 700, color: MAROON }}>
                    {calculation.newTotalGrams} grams
                  </div>
                </div>

                <div style={styles.summationCol}>
                  <div style={styles.summationLabel}>Previous Total Amount</div>
                  <div style={styles.summationValue}>
                    {formatINR(selectedPlanAmount)}
                  </div>
                </div>

                <div style={styles.summationCol}>
                  <div style={styles.summationLabel}>New Total Amount</div>
                  <div style={{ ...styles.summationValue, fontWeight: 700, color: '#15803d' }}>
                    {formatINR(selectedPlanAmount + (Number(amount) || 0))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. Note */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Remarks / Note (Optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={styles.input}
              placeholder="e.g. Counter Cash, Month Installment"
            />
          </div>

          <div className="app-modal-footer" style={styles.footer}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={saving}
              loadingText="Crediting Cash & Gold…"
            >
              Add {mode} ({Number(amount) > 0 ? formatINR(amount) : '₹0'})
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
    padding: 16,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '92vh',
    overflowY: 'auto',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.25)',
  },
  header: {
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
    width: 36,
    height: 36,
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  close: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#fff',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: '22px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  customerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: '8px',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
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
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
  },
  hint: {
    margin: 0,
    fontSize: '12px',
    color: '#6b7280',
  },
  modeRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  modeBtn: {
    flex: '1 1 80px',
    padding: '9px 12px',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
    backgroundColor: '#fff',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    color: '#374151',
    transition: 'all 0.15s',
  },
  modeBtnActive: {
    backgroundColor: MAROON,
    borderColor: MAROON,
    color: '#fff',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
    fontSize: '14px',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
  },
  summationCard: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '10px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  summationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    paddingBottom: '8px',
    borderBottom: '1px solid #fef3c7',
  },
  summationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px',
  },
  summationCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  summationLabel: {
    fontSize: '11px',
    color: '#78350f',
    fontWeight: '500',
  },
  summationValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1f2937',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '12px',
    marginTop: '6px',
    paddingTop: '16px',
    borderTop: `1px solid ${BORDER_GRAY}`,
  },
};

export default AddFundsModal;
