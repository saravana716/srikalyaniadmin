import React, { useRef, useState } from 'react';
import { FiDownload, FiUpload, FiX, FiFile } from 'react-icons/fi';
import Button from './Button';
import { downloadCancelChitPdf } from '../utils/cancelChitPdf';
import { validateCancelFormFile } from '../utils/uploadImage';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';

/**
 * Cancel active chit: fill details → download PDF → upload signed form.
 */
const CancelChitModal = ({ planPurchase, onClose, onSubmit, saving, error }) => {
  const fileInputRef = useRef(null);
  const [name, setName] = useState(planPurchase?.name || planPurchase?.customerName || '');
  const [location, setLocation] = useState(planPurchase?.city || planPurchase?.location || '');
  const [address, setAddress] = useState(planPurchase?.address || '');
  const [reason, setReason] = useState('');
  const [monthsPaid, setMonthsPaid] = useState(planPurchase?.monthsPaid || '');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [signedFile, setSignedFile] = useState(null);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [localError, setLocalError] = useState('');

  const formPayload = () => ({
    cancelName: name.trim(),
    cancelLocation: location.trim(),
    cancelAddress: address.trim(),
    cancelReason: reason.trim(),
    monthsPaid: monthsPaid === '' ? null : Number(monthsPaid),
    penaltyAmount: penaltyAmount === '' ? null : Number(penaltyAmount),
  });

  const validateFields = () => {
    if (!name.trim() || !location.trim() || !address.trim()) {
      return 'Name, Location and Address are required.';
    }
    const penalty = Number(penaltyAmount);
    if (penaltyAmount === '' || Number.isNaN(penalty) || penalty < 0) {
      return 'Enter a valid penalty amount (0 or more).';
    }
    return '';
  };

  const handleDownloadPdf = async () => {
    const err = validateFields();
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError('');
    setDownloadingPdf(true);
    try {
      await downloadCancelChitPdf({
        planPurchase,
        form: formPayload(),
      });
      setPdfDownloaded(true);
    } catch (e) {
      console.error('PDF download failed', e);
      setLocalError(e?.message || 'Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSignedFile(null);
      return;
    }
    const err = validateCancelFormFile(file);
    if (err) {
      setLocalError(err);
      setSignedFile(null);
      e.target.value = '';
      return;
    }
    setLocalError('');
    setSignedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const err = validateFields();
    if (err) {
      setLocalError(err);
      return;
    }
    if (!signedFile) {
      setLocalError('Download the PDF, get signatures, then upload the signed form.');
      return;
    }

    setLocalError('');
    await onSubmit({
      ...formPayload(),
      signedFormFile: signedFile,
    });
  };

  return (
    <div style={styles.overlay} onClick={() => { if (!saving) onClose(); }}>
      <div style={styles.box} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Cancel Chit — Penalty Form</h2>
          <button type="button" style={styles.close} onClick={onClose} disabled={saving} aria-label="Close">
            <FiX size={22} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={styles.body}>
          <p style={styles.meta}>
            Plan: <strong>{planPurchase?.planName || planPurchase?.plan || '—'}</strong>
            {' · '}
            Customer: <strong>{planPurchase?.customerName || planPurchase?.name || '—'}</strong>
          </p>

          <ol style={styles.steps}>
            <li>Fill the penalty details below</li>
            <li>Download the PDF form and get Authority + Customer signatures</li>
            <li>Upload the signed PDF/image, then confirm cancel</li>
          </ol>

          {(localError || error) && <p style={styles.error}>{localError || error}</p>}

          <label style={styles.label}>Name *</label>
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />

          <label style={styles.label}>Location *</label>
          <input style={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City / Branch" required />

          <label style={styles.label}>Address *</label>
          <textarea
            style={{ ...styles.input, minHeight: 70 }}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />

          <label style={styles.label}>Reason for Cancel <span style={styles.optional}>(optional)</span></label>
          <textarea
            style={{ ...styles.input, minHeight: 70 }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason now, or leave blank and write by hand after printing"
          />
          <p style={styles.hint}>You can skip this and fill the reason manually on the printed form.</p>

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>Months paid</label>
              <input
                type="number"
                min="0"
                style={styles.input}
                value={monthsPaid}
                onChange={(e) => setMonthsPaid(e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Penalty Amount (₹) *</label>
              <input
                type="number"
                min="0"
                style={styles.input}
                value={penaltyAmount}
                onChange={(e) => setPenaltyAmount(e.target.value)}
                placeholder="Enter penalty"
                required
              />
            </div>
          </div>

          <div style={styles.actionBlock}>
            <p style={styles.blockTitle}>1. Download PDF form</p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDownloadPdf}
              disabled={saving}
              loading={downloadingPdf}
              loadingText="Preparing PDF…"
              fullWidth
            >
              <span style={styles.btnInner}><FiDownload size={16} /> Download Cancel Chit PDF</span>
            </Button>
            {pdfDownloaded && (
              <p style={styles.hintOk}>PDF downloaded. Get wet-ink signatures, then upload below.</p>
            )}
          </div>

          <div style={styles.actionBlock}>
            <p style={styles.blockTitle}>2. Upload signed form *</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              type="button"
              style={styles.uploadBtn}
              disabled={saving}
              onClick={() => fileInputRef.current?.click()}
            >
              <FiUpload size={18} />
              {signedFile ? 'Change file' : 'Choose signed PDF or image'}
            </button>
            {signedFile && (
              <div style={styles.fileChip}>
                <FiFile size={16} />
                <span style={styles.fileName}>{signedFile.name}</span>
                <button
                  type="button"
                  style={styles.clearFile}
                  disabled={saving}
                  onClick={() => {
                    setSignedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  aria-label="Remove file"
                >
                  <FiX size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="app-modal-footer" style={styles.footer}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Back</Button>
            <Button type="submit" variant="danger" loading={saving} loadingText="Cancelling…">
              Confirm Cancel Chit
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: `1px solid ${BORDER_GRAY}`, position: 'sticky', top: 0, background: '#fff', zIndex: 1 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: MAROON },
  close: { background: 'none', border: 'none', cursor: 'pointer', color: '#666' },
  body: { padding: 20, display: 'flex', flexDirection: 'column', gap: 8 },
  meta: { margin: '0 0 4px', fontSize: 13, color: '#4b5563' },
  steps: { margin: '0 0 8px', paddingLeft: 18, fontSize: 13, color: '#6b7280', lineHeight: 1.5 },
  error: { color: '#dc2626', fontSize: 14, margin: 0 },
  label: { fontSize: 14, fontWeight: 500, color: '#374151', marginTop: 6 },
  optional: { fontWeight: 400, color: '#9ca3af', fontSize: 12 },
  hint: { margin: '2px 0 0', fontSize: 12, color: '#6b7280' },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER_GRAY}`, fontSize: 14, boxSizing: 'border-box' },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  col: { flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 6 },
  actionBlock: {
    marginTop: 10,
    padding: 14,
    borderRadius: 10,
    border: `1px solid ${BORDER_GRAY}`,
    backgroundColor: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  blockTitle: { margin: 0, fontSize: 13, fontWeight: 700, color: MAROON, letterSpacing: '0.02em' },
  btnInner: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  hintOk: { margin: 0, fontSize: 12, color: '#16a34a' },
  uploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: `1px dashed ${MAROON}`,
    backgroundColor: '#fff',
    color: MAROON,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  fileChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 8,
    backgroundColor: '#fce7f0',
    color: MAROON,
    fontSize: 13,
  },
  fileName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  clearFile: { background: 'none', border: 'none', cursor: 'pointer', color: MAROON, padding: 2, display: 'flex' },
  footer: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 16 },
};

export default CancelChitModal;
