import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import Button from './Button';
import { formatINR } from '../utils/currencyUtils';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';

/**
 * Close active chit/account: enter details and confirm closure directly into DB.
 */
const CloseAccountModal = ({ planPurchase, onClose, onSubmit, saving, error }) => {
  const [name, setName] = useState(planPurchase?.name || planPurchase?.customerName || '');
  const [location, setLocation] = useState(planPurchase?.city || planPurchase?.location || '');
  const [address, setAddress] = useState(planPurchase?.address || '');
  const [monthsPaid, setMonthsPaid] = useState(
    planPurchase?.paidInstallments ?? planPurchase?.monthsPaid ?? ''
  );
  const [details, setDetails] = useState(planPurchase?.closeDetails || planPurchase?.cancelReason || '');
  const [localError, setLocalError] = useState('');

  const validate = () => {
    if (!name.trim()) return 'Name is required.';
    if (!location.trim()) return 'Location / Branch is required.';
    if (!address.trim()) return 'Address is required.';
    if (!details.trim()) return 'Please enter account closure details / remarks.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const err = validate();
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError('');

    await onSubmit({
      closeName: name.trim(),
      closeLocation: location.trim(),
      closeAddress: address.trim(),
      closeDetails: details.trim(),
      monthsPaid: monthsPaid === '' ? null : Number(monthsPaid),
      // Legacy compatibility
      cancelName: name.trim(),
      cancelLocation: location.trim(),
      cancelAddress: address.trim(),
      cancelReason: details.trim(),
    });
  };

  return (
    <div style={styles.overlay} onClick={() => { if (!saving) onClose(); }}>
      <div style={styles.box} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Close Account</h2>
          <button type="button" style={styles.close} onClick={onClose} disabled={saving} aria-label="Close">
            <FiX size={22} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={styles.body}>
          <div style={styles.metaCard}>
            <p style={styles.metaLine}>
              Plan: <strong>{planPurchase?.planName || planPurchase?.plan || '—'}</strong>
              {' · '}
              Customer: <strong>{planPurchase?.customerName || planPurchase?.name || '—'}</strong>
            </p>
            {(planPurchase?.cusId || planPurchase?.customerId) && (
              <p style={styles.metaSub}>
                Customer ID: <strong>{planPurchase?.cusId || planPurchase?.customerId}</strong>
                {planPurchase?.amount != null ? ` · Amount: ${formatINR(planPurchase.amount)}` : ''}
              </p>
            )}
          </div>

          {(localError || error) && <p style={styles.error}>{localError || error}</p>}

          <div style={styles.formGroup}>
            <label style={styles.label}>Name *</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter customer name"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Location / Branch *</label>
            <input
              style={styles.input}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City / Branch location"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Address *</label>
            <textarea
              style={{ ...styles.input, minHeight: 65 }}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Customer address"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Months Paid</label>
            <input
              type="number"
              min="0"
              style={styles.input}
              value={monthsPaid}
              onChange={(e) => setMonthsPaid(e.target.value)}
              placeholder="e.g. 3"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Closure Details *</label>
            <textarea
              style={{ ...styles.input, minHeight: 85 }}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Enter account closure details, settlement notes, remarks, or handover info..."
              required
            />
          </div>

          <div className="app-modal-footer" style={styles.footer}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Back
            </Button>
            <Button type="submit" variant="danger" loading={saving} loadingText="Closing Account…">
              Confirm Close Account
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '20px',
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    maxWidth: '520px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#111',
    margin: 0,
  },
  close: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    padding: '4px',
    display: 'flex',
  },
  body: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  metaCard: {
    backgroundColor: '#fafafa',
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '8px',
    padding: '12px 14px',
  },
  metaLine: {
    margin: 0,
    fontSize: '14px',
    color: '#374151',
  },
  metaSub: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: '#6b7280',
  },
  error: {
    color: '#dc2626',
    fontSize: '13px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    padding: '8px 12px',
    borderRadius: '6px',
    margin: 0,
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
  input: {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    paddingTop: '12px',
    borderTop: `1px solid ${BORDER_GRAY}`,
    marginTop: '6px',
  },
};

export default CloseAccountModal;
