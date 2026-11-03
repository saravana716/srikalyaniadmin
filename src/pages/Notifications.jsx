import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { FiSettings, FiBell, FiMenu, FiSend, FiSmartphone, FiUsers, FiClock, FiTrash2, FiTrendingUp } from 'react-icons/fi';
import { sendCustomNotification, sendGoldRateNotification, getRegisteredPushTokensCount } from '../services/notificationService';
import { subscribeNotifications, deleteNotification } from '../services/notificationsService';
import { subscribeGoldRates } from '../services/goldRatesService';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

const formatDate = (isoString) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
};

const Notifications = () => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(null);

  // Quick Gold Rate states
  const [latestRates, setLatestRates] = useState([]);
  const [sendingGoldRate, setSendingGoldRate] = useState(false);
  const [goldRateSuccess, setGoldRateSuccess] = useState(null);
  const [goldRateError, setGoldRateError] = useState(null);

  // Stats & History
  const [deviceStats, setDeviceStats] = useState({ totalUsers: 0, registeredDevices: 0 });
  const [history, setHistory] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  // Load stats
  const fetchStats = async () => {
    const stats = await getRegisteredPushTokensCount();
    setDeviceStats(stats);
  };

  useEffect(() => {
    fetchStats();
    const unsubHistory = subscribeNotifications((data) => {
      setHistory(data);
    });
    const unsubRates = subscribeGoldRates((rates) => {
      setLatestRates(rates);
    });

    return () => {
      unsubHistory();
      unsubRates();
    };
  }, []);

  const latestGoldRate = latestRates[0];

  const handleSendCustom = async (e) => {
    e.preventDefault();
    if (sending || !title.trim() || !body.trim()) return;

    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      const res = await sendCustomNotification(title.trim(), body.trim());
      setSendSuccess(`Notification successfully delivered to ${res?.count || 1} registered device(s)!`);
      setTitle('');
      setBody('');
      fetchStats();
      setTimeout(() => setSendSuccess(null), 5000);
    } catch (err) {
      console.error('Send custom notification failed', err);
      setSendError(err?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleSendGoldRate = async () => {
    if (!latestGoldRate?.goldRate && !latestGoldRate?.silverRate) {
      setGoldRateError('No recent gold or silver rate found. Please add a rate first in Gold Rate Manage.');
      return;
    }
    setSendingGoldRate(true);
    setGoldRateError(null);
    setGoldRateSuccess(null);

    try {
      const res = await sendGoldRateNotification(latestGoldRate.goldRate || '—', latestGoldRate.silverRate || '—');
      setGoldRateSuccess(`Today's rate notification sent to ${res?.count || 1} device(s)!`);
      fetchStats();
      setTimeout(() => setGoldRateSuccess(null), 5000);
    } catch (err) {
      console.error('Send gold rate notification failed', err);
      setGoldRateError(err?.message || 'Failed to send rate notification');
    } finally {
      setSendingGoldRate(false);
    }
  };

  const handleDeleteHistory = async (id) => {
    if (!id || deletingId) return;
    if (!window.confirm('Are you sure you want to delete this notification record?')) return;
    setDeletingId(id);
    try {
      await deleteNotification(id);
    } catch (err) {
      console.error('Failed to delete notification', err);
    } finally {
      setDeletingId(null);
    }
  };

  const avatarName = encodeURIComponent(user?.name || user?.email || 'Admin');

  return (
    <div style={styles.container} className="dashboard-container">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main style={styles.main} className="dashboard-main">
        {/* Header */}
        <header style={styles.header} className="dashboard-header">
          <div style={styles.headerRow}>
            <button
              type="button"
              style={styles.hamburger}
              className="mobile-hamburger"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <FiMenu size={24} color={MAROON} />
            </button>
            <div>
              <h1 style={styles.pageTitle}>Push Notifications</h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                Broadcast push notifications to customer mobile devices
              </p>
            </div>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <div style={styles.headerIcons}>
              <button
                type="button"
                style={styles.iconButton}
                aria-label="Notifications"
                title="Notifications"
              >
                {history.length > 0 && (
                  <span style={styles.notifBadge}>
                    {history.length > 9 ? '9+' : history.length}
                  </span>
                )}
                <FiBell />
              </button>
              <img
                src={`https://ui-avatars.com/api/?name=${avatarName}&background=801A39&color=fff`}
                alt="Profile"
                style={styles.avatar}
              />
            </div>
          </div>
        </header>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <FiSmartphone size={22} />
            </div>
            <div>
              <div style={styles.statLabel}>Active Push Devices</div>
              <div style={styles.statValue}>{deviceStats.registeredDevices}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, backgroundColor: '#fdf2f8', color: MAROON }}>
              <FiUsers size={22} />
            </div>
            <div>
              <div style={styles.statLabel}>Total App Users</div>
              <div style={styles.statValue}>{deviceStats.totalUsers}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <FiSend size={22} />
            </div>
            <div>
              <div style={styles.statLabel}>Total Sent Notifications</div>
              <div style={styles.statValue}>{history.length}</div>
            </div>
          </div>
        </div>

        {/* Action Cards Row */}
        <div style={styles.cardsGrid}>
          {/* Custom Push Card */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Send Custom Notification</h3>
              <p style={styles.cardDesc}>
                Compose a custom message delivered instantly to all registered customer devices.
              </p>
            </div>

            <form onSubmit={handleSendCustom}>
              {sendError && (
                <div style={styles.errorAlert}>
                  {sendError}
                </div>
              )}
              {sendSuccess && (
                <div style={styles.successAlert}>
                  {sendSuccess}
                </div>
              )}

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>
                  Notification Title <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festival Offer or New Scheme Launched!"
                  style={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>
                  Message Body <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  placeholder="e.g. Special festive discount on making charges! Check out our new collection today."
                  style={{ ...styles.input, height: '95px', resize: 'vertical' }}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                loading={sending}
                loadingText="Broadcasting to Devices…"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <FiSend size={16} /> Send Push Notification
              </Button>
            </form>
          </div>

          {/* Quick Gold Rate Notification Card */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Quick Gold Rate Broadcast</h3>
              <p style={styles.cardDesc}>
                Instantly notify all customers about today&apos;s live gold and silver rates.
              </p>
            </div>

            {goldRateError && (
              <div style={styles.errorAlert}>{goldRateError}</div>
            )}
            {goldRateSuccess && (
              <div style={styles.successAlert}>{goldRateSuccess}</div>
            )}

            <div style={styles.ratePreviewCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <FiTrendingUp color={MAROON} size={18} />
                <span style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>
                  Current Live Rates ({latestGoldRate?.date || 'Today'})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                <div style={styles.rateBox}>
                  <div style={styles.rateLabel}>Gold (22K / 1g)</div>
                  <div style={styles.rateValue}>₹{latestGoldRate?.goldRate || '—'}</div>
                </div>
                <div style={styles.rateBox}>
                  <div style={styles.rateLabel}>Silver (1g)</div>
                  <div style={styles.rateValue}>₹{latestGoldRate?.silverRate || '—'}</div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#6b7280', margin: '14px 0' }}>
              Preview: <strong>&ldquo;Today&apos;s Gold Rate is Live! ✨ Gold Rate: ₹{latestGoldRate?.goldRate || '—'} / gram. Silver Rate: ₹{latestGoldRate?.silverRate || '—'} / gram.&rdquo;</strong>
            </p>

            <Button
              type="button"
              variant="secondary"
              loading={sendingGoldRate}
              loadingText="Sending Rates…"
              onClick={handleSendGoldRate}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <FiTrendingUp size={16} /> Broadcast Today&apos;s Gold Rate
            </Button>
          </div>
        </div>

        {/* Notifications History */}
        <div style={{ ...styles.card, marginTop: '28px' }}>
          <div style={styles.cardHeader}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={styles.cardTitle}>Recent Notification History</h3>
                <p style={styles.cardDesc}>Log of all push notifications sent to mobile devices.</p>
              </div>
              <button
                type="button"
                onClick={fetchStats}
                style={styles.refreshBtn}
                title="Refresh stats and list"
              >
                Refresh
              </button>
            </div>
          </div>

          {history.length === 0 ? (
            <div style={styles.emptyState}>
              <FiClock size={36} color="#9ca3af" />
              <p style={{ marginTop: '10px', color: '#6b7280', fontSize: '14px' }}>
                No notifications sent yet. Use the form above to broadcast your first notification!
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeadRow}>
                    <th style={styles.th}>Date & Time</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Title</th>
                    <th style={styles.th}>Message</th>
                    <th style={styles.th}>Recipients</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} style={styles.tableRow}>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap', fontSize: '13px', color: '#6b7280' }}>
                        {formatDate(item.createdAt)}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: item.type === 'gold_rate' ? '#fef3c7' : '#ede9fe',
                            color: item.type === 'gold_rate' ? '#92400e' : '#6b21a8',
                          }}
                        >
                          {item.type === 'gold_rate' ? 'Gold Rate' : 'Custom'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontWeight: '600', color: '#111827' }}>
                        {item.title || '—'}
                      </td>
                      <td style={{ ...styles.td, color: '#374151', maxWidth: '300px' }}>
                        {item.body || '—'}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.recipientsBadge}>
                          {item.recipientsCount ?? 'All'} devices
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistory(item.id)}
                          disabled={deletingId === item.id}
                          style={styles.deleteBtn}
                          title="Delete from log"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' },
  main: {
    marginLeft: '260px',
    flex: 1,
    padding: '24px 36px',
    backgroundColor: '#f9fafb',
    maxWidth: 'calc(100vw - 260px)',
    transition: 'margin-left 0.3s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    gap: '20px',
    flexWrap: 'wrap',
  },
  headerRow: { display: 'flex', alignItems: 'center', gap: '14px' },
  pageTitle: { fontSize: '26px', color: MAROON, fontWeight: '700', margin: 0 },
  headerActions: { display: 'flex', alignItems: 'center', gap: '16px' },
  headerIcons: { display: 'flex', alignItems: 'center', gap: '12px' },
  iconButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    border: `1px solid ${BORDER_GRAY}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#4b5563',
    fontSize: '18px',
    position: 'relative',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  notifBadge: {
    position: 'absolute',
    top: '-3px',
    right: '-3px',
    minWidth: '18px',
    height: '18px',
    borderRadius: '9px',
    backgroundColor: '#dc2626',
    color: '#fff',
    fontSize: '10px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  avatar: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    objectFit: 'cover',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },

  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    border: `1px solid ${BORDER_GRAY}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  statIconWrap: {
    width: '46px',
    height: '46px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statLabel: { fontSize: '13px', color: '#6b7280', fontWeight: '500' },
  statValue: { fontSize: '24px', fontWeight: '700', color: '#111827', marginTop: '2px' },

  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '24px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    border: `1px solid ${BORDER_GRAY}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardHeader: { marginBottom: '18px' },
  cardTitle: { fontSize: '17px', fontWeight: '600', color: '#111827', margin: 0, letterSpacing: '-0.02em' },
  cardDesc: { fontSize: '13px', color: '#6b7280', margin: '4px 0 0' },

  inputGroup: { marginBottom: '16px' },
  inputLabel: { display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${BORDER_GRAY}`,
    fontSize: '14px',
    backgroundColor: '#fff',
    color: '#111827',
    boxSizing: 'border-box',
    outline: 'none',
  },

  errorAlert: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: '10px 14px',
    borderRadius: '8px',
    marginBottom: '14px',
    fontSize: '13px',
    border: '1px solid #fecaca',
  },
  successAlert: {
    backgroundColor: '#ecfdf5',
    color: '#047857',
    padding: '10px 14px',
    borderRadius: '8px',
    marginBottom: '14px',
    fontSize: '13px',
    border: '1px solid #a7f3d0',
  },

  ratePreviewCard: {
    backgroundColor: '#f9fafb',
    border: '1px dashed #d1d5db',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '10px',
  },
  rateBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '10px 12px',
    border: `1px solid ${BORDER_GRAY}`,
  },
  rateLabel: { fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' },
  rateValue: { fontSize: '18px', fontWeight: '700', color: MAROON, marginTop: '2px' },

  refreshBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#374151',
  },

  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHeadRow: { backgroundColor: '#f9fafb', borderBottom: `1px solid ${BORDER_GRAY}` },
  th: { padding: '12px 14px', fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' },
  tableRow: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '12px 14px', fontSize: '14px', verticalAlign: 'middle' },
  badge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '600',
  },
  recipientsBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
};

export default Notifications;
