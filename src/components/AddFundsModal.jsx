import React, { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import Button from './Button';
import { formatINR } from '../utils/currencyUtils';
import { findPlanPurchasesForCustomer, pickBestPlanPurchase } from '../services/planPurchasesService';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';
const MODES = ['Cash', 'UPI', 'Card'];

/**
 * Owner credits customer account via Cash / UPI / Card,
 * and syncs amount into the selected plan purchase.
 */
const AddFundsModal = ({ customer, onClose, onSubmit, saving, error }) => {
  const [mode, setMode] = useState('Cash');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [planPurchaseId, setPlanPurchaseId] = useState('');
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [localError, setLocalError] = useState('');

  const currentBalance = Number(customer?.accountBalance ?? customer?.amount ?? 0) || 0;
  const selected = plans.find((p) => p.id === planPurchaseId);
  const selectedPlanAmount = Number(selected?.amount ?? 0) || 0;

  useEffect(() => {
    let cancelled = false;
    setLoadingPlans(true);
    findPlanPurchasesForCustomer(customer)
      .then((list) => {
        if (cancelled) return;
        setPlans(list);
        const best = pickBestPlanPurchase(list);
        setPlanPurchaseId(best?.id || list[0]?.id || '');
      })
      .catch((err) => {
        console.error('Failed to load plans for customer', err);
        if (!cancelled) setPlans([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlans(false);
      });
    return () => { cancelled = true; };
  }, [customer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      setLocalError('Enter a valid amount greater than 0');
      return;
    }
    if (!planPurchaseId) {
      setLocalError('Select which plan purchase should receive this payment');
      return;
    }
    setLocalError('');
    await onSubmit({
      amount: value,
      paymentMode: mode,
      note: note.trim(),
      planPurchaseId,
    });
  };

  return (
    <div style={styles.overlay} onClick={() => { if (!saving) onClose(); }}>
      <div style={styles.box} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Add Cash / Account</h2>
          <button type="button" style={styles.close} onClick={onClose} aria-label="Close" disabled={saving}>
            <FiX size={22} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={styles.body}>
          <p style={styles.customerLine}>
            <strong>{customer?.name}</strong>
            {customer?.mobile ? ` · ${customer.mobile}` : ''}
            {customer?.cusId ? ` · ${customer.cusId}` : ''}
          </p>
          <p style={styles.balance}>Customer Account: <strong>{formatINR(currentBalance)}</strong></p>
          {selected && (
            <p style={styles.balance}>
              Selected Plan Amount: <strong>{formatINR(selectedPlanAmount)}</strong>
              {' → after add: '}
              <strong>{formatINR(selectedPlanAmount + (Number(amount) || 0))}</strong>
            </p>
          )}

          {(localError || error) && (
            <p style={styles.error}>{localError || error}</p>
          )}

          <label style={styles.label}>Apply to Plan Purchase *</label>
          {loadingPlans ? (
            <p style={styles.hint}>Loading plans…</p>
          ) : plans.length === 0 ? (
            <p style={styles.error}>No plan purchase matched this customer. Check Plan Purchases cusId / mobile.</p>
          ) : (
            <select
              value={planPurchaseId}
              onChange={(e) => setPlanPurchaseId(e.target.value)}
              style={styles.input}
              required
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.planName || p.plan || 'Plan')} · {p.status || '—'} · {p.cusId || p.id} · now {formatINR(p.amount || 0)}
                </option>
              ))}
            </select>
          )}
          <p style={styles.hint}>
            Tip: Select the exact plan row (same Customer ID) you want updated on Plan Purchases.
          </p>

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

          <label style={styles.label}>Amount (₹)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.input}
            placeholder="Enter amount to credit"
            required
          />

          <label style={styles.label}>Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={styles.input}
            placeholder="e.g. Cash received at counter"
          />

          <div className="app-modal-footer" style={styles.footer}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText="Adding…" disabled={!planPurchaseId || loadingPlans}>
              Add {mode}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: `1px solid ${BORDER_GRAY}` },
  title: { margin: 0, fontSize: 20, fontWeight: 700 },
  close: { background: 'none', border: 'none', cursor: 'pointer', color: '#666' },
  body: { padding: 20, display: 'flex', flexDirection: 'column', gap: 10 },
  customerLine: { margin: 0, fontSize: 14, color: '#374151' },
  balance: { margin: '0 0 4px', fontSize: 14, color: '#111' },
  hint: { margin: 0, fontSize: 12, color: '#6b7280' },
  error: { color: '#dc2626', fontSize: 14, margin: 0 },
  label: { fontSize: 14, fontWeight: 500, color: '#374151', marginTop: 4 },
  modeRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  modeBtn: {
    flex: 1,
    minWidth: 80,
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${BORDER_GRAY}`,
    backgroundColor: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#374151',
  },
  modeBtnActive: {
    backgroundColor: MAROON,
    borderColor: MAROON,
    color: '#fff',
  },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER_GRAY}`, fontSize: 14, boxSizing: 'border-box' },
  footer: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 12 },
};

export default AddFundsModal;
