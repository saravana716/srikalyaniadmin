import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import Button from './Button';

const MAROON = '#801A39';
const BORDER_GRAY = '#e0e0e0';

const EditAppUserModal = ({ user, onClose, onSave, saving, error }) => {
  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [email, setEmail] = useState(user?.email || '');
  const [gender, setGender] = useState(user?.gender || 'Male');
  const [dob, setDob] = useState(user?.dob || '');
  const [address, setAddress] = useState(user?.address || '');
  const [city, setCity] = useState(user?.city || '');
  const [state, setState] = useState(user?.state || 'Tamil Nadu');
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [mpin, setMpin] = useState(user?.mpin || '');
  const [password, setPassword] = useState(user?.password || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (saving) return;

    onSave(user.id, {
      name: name.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
      gender,
      dob,
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      mpin: mpin.trim(),
      password: password.trim(),
    });
  };

  return (
    <div style={styles.overlay} onClick={() => { if (!saving) onClose(); }}>
      <div style={styles.box} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Edit App User</h2>
          <button type="button" style={styles.closeBtn} onClick={onClose} disabled={saving} aria-label="Close">
            <FiX size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.body}>
          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>Customer ID</label>
              <input style={{ ...styles.input, backgroundColor: '#f3f4f6' }} value={user?.cusId || '—'} readOnly disabled />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Full Name *</label>
              <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>Mobile Number *</label>
              <input
                style={styles.input}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
                required
              />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Email Address</label>
              <input type="email" style={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>Gender</label>
              <select style={styles.input} value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Date of Birth</label>
              <input type="date" style={styles.input} value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>

          <div style={styles.col}>
            <label style={styles.label}>Address</label>
            <textarea
              style={{ ...styles.input, minHeight: 60 }}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>City</label>
              <input style={styles.input} value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>State</label>
              <input style={styles.input} value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Pincode</label>
              <input style={styles.input} value={pincode} onChange={(e) => setPincode(e.target.value)} maxLength={6} />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>MPIN (4 digits)</label>
              <input
                style={styles.input}
                value={mpin}
                onChange={(e) => setMpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
              />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Password</label>
              <input style={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <div style={styles.footer}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} loadingText="Saving…">
              Save Changes
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
    maxWidth: '600px',
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
    padding: '16px 20px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#111',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    padding: '4px',
    display: 'flex',
  },
  body: {
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
  row: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  col: {
    flex: 1,
    minWidth: '160px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    border: `1px solid ${BORDER_GRAY}`,
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
    color: '#111827',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    paddingTop: '16px',
    borderTop: `1px solid ${BORDER_GRAY}`,
    marginTop: '8px',
  },
};

export default EditAppUserModal;
