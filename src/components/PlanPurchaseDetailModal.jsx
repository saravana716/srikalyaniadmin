import React, { useState, useEffect } from 'react';
import { resolveImageSrcAsync } from '../utils/imageUtils';
import { subscribePlanPaymentHistory } from '../services/customersService';
import { formatINR } from '../utils/currencyUtils';
import { formatToIST, formatPaidDate } from '../utils/dateUtils';
import { useLatestMetalRates } from '../hooks/useLatestMetalRates';
import { parseMoneyAmount, savedWeightMeta } from '../utils/weightUtils';
import KycDocumentsSection from './KycDocumentsSection';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';

function formatLedgerTime(value) {
  return formatPaidDate(value);
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
  const statusLower = String(display).toLowerCase();
  const statusStyle = statusLower === 'active'
    ? styles.badgeActive
    : ['cancelled', 'closed'].includes(statusLower)
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

export const PlanPurchaseDetailModal = ({
  row,
  onClose,
  onCloseAccount,
  onCancelChit,
  onOpenPaymentHistory,
  onEditPlan,
}) => {
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
  const savedRupees = parseMoneyAmount(row.savedAmount ?? row.amount);
  const statusLower = String(row.status || '').toLowerCase();
  const isCancelled = statusLower === 'cancelled' || Boolean(row.signedCancelFormUrl) || (row.penaltyAmount != null && Number(row.penaltyAmount) > 0);
  const isClosed = statusLower === 'closed' || Boolean(row.closeDetails);
  const isClosedOrCancelled = isCancelled || isClosed;
  const weightInfo = savedWeightMeta(savedRupees, rates, row);

  const planTypeStr = String(row.plan || row.planType || 'Monthly').toLowerCase().includes('daily') ? 'Daily' : 'Monthly';
  const installmentAmt = row.dailyAmount || row.installmentAmount || row.amount || 0;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalBox, maxWidth: '860px' }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>Detailed Plan Purchase Information</h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#6b7280' }}>
              Customer: <strong style={{ color: '#111827' }}>{row.name || row.customerName}</strong> ({row.cusId || row.customerId || 'No ID'}) · Plan: <strong style={{ color: MAROON }}>{planTypeStr} Plan</strong>
            </p>
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ ...styles.sectionTitle, margin: 0 }}>Plan & Enrollment</h3>
              {onEditPlan && !isClosedOrCancelled && (
                <button
                  type="button"
                  style={{
                    padding: '5px 12px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    color: '#0369a1',
                    backgroundColor: '#e0f2fe',
                    border: '1px solid #bae6fd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => onEditPlan(row)}
                >
                  ⚡ Plan Change & Split
                </button>
              )}
            </div>
            <div style={styles.detailGrid}>
              <DetailItem label="Plan Name" value={row.name || row.planName} />
              <DetailItem label="Plan Frequency" value={`${planTypeStr} Plan`} />
              <DetailItem
                label={planTypeStr === 'Daily' ? 'Daily Installment' : 'Monthly Installment'}
                value={`₹${installmentAmt} / ${planTypeStr === 'Daily' ? 'day' : 'mo'}`}
              />
              <DetailItem label="Joined Date" value={formatPaidDate(row.joinedDate || row.startDate, { dateOnly: true })} />
              <DetailItem label="Status" value={row.status} isStatus />
              <DetailItem
                label="Total Saved / Paid"
                value={formatINR(row.savedAmount ?? row.amount ?? 0)}
              />
              <DetailItem
                label="Saved Weight"
                value={weightInfo.ratePerGram
                  ? `${weightInfo.label} (${weightInfo.hint})`
                  : weightInfo.hint}
              />
              <DetailItem
                label="Paid Installments"
                value={`${row.paidInstallments ?? 0} ${
                  planTypeStr === 'Daily'
                    ? `/ ${row.durationDays || row.duration || ((row.durationMonths || 11) * 30) || 330} days`
                    : planTypeStr === 'Weekly'
                      ? `/ ${row.durationWeeks || row.duration || 52} weeks`
                      : `/ ${row.durationMonths || row.duration || 11} months`
                }`}
              />
            </div>
          </div>

          <div style={styles.detailSection}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ ...styles.sectionTitle, margin: 0 }}>Payment History</h3>
              {onOpenPaymentHistory && (
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: MAROON,
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={() => onOpenPaymentHistory(row)}
                >
                  Full Payment View →
                </button>
              )}
            </div>
            {historyLoading ? (
              <p style={styles.historyEmpty}>Loading payment history…</p>
            ) : paymentHistory.length === 0 ? (
              <p style={styles.historyEmpty}>No payments recorded for this plan yet.</p>
            ) : (
              <div style={styles.ledgerList}>
                {paymentHistory.map((entry) => (
                  <div key={entry.id} style={styles.ledgerItem}>
                    <div style={styles.ledgerTop}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ color: '#16a34a' }}>+ {formatINR(entry.paidAmount ?? entry.amount ?? 0)}</strong>
                        {entry.sourceLabel && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                            {entry.sourceLabel}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={styles.ledgerMode}>{entry.paymentMode || entry.mode || 'Cash'}</span>
                        {onEditPlan && !isClosedOrCancelled && (
                          <button
                            type="button"
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#0369a1',
                              backgroundColor: '#e0f2fe',
                              border: '1px solid #bae6fd',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                            onClick={() => onEditPlan(row, entry)}
                            title={`Split only this ${formatINR(entry.paidAmount ?? entry.amount ?? 0)} payment`}
                          >
                            ⚡ Split this
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={styles.ledgerMeta}>
                      {formatLedgerTime(entry.createdAt || entry.paidDate)}
                      {entry.planName || entry.chitPlan ? ` · ${entry.planName || entry.chitPlan}` : ''}
                      {entry.installmentNo ? ` · #${entry.installmentNo}` : ''}
                      {entry.status ? ` · ${entry.status}` : ''}
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
              <h3 style={styles.sectionTitle}>Cancellation &amp; Penalty</h3>
              <div style={styles.detailGrid}>
                <DetailItem label="Name" value={row.cancelName} />
                <DetailItem label="Location" value={row.cancelLocation} />
                <DetailItem label="Address" value={row.cancelAddress} />
                <DetailItem label="Reason" value={row.cancelReason} />
                <DetailItem label="Months Paid" value={row.monthsPaid} />
                <DetailItem label="Penalty Amount" value={row.penaltyAmount != null ? `₹${row.penaltyAmount}` : null} />
                <DetailItem label="Cancelled Date (IST)" value={formatLedgerTime(row.cancelledAt)} />
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

          {isClosed && (
            <div style={styles.detailSection}>
              <h3 style={styles.sectionTitle}>Account Closure Details</h3>
              <div style={styles.detailGrid}>
                <DetailItem label="Closed By / Name" value={row.closeName || row.name || row.customerName} />
                <DetailItem label="Location / Branch" value={row.closeLocation || row.city || row.location} />
                <DetailItem label="Address" value={row.closeAddress || row.address} />
                <DetailItem label="Closure Details" value={row.closeDetails} />
                <DetailItem label="Months Paid" value={row.monthsPaid} />
                <DetailItem label="Closed Date (IST)" value={formatLedgerTime(row.closedAt)} />
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

          <KycDocumentsSection entity={row} style={{ margin: 0, marginTop: '20px' }} />


          {!isClosedOrCancelled && (
            <div style={styles.footerActions}>
              {onEditPlan && (
                <button
                  type="button"
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #0284c7',
                    backgroundColor: '#f0f9ff',
                    color: '#0369a1',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={() => {
                    onClose?.();
                    onEditPlan(row);
                  }}
                >
                  ⚡ Plan Change & Split
                </button>
              )}
              {onCloseAccount && (
                <button
                  type="button"
                  style={styles.closeAccountBtn}
                  onClick={onCloseAccount}
                >
                  Close Account
                </button>
              )}
              {onCancelChit && (
                <button
                  type="button"
                  style={styles.cancelChitBtn}
                  onClick={onCancelChit}
                >
                  Cancel Chit (Penalty Form)
                </button>
              )}
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
  footerActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', flexWrap: 'wrap' },
  closeAccountBtn: { padding: '10px 18px', borderRadius: '8px', border: '1px solid #b45309', backgroundColor: '#fff', color: '#b45309', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  cancelChitBtn: { padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  historyEmpty: { color: '#6b7280', fontSize: '14px', margin: 0 },
  ledgerList: { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' },
  ledgerItem: { padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, backgroundColor: '#fafafa' },
  ledgerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  ledgerMode: { fontSize: '12px', fontWeight: '700', color: MAROON, backgroundColor: '#fce7f0', padding: '2px 8px', borderRadius: '999px' },
  ledgerMeta: { marginTop: '4px', fontSize: '12px', color: '#6b7280' },
  ledgerNote: { marginTop: '4px', fontSize: '13px', color: '#374151' },
};

export default PlanPurchaseDetailModal;
