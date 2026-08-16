import React, { useState, useEffect } from 'react';
import { resolveImageSrcAsync } from '../utils/imageUtils';
import { subscribePlanPaymentHistory } from '../services/customersService';
import { formatINR } from '../utils/currencyUtils';
import { formatToIST } from '../utils/dateUtils';
import { useLatestMetalRates } from '../hooks/useLatestMetalRates';
import { parseMoneyAmount, savedWeightMeta } from '../utils/weightUtils';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';

function formatLedgerTime(value) {
  if (!value) return '—';
  if (typeof value?.toDate === 'function') return formatToIST(value.toDate().toISOString());
  return formatToIST(value);
}

const DocumentImage = ({ rawValue, label, onOpen }) => {
  const [displaySrc, setDisplaySrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(!!rawValue);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!rawValue) {
      setDisplaySrc(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    resolveImageSrcAsync(rawValue).then((src) => {
      if (!cancelled) {
        setDisplaySrc(src);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [rawValue]);

  if (!rawValue) {
    return (
      <div style={styles.imageCard}>
        <span style={styles.imageLabel}>{label}</span>
        <div style={styles.imagePlaceholder}>No image uploaded</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.imageCard}>
        <span style={styles.imageLabel}>{label}</span>
        <div style={styles.imagePlaceholder}>Loading image…</div>
      </div>
    );
  }

  if (!displaySrc) {
    return (
      <div style={styles.imageCard}>
        <span style={styles.imageLabel}>{label}</span>
        <div style={styles.imagePlaceholder}>No image uploaded</div>
      </div>
    );
  }

  return (
    <div style={styles.imageCard}>
      <div style={styles.imageLabelRow}>
        <span style={styles.imageLabel}>{label}</span>
        <button type="button" style={styles.openLink} onClick={() => onOpen?.(displaySrc)}>
          Open full size
        </button>
      </div>
      {failed ? (
        <div style={styles.imagePlaceholder}>
          Failed to load image.
          <button type="button" style={styles.openLinkBlock} onClick={() => onOpen?.(displaySrc)}>
            Try opening in new tab
          </button>
        </div>
      ) : (
        <img
          src={displaySrc}
          alt={label}
          style={styles.proofImage}
          onError={() => setFailed(true)}
          onClick={() => onOpen?.(displaySrc)}
        />
      )}
    </div>
  );
};

function DetailItem({ label, value, isStatus }) {
  const display = value != null && value !== '' ? value : 'N/A';
  const statusStyle = display === 'Active'
    ? styles.badgeActive
    : display === 'Cancelled'
      ? styles.badgeCancelled
      : styles.badgeInactive;
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>{label}</span>
      {isStatus ? (
        <span style={statusStyle}>{display}</span>
      ) : (
        <span style={styles.detailValue}>{display}</span>
      )}
    </div>
  );
}

function pickRawImage(row, side) {
  const keys = side === 'front'
    ? ['bankFrontUrl', 'bankFront', 'BankFront', 'BankFrontUrl', 'proofFrontUrl', 'proofFront', 'ProofFront', 'ProofFrontUrl', 'passbookFrontUrl', 'passbookFront', 'idFrontUrl', 'idFront', 'frontImage', 'frontUrl']
    : ['bankBackUrl', 'bankBack', 'BankBack', 'BankBackUrl', 'proofBackUrl', 'proofBack', 'ProofBack', 'ProofBackUrl', 'passbookBackUrl', 'passbookBack', 'idBackUrl', 'idBack', 'backImage', 'backUrl'];
  for (const key of keys) {
    const val = row?.[key];
    if (val != null && String(val).trim()) return val;
  }
  return null;
}

export const PlanPurchaseDetailModal = ({ row, onClose, onCancelChit }) => {
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { rates } = useLatestMetalRates();

  useEffect(() => {
    if (!row) {
      setPaymentHistory([]);
      setHistoryLoading(false);
      return undefined;
    }
    setHistoryLoading(true);
    setPaymentHistory([]);
    const unsub = subscribePlanPaymentHistory(row, (list) => {
      setPaymentHistory(list);
      setHistoryLoading(false);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [row?.id, row?.cusId, row?.customerId]);

  if (!row) return null;

  const openImage = (src) => {
    if (src) window.open(src, '_blank', 'noopener,noreferrer');
  };

  const frontRaw = pickRawImage(row, 'front');
  const backRaw = pickRawImage(row, 'back');
  const isCancelled = String(row.status || '').toLowerCase() === 'cancelled';
  const savedRupees = parseMoneyAmount(row.savedAmount ?? row.amount);
  const weightInfo = savedWeightMeta(savedRupees, rates, row);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalBox, maxWidth: '860px' }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Detailed Plan Purchase Information</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.detailSection}>
            <h3 style={styles.sectionTitle}>User Profile</h3>
            <div style={styles.detailGrid}>
              <DetailItem label="Name" value={row.name || row.customerName} />
              <DetailItem label="Customer ID" value={row.cusId || row.customerId} />
              <DetailItem label="Email" value={row.email} />
              <DetailItem label="Mobile" value={row.mobile} />
              <DetailItem label="Address" value={row.address} />
              <DetailItem label="City" value={row.city} />
              <DetailItem label="State" value={row.state} />
              <DetailItem label="Pincode" value={row.pincode} />
            </div>
          </div>

          <div style={styles.detailSection}>
            <h3 style={styles.sectionTitle}>Plan & Enrollment</h3>
            <div style={styles.detailGrid}>
              <DetailItem label="Plan Name" value={row.name || row.planName} />
              <DetailItem label="Plan Type" value={row.plan || row.type} />
              <DetailItem label="Joined Date" value={row.joinedDate || row.startDate} />
              <DetailItem label="Status" value={row.status} isStatus />
              <DetailItem label="Amount" value={row.amount != null ? `₹${row.amount}` : null} />
              <DetailItem
                label="Saved Amount"
                value={row.savedAmount != null || row.amount != null
                  ? `₹${row.savedAmount != null ? row.savedAmount : row.amount}`
                  : null}
              />
              <DetailItem
                label="Saved Weight"
                value={weightInfo.ratePerGram
                  ? `${weightInfo.label} (${weightInfo.hint})`
                  : weightInfo.hint}
              />
              <DetailItem label="Paid Installments" value={row.paidInstallments} />
            </div>
          </div>

          <div style={styles.detailSection}>
            <h3 style={styles.sectionTitle}>Payment History</h3>
            {historyLoading ? (
              <p style={styles.historyEmpty}>Loading payment history…</p>
            ) : paymentHistory.length === 0 ? (
              <p style={styles.historyEmpty}>No payments recorded for this plan yet.</p>
            ) : (
              <div style={styles.ledgerList}>
                {paymentHistory.map((entry) => (
                  <div key={entry.id} style={styles.ledgerItem}>
                    <div style={styles.ledgerTop}>
                      <strong style={{ color: '#16a34a' }}>+ {formatINR(entry.amount)}</strong>
                      <span style={styles.ledgerMode}>{entry.paymentMode || 'Cash'}</span>
                    </div>
                    <div style={styles.ledgerMeta}>
                      {formatLedgerTime(entry.createdAt)}
                      {entry.planName ? ` · ${entry.planName}` : ''}
                      {entry.planAmountAfter != null ? ` · Plan ${formatINR(entry.planAmountAfter)}` : ''}
                      {entry.balanceAfter != null ? ` · Bal ${formatINR(entry.balanceAfter)}` : ''}
                    </div>
                    {entry.note ? <div style={styles.ledgerNote}>{entry.note}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isCancelled && (
            <div style={styles.detailSection}>
              <h3 style={styles.sectionTitle}>Cancellation & Penalty</h3>
              <div style={styles.detailGrid}>
                <DetailItem label="Name" value={row.cancelName} />
                <DetailItem label="Location" value={row.cancelLocation} />
                <DetailItem label="Address" value={row.cancelAddress} />
                <DetailItem label="Reason" value={row.cancelReason} />
                <DetailItem label="Months Paid" value={row.monthsPaid} />
                <DetailItem label="Penalty Amount" value={row.penaltyAmount != null ? `₹${row.penaltyAmount}` : null} />
              </div>
              <div style={styles.proofImagesGrid}>
                {row.signedCancelFormUrl ? (
                  <div style={styles.imageCard}>
                    <span style={styles.imageLabel}>Signed Cancel Form</span>
                    <a
                      href={row.signedCancelFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.openLink}
                    >
                      Open / download signed form
                    </a>
                    {/\.(jpe?g|png|webp|gif)(\?|$)/i.test(row.signedCancelFormUrl) ||
                    String(row.signedCancelFormUrl).includes('image') ? (
                      <img
                        src={row.signedCancelFormUrl}
                        alt="Signed cancel form"
                        style={styles.sigImage}
                      />
                    ) : null}
                  </div>
                ) : null}
                {row.authoritySignature ? (
                  <div style={styles.imageCard}>
                    <span style={styles.imageLabel}>Authority Signature</span>
                    <img src={row.authoritySignature} alt="Authority signature" style={styles.sigImage} />
                  </div>
                ) : null}
                {row.customerSignature ? (
                  <div style={styles.imageCard}>
                    <span style={styles.imageLabel}>Customer Signature</span>
                    <img src={row.customerSignature} alt="Customer signature" style={styles.sigImage} />
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div style={styles.detailSection}>
            <h3 style={styles.sectionTitle}>Bank & Nominee Details</h3>
            <div style={styles.detailGrid}>
              <DetailItem label="Bank Name" value={row.bankName || row.BankName} />
              <DetailItem label="Account No" value={row.accountNo || row.accountNumber || row.AccountNo} />
              <DetailItem label="IFSC" value={row.ifsc || row.IFSC} />
              <DetailItem label="Branch" value={row.branch || row.Branch} />
              <DetailItem label="Nominee Name" value={row.nomineeName || row.NomineeName} />
              <DetailItem label="Nominee Relation" value={row.nomineeRelation || row.NomineeRelation} />
            </div>
          </div>

          <div style={styles.detailSection}>
            <h3 style={styles.sectionTitle}>Documents & Verification</h3>
            <div style={styles.detailGrid}>
              <DetailItem label="Proof Type" value={row.proofType || row.ProofType} />
              <DetailItem label="Proof Number" value={row.proofNo || row.proofNumber || row.ProofNo} />
            </div>

            <div style={styles.proofImagesGrid}>
              <DocumentImage rawValue={frontRaw} label="Bank / Proof (Front)" onOpen={openImage} />
              <DocumentImage rawValue={backRaw} label="Bank / Proof (Back)" onOpen={openImage} />
            </div>
          </div>

          {!isCancelled && onCancelChit && (
            <div style={styles.footerActions}>
              <button type="button" style={styles.cancelChitBtn} onClick={onCancelChit}>
                Cancel Chit (Penalty Form)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' },
  modalBox: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER_GRAY}`, position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 },
  modalTitle: { fontSize: '20px', fontWeight: '700', color: '#111', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', padding: '4px 8px' },
  modalBody: { padding: '24px', overflowY: 'auto' },
  detailSection: { marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${BORDER_GRAY}` },
  sectionTitle: { fontSize: '16px', fontWeight: '700', color: MAROON, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' },
  detailItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  detailLabel: { fontSize: '12px', color: '#666', fontWeight: '500' },
  detailValue: { fontSize: '14px', color: '#111', fontWeight: '600', wordBreak: 'break-word' },
  badgeActive: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: '500', width: 'fit-content' },
  badgeInactive: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: '500', width: 'fit-content' },
  badgeCancelled: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#b45309', color: '#fff', fontSize: '13px', fontWeight: '500', width: 'fit-content' },
  proofImagesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginTop: '16px' },
  imageCard: { display: 'flex', flexDirection: 'column', gap: '8px' },
  imageLabelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  imageLabel: { fontSize: '13px', color: '#374151', fontWeight: '600' },
  openLink: { background: 'none', border: 'none', color: MAROON, fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0, textDecoration: 'underline' },
  openLinkBlock: { display: 'block', marginTop: '8px', background: 'none', border: 'none', color: MAROON, fontSize: '13px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' },
  proofImage: { width: '100%', maxHeight: '360px', minHeight: '180px', objectFit: 'contain', backgroundColor: '#f3f4f6', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, cursor: 'pointer' },
  sigImage: { width: '100%', maxHeight: '140px', objectFit: 'contain', backgroundColor: '#fafafa', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}` },
  imagePlaceholder: { width: '100%', minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', border: `1px dashed ${BORDER_GRAY}`, color: '#6b7280', fontSize: '14px', padding: '16px', textAlign: 'center' },
  footerActions: { display: 'flex', justifyContent: 'flex-end', marginTop: '8px' },
  cancelChitBtn: { padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#b45309', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  historyEmpty: { color: '#6b7280', fontSize: '14px', margin: 0 },
  ledgerList: { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' },
  ledgerItem: { padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, backgroundColor: '#fafafa' },
  ledgerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  ledgerMode: { fontSize: '12px', fontWeight: '700', color: MAROON, backgroundColor: '#fce7f0', padding: '2px 8px', borderRadius: '999px' },
  ledgerMeta: { marginTop: '4px', fontSize: '12px', color: '#6b7280' },
  ledgerNote: { marginTop: '4px', fontSize: '13px', color: '#374151' },
};

export default PlanPurchaseDetailModal;
