import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { FiSettings, FiBell, FiMenu, FiX, FiEdit2, FiAlertCircle } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import {
  subscribeGoldRates,
  addGoldRate as addGoldRateToDb,
  updateGoldRate as updateGoldRateInDb,
} from '../services/goldRatesService';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';
const PAGE_SIZE = 10;

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  if (dateStr.includes('-') && dateStr.length >= 10) {
    const [y, m, d] = dateStr.slice(0, 10).split('-');
    return `${d}-${m}-${y}`;
  }
  return dateStr;
};

const GoldRateManage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [goldRates, setGoldRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [goldRateInput, setGoldRateInput] = useState('');
  const [silverRateInput, setSilverRateInput] = useState('');
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);

  // Edit State
  const [editingRow, setEditingRow] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editGoldRate, setEditGoldRate] = useState('');
  const [editSilverRate, setEditSilverRate] = useState('');
  const [editError, setEditError] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Duplicate prompt state: { existing, newData, source: 'add' | 'edit' }
  const [duplicatePrompt, setDuplicatePrompt] = useState(null);

  const totalPages = Math.max(1, Math.ceil(goldRates.length / PAGE_SIZE));
  const pagedRates = (loading ? [] : goldRates).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    const unsub = subscribeGoldRates((list) => {
      setGoldRates(list.map((r, i) => ({ ...r, sno: i + 1 })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const latest = goldRates[0];

  // Get distinct last 3 recorded days sorted by date descending
  const recentThreeRates = React.useMemo(() => {
    const map = new Map();
    const sorted = [...goldRates]
      .filter((r) => r.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    for (const r of sorted) {
      if (!map.has(r.date)) {
        map.set(r.date, r);
        if (map.size === 3) break;
      }
    }
    return Array.from(map.values());
  }, [goldRates]);

  const getDayBadge = (dateStr, idx) => {
    const today = new Date().toISOString().slice(0, 10);
    if (dateStr === today) return 'Today';
    if (idx === 0) return 'Today';
    if (idx === 1) return 'Yesterday';
    return '2 Days Ago';
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (adding) return;
    setAddError(null);

    const d = date || new Date().toISOString().slice(0, 10);
    const gr = goldRateInput.trim();
    const sr = silverRateInput.trim();

    if (!gr && !sr) {
      setAddError('Please enter at least gold rate or silver rate.');
      return;
    }

    // Check if entry for this date already exists
    const existing = goldRates.find((r) => r.date === d);
    if (existing) {
      setDuplicatePrompt({
        existing,
        newData: { date: d, goldRate: gr, silverRate: sr },
        source: 'add',
      });
      return;
    }

    setAdding(true);
    try {
      await addGoldRateToDb({ date: d, goldRate: gr, silverRate: sr });
      setDate('');
      setGoldRateInput('');
      setSilverRateInput('');
    } catch (err) {
      console.error('Add gold rate failed', err);
      setAddError(err?.message || 'Failed to add rate');
    } finally {
      setAdding(false);
    }
  };

  const handleOpenEdit = (row) => {
    setEditingRow(row);
    setEditDate(row.date || '');
    setEditGoldRate(row.goldRate || '');
    setEditSilverRate(row.silverRate || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRow?.id || updating) return;
    setEditError(null);

    const d = editDate.trim();
    const gr = editGoldRate.trim();
    const sr = editSilverRate.trim();

    if (!d) {
      setEditError('Date is required');
      return;
    }
    if (!gr && !sr) {
      setEditError('Please enter at least gold rate or silver rate.');
      return;
    }

    // Check if user changed to another existing date row
    const duplicate = goldRates.find((r) => r.date === d && r.id !== editingRow.id);
    if (duplicate) {
      setDuplicatePrompt({
        existing: duplicate,
        newData: { date: d, goldRate: gr, silverRate: sr },
        source: 'edit',
      });
      return;
    }

    setUpdating(true);
    try {
      await updateGoldRateInDb(editingRow.id, {
        date: d,
        goldRate: gr,
        silverRate: sr,
      });
      setEditingRow(null);
    } catch (err) {
      console.error('Update gold rate failed', err);
      setEditError(err?.message || 'Failed to update rate');
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmUpdateDuplicate = async () => {
    if (!duplicatePrompt?.existing?.id) return;
    setUpdating(true);
    try {
      await updateGoldRateInDb(duplicatePrompt.existing.id, duplicatePrompt.newData);
      if (duplicatePrompt.source === 'add') {
        setDate('');
        setGoldRateInput('');
        setSilverRateInput('');
      } else if (duplicatePrompt.source === 'edit') {
        setEditingRow(null);
      }
      setDuplicatePrompt(null);
    } catch (err) {
      console.error('Update existing rate failed', err);
      alert(err?.message || 'Failed to update rate');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container gold-rate-page">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main style={styles.main} className="dashboard-main gold-rate-main">
        <header style={styles.header} className="dashboard-header gold-rate-header">
          <div style={styles.headerRow}>
            <button style={styles.hamburger} className="mobile-hamburger" onClick={() => setIsSidebarOpen(true)}>
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Gold Rate Manage</h1>
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

        <div style={styles.topRow} className="gold-rate-top-row">
          {/* Input Card */}
          <div style={styles.inputCard} className="gold-rate-input-card">
            <h3 style={styles.inputCardTitle}>Today&apos;s Date</h3>
            <form onSubmit={handleAdd}>
              {addError && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{addError}</p>}
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Select Today&apos;s Date</label>
                <input type="date" style={styles.input} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Enter Gold Rate (₹ per gram)</label>
                <input type="text" placeholder="e.g. 7500" style={styles.input} value={goldRateInput} onChange={(e) => setGoldRateInput(e.target.value)} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Enter Silver Rate (₹ per gram)</label>
                <input type="text" placeholder="e.g. 95" style={styles.input} value={silverRateInput} onChange={(e) => setSilverRateInput(e.target.value)} />
              </div>
              <Button type="submit" loading={adding} loadingText="Adding…">Add</Button>
            </form>
          </div>

          {/* Display Card - Last 3 Days from Firestore */}
          <div style={styles.displayCard} className="gold-rate-display-card">
            <div style={styles.displayCardHeader}>
              <span style={styles.displayCardTitle}>Last 3 Days Rates</span>
            </div>

            <div style={styles.daysList}>
              {recentThreeRates.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
                  {loading ? 'Loading rates…' : 'No gold rates recorded yet.'}
                </p>
              ) : (
                recentThreeRates.map((item, idx) => {
                  const dayBadge = getDayBadge(item.date, idx);
                  const isToday = dayBadge === 'Today';

                  return (
                    <div
                      key={item.id || item.date || idx}
                      style={{
                        ...styles.daySection,
                        ...(idx < recentThreeRates.length - 1 ? styles.daySectionBorder : {}),
                      }}
                    >
                      <div style={styles.dayDateRow}>
                        <span style={isToday ? styles.todayBadge : styles.pastDateBadge}>
                          {dayBadge}
                        </span>
                        <span style={styles.displayDate}>{formatDisplayDate(item.date)}</span>
                      </div>

                      <div style={styles.rateList}>
                        <div style={styles.rateRow}>
                          <span style={styles.rateLabel}>Gold Rate</span>
                          <div style={styles.rateValueWrap}>
                            <span style={styles.rateValue}>{item.goldRate ? `₹ ${item.goldRate}` : '—'}</span>
                          </div>
                        </div>
                        <div style={styles.rateRow}>
                          <span style={styles.rateLabel}>Silver Rate</span>
                          <div style={styles.rateValueWrap}>
                            <span style={styles.rateValue}>{item.silverRate ? `₹ ${item.silverRate}` : '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={styles.tableWrap} className="gold-rate-table-wrap">
          <table style={styles.table} className="gold-rate-table">
            <thead>
              <tr>
                <th style={styles.th}><span className="th-content">SNO <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Date <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Gold Rate <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Silver Rate <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}><span className="th-content">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {pagedRates.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#6b7280', padding: '32px' }}>
                    {loading ? 'Loading rates…' : 'No gold rates recorded yet.'}
                  </td>
                </tr>
              ) : (
                pagedRates.map((row) => (
                  <tr key={row.id || row.sno} style={styles.tr}>
                    <td style={styles.td}>{row.sno}</td>
                    <td style={styles.td}>{formatDisplayDate(row.date)}</td>
                    <td style={styles.td}>{row.goldRate ? `₹ ${row.goldRate}` : '—'}</td>
                    <td style={styles.td}>{row.silverRate ? `₹ ${row.silverRate}` : '—'}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.editBtn}
                        onClick={() => handleOpenEdit(row)}
                        title="Edit gold and silver rate"
                      >
                        <FiEdit2 size={13} style={{ marginRight: '6px' }} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={styles.pagination} className="gold-rate-pagination">
          <span style={styles.pageInfo}>Showing page {currentPage} / {totalPages}</span>
          <div style={styles.paginationControls} className="pagination-controls">
            <button
              style={styles.pagBtn}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => (
                <React.Fragment key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ padding: '0 4px', color: '#888' }}>…</span>}
                  <button
                    style={{ ...styles.pagBtn, ...(currentPage === p ? styles.pagBtnActive : {}) }}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                </React.Fragment>
              ))}
            <button
              style={styles.pagBtn}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </main>

      {/* Edit Gold Rate Modal */}
      {editingRow && (
        <div style={styles.modalOverlay} onClick={() => { if (!updating) setEditingRow(null); }}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit Gold &amp; Silver Rate</h3>
              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setEditingRow(null)}
                disabled={updating}
                aria-label="Close"
              >
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} style={styles.modalBody}>
              {editError && <p style={styles.errorText}>{editError}</p>}
              
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Date *</label>
                <input
                  type="date"
                  style={styles.input}
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Gold Rate (₹ per gram)</label>
                <input
                  type="text"
                  placeholder="e.g. 7500"
                  style={styles.input}
                  value={editGoldRate}
                  onChange={(e) => setEditGoldRate(e.target.value)}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Silver Rate (₹ per gram)</label>
                <input
                  type="text"
                  placeholder="e.g. 95"
                  style={styles.input}
                  value={editSilverRate}
                  onChange={(e) => setEditSilverRate(e.target.value)}
                />
              </div>

              <div style={styles.modalFooter}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingRow(null)}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={updating}
                  loadingText="Updating…"
                >
                  Update Rate
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Date Confirmation Modal */}
      {duplicatePrompt && (
        <div style={styles.modalOverlay} onClick={() => { if (!updating && !adding) setDuplicatePrompt(null); }}>
          <div style={{ ...styles.modalBox, maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiAlertCircle size={22} color="#b45309" />
                <h3 style={styles.modalTitle}>Rate Already Exists for this Date</h3>
              </div>
              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setDuplicatePrompt(null)}
                disabled={updating || adding}
                aria-label="Close"
              >
                <FiX size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>
                A rate entry for date <strong>{formatDisplayDate(duplicatePrompt.existing.date)}</strong> already exists:
              </p>

              <div style={styles.comparisonBox}>
                <div style={styles.comparisonCol}>
                  <span style={styles.comparisonTitle}>Existing Rates</span>
                  <span style={styles.comparisonRate}>Gold: <strong>₹{duplicatePrompt.existing.goldRate || '—'}</strong> / g</span>
                  <span style={styles.comparisonRate}>Silver: <strong>₹{duplicatePrompt.existing.silverRate || '—'}</strong> / g</span>
                </div>
                <div style={styles.comparisonDivider} />
                <div style={styles.comparisonCol}>
                  <span style={{ ...styles.comparisonTitle, color: MAROON }}>New Rates to Apply</span>
                  <span style={styles.comparisonRate}>Gold: <strong>₹{duplicatePrompt.newData.goldRate || '—'}</strong> / g</span>
                  <span style={styles.comparisonRate}>Silver: <strong>₹{duplicatePrompt.newData.silverRate || '—'}</strong> / g</span>
                </div>
              </div>

              <p style={{ margin: '8px 0 0', fontSize: '14px', fontWeight: '500', color: '#111' }}>
                Same date already exists. Shall I update the existing entry with the new values?
              </p>

              <div style={styles.modalFooter}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDuplicatePrompt(null)}
                  disabled={updating || adding}
                >
                  No, Cancel
                </Button>
                <Button
                  type="button"
                  loading={updating || adding}
                  loadingText="Updating…"
                  onClick={handleConfirmUpdateDuplicate}
                >
                  Yes, Update Rate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  searchContainer: { position: 'relative', backgroundColor: LIGHT_GRAY, borderRadius: '24px', padding: '10px 16px', display: 'flex', alignItems: 'center', width: '300px' },
  searchIcon: { color: '#999', marginRight: '8px', fontSize: '18px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '100%', color: '#333' },
  headerIcons: { display: 'flex', alignItems: 'center', gap: '10px' },
  iconButton: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: LIGHT_GRAY, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666', fontSize: '18px', position: 'relative' },
  notifBadge: { position: 'absolute', top: '6px', right: '8px', minWidth: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ff4444', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  avatar: { width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },

  topRow: { display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'flex-start' },
  /* Input card: clean white card, professional */
  inputCard: {
    flex: '1',
    minWidth: '280px',
    borderRadius: '10px',
    padding: '28px',
    backgroundColor: '#fff',
    border: `1px solid ${BORDER_GRAY}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  inputCardTitle: { fontSize: '17px', fontWeight: '600', color: '#111827', marginBottom: '20px', marginTop: 0, letterSpacing: '-0.02em' },
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
  addBtn: {
    marginTop: '20px',
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: MAROON,
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(128,26,57,0.2)',
  },

  /* Display card: clean, subtle accent */
  displayCard: {
    flex: '0 0 auto',
    width: '100%',
    maxWidth: '340px',
    borderRadius: '10px',
    padding: '20px',
    backgroundColor: '#fff',
    border: `1px solid ${BORDER_GRAY}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    borderLeft: `4px solid ${MAROON}`,
  },
  displayCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
    paddingBottom: '10px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  displayCardTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  daysList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  daySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  daySectionBorder: {
    paddingBottom: '14px',
    borderBottom: `1px dashed ${BORDER_GRAY}`,
  },
  dayDateRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '2px',
  },
  todayBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: MAROON,
    backgroundColor: '#fce7f0',
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  pastDateBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#4b5563',
    backgroundColor: '#f3f4f6',
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  displayDate: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#111827',
  },
  rateList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  rateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  rateLabel: {
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: '500',
  },
  rateValueWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  rateValue: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#111827',
  },
  rateChangeUp: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#059669', fontWeight: '600' },
  rateChangeDown: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#dc2626', fontWeight: '600' },

  tableWrap: { overflowX: 'auto', marginBottom: '20px', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '500px' },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#333', backgroundColor: '#fafafa', borderBottom: `1px solid ${BORDER_GRAY}` },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  editBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 14px',
    borderRadius: '6px',
    border: `1px solid ${MAROON}`,
    backgroundColor: '#fff',
    color: MAROON,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  pageInfo: { fontSize: '14px', color: '#333' },
  paginationControls: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  pagBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: LIGHT_GRAY, color: '#333', fontSize: '14px', cursor: 'pointer', minWidth: '36px' },
  pagBtnActive: { backgroundColor: MAROON, color: '#fff' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '20px',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    maxWidth: '460px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: `1px solid ${BORDER_GRAY}`,
  },
  modalTitle: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#111',
    margin: 0,
  },
  modalClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    paddingTop: '12px',
    borderTop: `1px solid ${BORDER_GRAY}`,
    marginTop: '6px',
  },
  errorText: {
    color: '#dc2626',
    fontSize: '13px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    padding: '8px 12px',
    borderRadius: '6px',
    margin: 0,
  },
  comparisonBox: {
    display: 'flex',
    gap: '12px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    padding: '12px 14px',
    marginTop: '6px',
    marginBottom: '6px',
  },
  comparisonCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '13px',
  },
  comparisonTitle: {
    fontWeight: '700',
    color: '#92400e',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '2px',
  },
  comparisonRate: {
    color: '#374151',
    fontSize: '13px',
  },
  comparisonDivider: {
    width: '1px',
    backgroundColor: '#fde68a',
  },
};

export default GoldRateManage;
