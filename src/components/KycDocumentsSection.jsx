import React, { useState, useEffect } from 'react';
import { FiFileText, FiExternalLink, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';

export function normalizeFirebaseStorageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const match = url.match(/^(https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/)([^?]+)(\?.*)?$/);
  if (match) {
    const [, prefix, rawPath, query] = match;
    const decodedPath = decodeURIComponent(rawPath);
    const encodedPath = encodeURIComponent(decodedPath);
    return `${prefix}${encodedPath}${query || ''}`;
  }
  return url;
}

function extractKycFromObject(obj) {
  if (!obj || typeof obj !== 'object') return null;

  const proofType = obj.proofType || obj.ProofType || obj.proof_type || obj.idType || obj.documentType || '';
  const proofNo = obj.proofNo || obj.proofNumber || obj.ProofNo || obj.idNumber || obj.documentNo || obj.aadharNo || obj.panNo || '';

  const frontKeys = [
    'proofFrontUrl', 'proofFront', 'ProofFront', 'ProofFrontUrl',
    'idFrontUrl', 'idFront', 'frontImage', 'frontUrl', 'panCard',
    'aadharCard', 'bankFrontUrl', 'bankFront', 'passbookFrontUrl', 'passbookFront'
  ];
  let proofFrontUrl = '';
  for (const k of frontKeys) {
    if (obj[k] && typeof obj[k] === 'string' && obj[k].trim()) {
      proofFrontUrl = normalizeFirebaseStorageUrl(obj[k].trim());
      break;
    }
  }

  const backKeys = [
    'proofBackUrl', 'proofBack', 'ProofBack', 'ProofBackUrl',
    'idBackUrl', 'idBack', 'backImage', 'backUrl',
    'bankBackUrl', 'bankBack', 'passbookBackUrl', 'passbookBack'
  ];
  let proofBackUrl = '';
  for (const k of backKeys) {
    if (obj[k] && typeof obj[k] === 'string' && obj[k].trim()) {
      proofBackUrl = normalizeFirebaseStorageUrl(obj[k].trim());
      break;
    }
  }

  const bankName = obj.bankName || obj.BankName || '';
  const accountNo = obj.accountNo || obj.accountNumber || obj.AccountNo || '';
  const ifsc = obj.ifsc || obj.IFSC || '';
  const branch = obj.branch || obj.Branch || '';
  const holderName = obj.holderName || obj.HolderName || '';

  const hasAny = Boolean(proofType || proofNo || proofFrontUrl || proofBackUrl);
  return {
    hasKyc: hasAny,
    proofType,
    proofNo,
    proofFrontUrl,
    proofBackUrl,
    bankName,
    accountNo,
    ifsc,
    branch,
    holderName,
  };
}

const KycDocImageCard = ({ url, label, onOpen }) => {
  const [failed, setFailed] = useState(false);
  const normalized = normalizeFirebaseStorageUrl(url);

  const isImg =
    typeof normalized === 'string' &&
    (normalized.startsWith('http://') ||
      normalized.startsWith('https://') ||
      normalized.startsWith('data:image') ||
      normalized.startsWith('blob:'));

  return (
    <div style={styles.imageCard}>
      <div style={styles.imageLabelRow}>
        <span style={styles.imageLabel}>{label}</span>
        {isImg && (
          <button
            type="button"
            style={styles.openLink}
            onClick={() => onOpen(normalized)}
          >
            <FiExternalLink size={13} style={{ marginRight: 4 }} /> View Original
          </button>
        )}
      </div>
      {isImg ? (
        failed ? (
          <div style={styles.noImagePlaceholder}>
            <p style={{ margin: 0, marginBottom: 8, color: '#dc2626', fontWeight: 500 }}>
              Could not preview image directly in browser.
            </p>
            <button
              type="button"
              style={{ ...styles.openLink, color: MAROON, textDecoration: 'underline' }}
              onClick={() => onOpen(normalized)}
            >
              Open original file ↗
            </button>
          </div>
        ) : (
          <img
            src={normalized}
            alt={label}
            style={styles.proofImg}
            onError={() => setFailed(true)}
            onClick={() => onOpen(normalized)}
            title="Click to view full size"
          />
        )
      ) : (
        <div style={styles.noImagePlaceholder}>
          {normalized ? String(normalized) : `${label} not uploaded`}
        </div>
      )}
    </div>
  );
};

export const KycDocumentsSection = ({
  entity,
  extraEntities = [],
  title = 'KYC Verification Documents',
  style = {},
}) => {
  const [asyncKyc, setAsyncKyc] = useState(null);
  const [loading, setLoading] = useState(false);

  // 1. Direct extraction from primary entity
  const direct = extractKycFromObject(entity) || {};

  // 2. Extra entities extraction
  let merged = { ...direct };
  const extras = Array.isArray(extraEntities) ? extraEntities : [extraEntities].filter(Boolean);
  for (const ext of extras) {
    const extKyc = extractKycFromObject(ext);
    if (extKyc) {
      if (!merged.proofType && extKyc.proofType) merged.proofType = extKyc.proofType;
      if (!merged.proofNo && extKyc.proofNo) merged.proofNo = extKyc.proofNo;
      if (!merged.proofFrontUrl && extKyc.proofFrontUrl) merged.proofFrontUrl = extKyc.proofFrontUrl;
      if (!merged.proofBackUrl && extKyc.proofBackUrl) merged.proofBackUrl = extKyc.proofBackUrl;
      if (!merged.bankName && extKyc.bankName) merged.bankName = extKyc.bankName;
      if (!merged.accountNo && extKyc.accountNo) merged.accountNo = extKyc.accountNo;
      if (!merged.ifsc && extKyc.ifsc) merged.ifsc = extKyc.ifsc;
      if (!merged.branch && extKyc.branch) merged.branch = extKyc.branch;
      if (extKyc.hasKyc) merged.hasKyc = true;
    }
  }

  // 3. Fallback async lookup if front/back or proofType is missing
  const needsAsyncLookup = (!merged.proofFrontUrl || !merged.proofType) && Boolean(entity?.cusId || entity?.mobile || entity?.customerId);

  useEffect(() => {
    if (!needsAsyncLookup) return;
    let isMounted = true;
    const cusId = String(entity?.cusId || entity?.customerId || '').trim();
    const mobile = String(entity?.mobile || entity?.parent_mobile || '').trim();

    async function fetchFallback() {
      setLoading(true);
      try {
        const collections = ['customers', 'app_users', 'planPurchases'];
        for (const col of collections) {
          if (cusId) {
            const qCus = query(collection(db, col), where('cusId', '==', cusId));
            const snapCus = await getDocs(qCus);
            for (const docSnap of snapCus.docs) {
              const k = extractKycFromObject(docSnap.data());
              if (k && (k.proofFrontUrl || k.proofType || k.proofNo)) {
                if (isMounted) setAsyncKyc(k);
                return;
              }
            }
          }
          if (mobile) {
            const qMob = query(collection(db, col), where('mobile', '==', mobile));
            const snapMob = await getDocs(qMob);
            for (const docSnap of snapMob.docs) {
              const k = extractKycFromObject(docSnap.data());
              if (k && (k.proofFrontUrl || k.proofType || k.proofNo)) {
                if (isMounted) setAsyncKyc(k);
                return;
              }
            }
          }
        }
      } catch (err) {
        console.warn('KYC fallback search failed:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchFallback();
    return () => {
      isMounted = false;
    };
  }, [entity?.cusId, entity?.customerId, entity?.mobile, needsAsyncLookup]);

  // Combine merged with asyncKyc
  if (asyncKyc) {
    if (!merged.proofType && asyncKyc.proofType) merged.proofType = asyncKyc.proofType;
    if (!merged.proofNo && asyncKyc.proofNo) merged.proofNo = asyncKyc.proofNo;
    if (!merged.proofFrontUrl && asyncKyc.proofFrontUrl) merged.proofFrontUrl = asyncKyc.proofFrontUrl;
    if (!merged.proofBackUrl && asyncKyc.proofBackUrl) merged.proofBackUrl = asyncKyc.proofBackUrl;
    if (!merged.bankName && asyncKyc.bankName) merged.bankName = asyncKyc.bankName;
    if (!merged.accountNo && asyncKyc.accountNo) merged.accountNo = asyncKyc.accountNo;
    if (!merged.ifsc && asyncKyc.ifsc) merged.ifsc = asyncKyc.ifsc;
    if (!merged.branch && asyncKyc.branch) merged.branch = asyncKyc.branch;
    if (asyncKyc.hasKyc) merged.hasKyc = true;
  }

  const openImage = (url) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isImg = (val) =>
    typeof val === 'string' &&
    (val.startsWith('http://') ||
      val.startsWith('https://') ||
      val.startsWith('data:image') ||
      val.startsWith('blob:'));

  const hasAnyKycData = Boolean(
    merged.proofType || merged.proofNo || merged.proofFrontUrl || merged.proofBackUrl
  );

  return (
    <div style={{ ...styles.container, ...style }}>
      <div style={styles.headerRow}>
        <h3 style={styles.title}>
          <FiFileText size={17} color={MAROON} />
          <span>{title}</span>
        </h3>
        {hasAnyKycData ? (
          <span style={styles.verifiedBadge}>
            <FiCheckCircle size={13} style={{ marginRight: 4 }} /> KYC Submitted
          </span>
        ) : (
          <span style={styles.pendingBadge}>
            <FiAlertCircle size={13} style={{ marginRight: 4 }} /> KYC Not Uploaded
          </span>
        )}
      </div>

      {hasAnyKycData ? (
        <>
          <div style={styles.metaGrid}>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Proof Type</span>
              <strong style={styles.metaValue}>{merged.proofType || 'Government ID Proof'}</strong>
            </div>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Proof Number</span>
              <strong style={styles.metaValue}>{merged.proofNo || '—'}</strong>
            </div>
            {merged.bankName && (
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Bank Name</span>
                <span style={styles.metaValue}>{merged.bankName}</span>
              </div>
            )}
            {merged.accountNo && (
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Account Number</span>
                <span style={styles.metaValue}>{merged.accountNo}</span>
              </div>
            )}
          </div>

          <div style={styles.proofGrid}>
            <KycDocImageCard
              url={merged.proofFrontUrl}
              label="Proof Document (Front)"
              onOpen={openImage}
            />
            <KycDocImageCard
              url={merged.proofBackUrl}
              label="Proof Document (Back)"
              onOpen={openImage}
            />
          </div>
        </>
      ) : (
        <div style={styles.emptyNotice}>
          <FiAlertCircle size={22} color="#9ca3af" />
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            {loading ? 'Checking for KYC documents…' : 'No KYC documents (Aadhaar / PAN Card / ID Proof) uploaded yet.'}
          </p>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#fff',
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '10px',
    padding: '16px 20px',
    marginTop: '20px',
    marginBottom: '20px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  title: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  verifiedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: '6px',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    fontSize: '12px',
    fontWeight: '600',
  },
  pendingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: '6px',
    backgroundColor: '#fef3c7',
    color: '#b45309',
    fontSize: '12px',
    fontWeight: '600',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    paddingBottom: '14px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
    marginBottom: '14px',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  metaLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: '13px',
    color: '#111827',
    fontWeight: '600',
  },
  proofGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  imageCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  imageLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
  },
  openLink: {
    background: 'none',
    border: 'none',
    color: MAROON,
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
  },
  proofImg: {
    width: '100%',
    maxHeight: '220px',
    minHeight: '130px',
    objectFit: 'contain',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
    cursor: 'pointer',
    transition: 'transform 0.15s ease',
  },
  noImagePlaceholder: {
    padding: '30px 16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: `1px dashed ${BORDER_GRAY}`,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '12px',
  },
  emptyNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: `1px dashed ${BORDER_GRAY}`,
  },
};

export default KycDocumentsSection;
