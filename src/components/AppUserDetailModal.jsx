import React from 'react';
import { FiX, FiExternalLink, FiUser, FiMapPin, FiLock, FiCreditCard, FiFileText } from 'react-icons/fi';
import Button from './Button';
import { formatToIST } from '../utils/dateUtils';
import { formatINR } from '../utils/currencyUtils';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';

function formatDisplayDate(ts) {
  if (!ts) return '—';
  if (typeof ts?.toDate === 'function') return formatToIST(ts.toDate().toISOString());
  return formatToIST(ts);
}

const DetailItem = ({ label, value, isBadge, badgeColor }) => {
  if (value === undefined || value === null || value === '') {
    return (
      <div style={styles.detailItem}>
        <span style={styles.detailLabel}>{label}</span>
        <span style={{ ...styles.detailValue, color: '#9ca3af', fontWeight: '400' }}>—</span>
      </div>
    );
  }
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>{label}</span>
      {isBadge ? (
        <span style={{ ...styles.badge, backgroundColor: badgeColor || '#16a34a' }}>
          {String(value)}
        </span>
      ) : (
        <span style={styles.detailValue}>{String(value)}</span>
      )}
    </div>
  );
};

const DocumentImage = ({ rawValue, label }) => {
  if (!rawValue) return null;
  const isImg =
    typeof rawValue === 'string' &&
    (rawValue.startsWith('data:image') ||
      rawValue.startsWith('blob:') ||
      rawValue.startsWith('http://') ||
      rawValue.startsWith('https://'));

  const openImage = () => {
    if (isImg) window.open(rawValue, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={styles.imageCard}>
      <div style={styles.imageLabelRow}>
        <span style={styles.imageLabel}>{label}</span>
        {isImg && (
          <button type="button" style={styles.openLink} onClick={openImage}>
            <FiExternalLink size={13} style={{ marginRight: 4 }} /> View Original
          </button>
        )}
      </div>
      {isImg ? (
        <img
          src={rawValue}
          alt={label}
          style={styles.proofImage}
          onClick={openImage}
          title="Click to view full size"
        />
      ) : (
        <span style={styles.detailValue}>{String(rawValue)}</span>
      )}
    </div>
  );
};

const AppUserDetailModal = ({ user, onClose, onEdit }) => {
  if (!user) return null;

  const isCompleted = Boolean(user.profileCompleted);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.box} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={styles.title}>App User Details</h2>
            <span
              style={{
                ...styles.badge,
                backgroundColor: isCompleted ? '#16a34a' : '#f59e0b',
              }}
            >
              {isCompleted ? 'Profile Completed' : 'Profile Pending'}
            </span>
          </div>
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Close">
            <FiX size={22} />
          </button>
        </div>

        <div style={styles.body}>
          {/* User Profile */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <FiUser size={16} /> Personal Information
            </h3>
            <div style={styles.grid}>
              <DetailItem label="Full Name" value={user.name} />
              <DetailItem label="Customer ID" value={user.cusId} />
              <DetailItem label="Mobile Number" value={user.mobile} />
              <DetailItem label="Email Address" value={user.email} />
              <DetailItem label="Gender" value={user.gender} />
              <DetailItem label="Date of Birth" value={user.dob} />
              <DetailItem label="Wedding Date" value={user.weddingDate} />
              <DetailItem label="User Type / Role" value={user.role || user.type || 'app_user'} />
            </div>
          </div>

          {/* Address */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <FiMapPin size={16} /> Address & Location
            </h3>
            <div style={styles.grid}>
              <div style={{ gridColumn: 'span 2' }}>
                <DetailItem label="Full Address" value={user.address} />
              </div>
              <DetailItem label="City" value={user.city} />
              <DetailItem label="State" value={user.state} />
              <DetailItem label="Pincode" value={user.pincode} />
            </div>
          </div>

          {/* Security & Credentials */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <FiLock size={16} /> Security & Account Credentials
            </h3>
            <div style={styles.grid}>
              <DetailItem label="MPIN" value={user.mpin} />
              <DetailItem label="Password" value={user.password} />
              <DetailItem label="Joined Date (IST)" value={formatDisplayDate(user.createdAt || user.joinedDate)} />
              <DetailItem
                label="Expo Push Token"
                value={user.expoPushToken ? 'Registered (Active)' : 'Not Registered'}
                isBadge
                badgeColor={user.expoPushToken ? '#2563eb' : '#9ca3af'}
              />
            </div>
          </div>

          {/* Wallet Summary */}
          {user.wallet && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <FiCreditCard size={16} /> App Wallet Details
              </h3>
              <div style={styles.grid}>
                <DetailItem label="Wallet Balance" value={formatINR(user.wallet.balance ?? 0)} />
                <DetailItem label="Available Bonus" value={formatINR(user.wallet.availableBonus ?? 0)} />
                <DetailItem label="Reward Points" value={user.wallet.rewardPoints ?? 0} />
              </div>
            </div>
          )}

          {/* Bank & Nominee */}
          {(user.bankName || user.accountNo || user.nomineeName) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <FiCreditCard size={16} /> Bank & Nominee Information
              </h3>
              <div style={styles.grid}>
                <DetailItem label="Bank Name" value={user.bankName} />
                <DetailItem label="Account Holder" value={user.holderName} />
                <DetailItem label="Account Number" value={user.accountNo} />
                <DetailItem label="IFSC Code" value={user.ifsc} />
                <DetailItem label="Branch" value={user.branch} />
                <DetailItem label="Nominee Name" value={user.nomineeName} />
                <DetailItem label="Nominee Relation" value={user.nomineeRelation} />
              </div>
            </div>
          )}

          {/* Documents & KYC */}
          {(user.proofType || user.proofNo || user.proofFrontUrl || user.proofBackUrl) && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <FiFileText size={16} /> KYC Verification Documents
              </h3>
              <div style={styles.grid}>
                <DetailItem label="Proof Type" value={user.proofType} />
                <DetailItem label="Proof Number" value={user.proofNo} />
              </div>
              <div style={styles.proofGrid}>
                <DocumentImage rawValue={user.proofFrontUrl} label="Proof Document (Front)" />
                <DocumentImage rawValue={user.proofBackUrl} label="Proof Document (Back)" />
              </div>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          {onEdit && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onClose();
                onEdit(user);
              }}
            >
              Edit User Details
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
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
    maxWidth: '780px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '4px',
    display: 'flex',
  },
  body: {
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  section: {
    paddingBottom: '16px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: MAROON,
    marginBottom: '14px',
    marginTop: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '14px 18px',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  detailLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: '14px',
    color: '#111827',
    fontWeight: '600',
    wordBreak: 'break-word',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    width: 'fit-content',
  },
  proofGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    marginTop: '14px',
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
  proofImage: {
    width: '100%',
    maxHeight: '220px',
    objectFit: 'contain',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 24px',
    borderTop: `1px solid ${BORDER_GRAY}`,
    backgroundColor: '#fafafa',
    borderBottomLeftRadius: '12px',
    borderBottomRightRadius: '12px',
  },
};

export default AppUserDetailModal;
