import React, { useState, useEffect } from 'react';
import { resolveImageSrcAsync } from '../utils/imageUtils';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';

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
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>{label}</span>
      {isStatus ? (
        <span style={display === 'Active' ? styles.badgeActive : styles.badgeInactive}>{display}</span>
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

export const PlanPurchaseDetailModal = ({ row, onClose }) => {
  if (!row) return null;

  const openImage = (src) => {
    if (src) window.open(src, '_blank', 'noopener,noreferrer');
  };

  const frontRaw = pickRawImage(row, 'front');
  const backRaw = pickRawImage(row, 'back');

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
              <DetailItem label="Saved Amount" value={row.savedAmount != null ? `₹${row.savedAmount}` : null} />
              <DetailItem label="Saved Weight" value={row.savedWeight != null ? `${row.savedWeight} g` : null} />
              <DetailItem label="Paid Installments" value={row.paidInstallments} />
            </div>
          </div>

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
  proofImagesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginTop: '16px' },
  imageCard: { display: 'flex', flexDirection: 'column', gap: '8px' },
  imageLabelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  imageLabel: { fontSize: '13px', color: '#374151', fontWeight: '600' },
  openLink: { background: 'none', border: 'none', color: MAROON, fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0, textDecoration: 'underline' },
  openLinkBlock: { display: 'block', marginTop: '8px', background: 'none', border: 'none', color: MAROON, fontSize: '13px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' },
  proofImage: { width: '100%', maxHeight: '360px', minHeight: '180px', objectFit: 'contain', backgroundColor: '#f3f4f6', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, cursor: 'pointer' },
  imagePlaceholder: { width: '100%', minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', border: `1px dashed ${BORDER_GRAY}`, color: '#6b7280', fontSize: '14px', padding: '16px', textAlign: 'center' },
};

export default PlanPurchaseDetailModal;
