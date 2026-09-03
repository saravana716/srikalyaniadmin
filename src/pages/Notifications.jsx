import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { FiSettings, FiBell, FiMenu } from 'react-icons/fi';
import { sendCustomNotification } from '../services/notificationService';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

const Notifications = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (sending || !title || !body) return;
    
    setSending(true);
    setSendError(null);
    setSendSuccess(false);
    
    try {
      await sendCustomNotification(title, body);
      setSendSuccess(true);
      setTitle('');
      setBody('');
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      console.error('Send custom notification failed', err);
      setSendError(err?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main style={styles.main} className="dashboard-main">
        <header style={styles.header} className="dashboard-header">
          <div style={styles.headerRow}>
            <button style={styles.hamburger} className="mobile-hamburger" onClick={() => setIsSidebarOpen(true)}>
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Send Notifications</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <div style={styles.headerIcons}>
              <button style={styles.iconButton}><FiSettings /></button>
              <button style={styles.iconButton}>
                <span style={styles.notifBadge}>1</span>
                <FiBell />
              </button>
              <img src="https://ui-avatars.com/api/?name=User&background=random" alt="Profile" style={styles.avatar} />
            </div>
          </div>
        </header>

        <div style={styles.contentWrap}>
          <div style={styles.inputCard}>
            <h3 style={styles.inputCardTitle}>Custom Push Notification</h3>
            <p style={styles.cardDesc}>Send a custom push notification to all registered customers.</p>
            
            <form onSubmit={handleSend}>
              {sendError && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{sendError}</p>}
              {sendSuccess && <p style={{ color: '#059669', marginBottom: 12, fontSize: 14 }}>Push notification sent successfully!</p>}
              
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Notification Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Special Offer Today!" 
                  style={styles.input} 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  required
                />
              </div>
              
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Notification Body</label>
                <textarea 
                  placeholder="e.g. Get 5% off on making charges..." 
                  style={{...styles.input, height: '100px', resize: 'vertical'}} 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)} 
                  required
                />
              </div>
              
              <Button type="submit" loading={sending} loadingText="Sending…">Send Notification</Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#fff' },
  main: { marginLeft: '260px', flex: 1, padding: '24px 40px', backgroundColor: '#fff', maxWidth: '100vw', transition: 'margin-left 0.3s ease' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px', flexWrap: 'wrap' },
  headerRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  pageTitle: { fontSize: '28px', color: MAROON, fontWeight: '700' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  headerIcons: { display: 'flex', alignItems: 'center', gap: '10px' },
  iconButton: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: LIGHT_GRAY, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666', fontSize: '18px', position: 'relative' },
  notifBadge: { position: 'absolute', top: '6px', right: '8px', minWidth: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ff4444', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  avatar: { width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },

  contentWrap: { display: 'flex', gap: '24px', flexWrap: 'wrap' },
  inputCard: {
    flex: '1',
    maxWidth: '600px',
    borderRadius: '10px',
    padding: '28px',
    backgroundColor: '#fff',
    border: `1px solid ${BORDER_GRAY}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  inputCardTitle: { fontSize: '17px', fontWeight: '600', color: '#111827', marginBottom: '8px', marginTop: 0, letterSpacing: '-0.02em' },
  cardDesc: { fontSize: '14px', color: '#6b7280', marginBottom: '20px' },
  inputGroup: { marginBottom: '18px' },
  inputLabel: { display: 'block', fontSize: '13px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
    fontSize: '14px',
    backgroundColor: '#fff',
    color: '#111827',
    boxSizing: 'border-box',
    outline: 'none',
  },
};

export default Notifications;
