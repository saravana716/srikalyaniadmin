import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { FiSettings, FiBell, FiMenu } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown, MdTrendingUp, MdTrendingDown } from 'react-icons/md';
import { subscribeGoldRates, addGoldRate as addGoldRateToDb } from '../services/goldRatesService';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

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
  const totalPages = Math.max(1, Math.ceil(goldRates.length / 10));

  useEffect(() => {
    const unsub = subscribeGoldRates((list) => {
      setGoldRates(list.map((r, i) => ({ ...r, sno: i + 1 })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const latest = goldRates[0];
  const handleAdd = async (e) => {
    e.preventDefault();
    if (adding) return;
    setAddError(null);
    const d = date || new Date().toISOString().slice(0, 10);
    setAdding(true);
    try {
      await addGoldRateToDb({ date: d, goldRate: goldRateInput, silverRate: silverRateInput });
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
                <label style={styles.inputLabel}>Enter Gold Rate</label>
                <input type="text" placeholder="Enter Gold Rate" style={styles.input} value={goldRateInput} onChange={(e) => setGoldRateInput(e.target.value)} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Enter Silver Rate</label>
                <input type="text" placeholder="Enter Silver Rate" style={styles.input} value={silverRateInput} onChange={(e) => setSilverRateInput(e.target.value)} />
              </div>
              <Button type="submit" loading={adding} loadingText="Adding…" style={styles.addBtn}>Add</Button>
            </form>
          </div>

          {/* Display Card - latest from Firestore */}
          <div style={styles.displayCard} className="gold-rate-display-card">
            <div style={styles.displayCardHeader}>
              <span style={styles.displayCardTitle}>Today&apos;s Date</span>
              <span style={styles.displayDate}>{latest ? formatDisplayDate(latest.date) : '—'}</span>
            </div>
            <div style={styles.rateList}>
              <div style={styles.rateRow}>
                <span style={styles.rateLabel}>Gold Rate</span>
                <div style={styles.rateValueWrap}>
                  <span style={styles.rateValue}>{latest?.goldRate ? `₹ ${latest.goldRate}` : '—'}</span>
                </div>
              </div>
              <div style={styles.rateRow}>
                <span style={styles.rateLabel}>Silver Rate</span>
                <div style={styles.rateValueWrap}>
                  <span style={styles.rateValue}>{latest?.silverRate ? `₹ ${latest.silverRate}` : '—'}</span>
                </div>
              </div>
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
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : goldRates).map((row) => (
                <tr key={row.id || row.sno} style={styles.tr}>
                  <td style={styles.td}>{row.sno}</td>
                  <td style={styles.td}>{formatDisplayDate(row.date)}</td>
                  <td style={styles.td}>{row.goldRate ? `₹ ${row.goldRate}` : '—'}</td>
                  <td style={styles.td}>{row.silverRate ? `₹ ${row.silverRate}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={styles.pagination} className="gold-rate-pagination">
          <span style={styles.pageInfo}>Showing page {currentPage} / {totalPages}</span>
          <div style={styles.paginationControls} className="pagination-controls">
            <button style={styles.pagBtn} disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button>
            <button style={{ ...styles.pagBtn, ...(currentPage === 1 ? styles.pagBtnActive : {}) }} onClick={() => setCurrentPage(1)}>1</button>
            <button style={{ ...styles.pagBtn, ...(currentPage === 2 ? styles.pagBtnActive : {}) }} onClick={() => setCurrentPage(2)}>2</button>
            <button style={{ ...styles.pagBtn, ...(currentPage === 3 ? styles.pagBtnActive : {}) }} onClick={() => setCurrentPage(3)}>3</button>
            <button style={styles.pagBtn}>...</button>
            <button style={styles.pagBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</button>
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
  searchContainer: { position: 'relative', backgroundColor: LIGHT_GRAY, borderRadius: '24px', padding: '10px 16px', display: 'flex', alignItems: 'center', width: '300px' },
  searchIcon: { color: '#999', marginRight: '8px', fontSize: '18px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '100%', color: '#333' },
  headerIcons: { display: 'flex', alignItems: 'center', gap: '10px' },
  iconButton: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: LIGHT_GRAY, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666', fontSize: '18px', position: 'relative' },
  notifBadge: { position: 'absolute', top: '6px', right: '8px', minWidth: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ff4444', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  avatar: { width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },

  topRow: { display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' },
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
    maxWidth: '300px',
    borderRadius: '10px',
    padding: '20px',
    backgroundColor: '#fff',
    border: `1px solid ${BORDER_GRAY}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    borderLeft: `4px solid ${MAROON}`,
  },
  displayCardHeader: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', paddingBottom: '14px', borderBottom: `1px solid ${BORDER_GRAY}` },
  displayCardTitle: { fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' },
  displayDate: { fontSize: '15px', fontWeight: '700', color: '#111827' },
  rateList: { display: 'flex', flexDirection: 'column', gap: '14px' },
  rateRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  rateLabel: { fontSize: '14px', color: '#6b7280', fontWeight: '500' },
  rateValueWrap: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  rateValue: { fontSize: '15px', fontWeight: '700', color: '#111827' },
  rateChangeUp: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#059669', fontWeight: '600' },
  rateChangeDown: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#dc2626', fontWeight: '600' },

  tableWrap: { overflowX: 'auto', marginBottom: '20px', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '400px' },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#333', backgroundColor: '#fafafa', borderBottom: `1px solid ${BORDER_GRAY}` },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },

  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  pageInfo: { fontSize: '14px', color: '#333' },
  paginationControls: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  pagBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: LIGHT_GRAY, color: '#333', fontSize: '14px', cursor: 'pointer', minWidth: '36px' },
  pagBtnActive: { backgroundColor: MAROON, color: '#fff' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },
};

export default GoldRateManage;
