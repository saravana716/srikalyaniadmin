import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { FiSearch, FiSettings, FiBell, FiMenu, FiArrowRight } from 'react-icons/fi';
import { MdDescription, MdBarChart, MdList, MdPeople } from 'react-icons/md';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';

const reportCards = [
  { id: 1, title: 'Monthly Collection Report', subtitle: 'Track Total Collection Month wise', icon: MdDescription, gradient: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)' },
  { id: 2, title: 'Customer-wise Report', subtitle: 'Collection and Status Per Customer', icon: MdBarChart, gradient: 'linear-gradient(135deg, #f97316 0%, #e11d48 100%)' },
  { id: 3, title: 'Chit Plan Performance', subtitle: 'Plan growth and Rate', icon: MdList, gradient: 'linear-gradient(135deg, #ea580c 0%, #be123c 100%)', badge: 'Active Plans: 24' },
  { id: 4, title: 'Agent-wise Commission', subtitle: 'Commission Breakdown by Agent', icon: MdPeople, gradient: 'linear-gradient(135deg, #dc2626 0%, #9f1239 100%)' },
];

const Reports = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div style={styles.container} className="dashboard-container reports-page">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main style={styles.main} className="dashboard-main reports-main">
        <header style={styles.header} className="dashboard-header reports-header">
          <div style={styles.headerRow}>
            <button style={styles.hamburger} className="mobile-hamburger" onClick={() => setIsSidebarOpen(true)}>
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Reports</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <div style={styles.searchContainer} className="search-container">
              <FiSearch style={styles.searchIcon} />
              <input type="text" placeholder="Search for something..." style={styles.searchInput} />
            </div>
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

        <div style={styles.cardsGrid} className="reports-cards-grid">
          {reportCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.id} style={{ ...styles.reportCard, background: card.gradient }} className="reports-card">
                <div style={styles.cardHeader}>
                  <div style={styles.cardIconWrap}>
                    <Icon size={28} color="rgba(255,255,255,0.95)" />
                  </div>
                  {card.badge && (
                    <span style={styles.badge}>{card.badge}</span>
                  )}
                </div>
                <h3 style={styles.cardTitle}>{card.title}</h3>
                <p style={styles.cardSubtitle}>{card.subtitle}</p>
                <a href="#view" style={styles.viewReport}>
                  View Report <FiArrowRight size={16} />
                </a>
              </div>
            );
          })}
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
  pageTitle: { fontSize: '28px', color: '#1f2937', fontWeight: '700' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  searchContainer: { position: 'relative', backgroundColor: LIGHT_GRAY, borderRadius: '24px', padding: '10px 16px', display: 'flex', alignItems: 'center', width: '300px' },
  searchIcon: { color: '#999', marginRight: '8px', fontSize: '18px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '100%', color: '#333' },
  headerIcons: { display: 'flex', alignItems: 'center', gap: '10px' },
  iconButton: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: LIGHT_GRAY, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666', fontSize: '18px', position: 'relative' },
  notifBadge: { position: 'absolute', top: '6px', right: '8px', minWidth: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ff4444', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  avatar: { width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },

  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' },
  reportCard: { borderRadius: '12px', padding: '24px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', minHeight: '180px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardIconWrap: { width: '48px', height: '48px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badge: { padding: '4px 10px', borderRadius: '6px', backgroundColor: '#22c55e', color: '#fff', fontSize: '12px', fontWeight: '600' },
  cardTitle: { fontSize: '18px', fontWeight: '700', margin: 0 },
  cardSubtitle: { fontSize: '14px', opacity: 0.95, margin: 0, flex: 1 },
  viewReport: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: '#fff', textDecoration: 'none', marginTop: 'auto', alignSelf: 'flex-start' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },
};

export default Reports;
