import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { FiSettings, FiBell, FiMenu, FiArrowRight } from 'react-icons/fi';
import { MdBusiness, MdAccountBalance, MdCreditCard, MdPeople, MdNotifications } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';
const PEACH_BG = '#fef3e2';

const settingCards = [
  { id: 1, title: 'Company Details', description: 'Manage Company name, address, logo, GST and all info', icon: MdBusiness, path: null },
  { id: 2, title: 'Bank Details', description: 'Configure bank accounts for collection & Payouts', icon: MdAccountBalance, path: null },
  { id: 3, title: 'Payment Gateway', description: 'Manage Payment Providers', icon: MdCreditCard, path: null },
  { id: 4, title: 'Admin Accounts', description: 'Create and manage admin login accounts (Email + Password)', icon: MdPeople, path: '/admin-accounts' },
  { id: 5, title: 'Notification Settings', description: 'Configure App Email SMS and Notification', icon: MdNotifications, path: null },
];

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const avatarName = encodeURIComponent(user?.name || user?.email || 'Admin');

  return (
    <div style={styles.container} className="dashboard-container settings-page">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main style={styles.main} className="dashboard-main settings-main">
        <header style={styles.header} className="dashboard-header settings-header">
          <div style={styles.headerRow}>
            <button style={styles.hamburger} className="mobile-hamburger" onClick={() => setIsSidebarOpen(true)}>
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Settings</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <div style={styles.headerIcons}>
              <button style={styles.iconButton}><FiSettings /></button>
              <button style={styles.iconButton}><FiBell /></button>
              <img src={`https://ui-avatars.com/api/?name=${avatarName}&background=801A39&color=fff`} alt="Profile" style={styles.avatar} />
            </div>
          </div>
        </header>

        <div style={styles.cardsGrid} className="settings-cards-grid">
          {settingCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.id} style={styles.settingCard} className="settings-card">
                <div style={styles.cardIconWrap}>
                  <Icon size={24} color={MAROON} />
                </div>
                <h3 style={styles.cardTitle}>{card.title}</h3>
                <p style={styles.cardDesc}>{card.description}</p>
                {card.path ? (
                  <button type="button" style={styles.viewDetailsBtn} onClick={() => navigate(card.path)}>
                    Manage <FiArrowRight size={16} />
                  </button>
                ) : (
                  <span style={styles.comingSoon}>Coming soon</span>
                )}
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
  avatar: { width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },

  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' },
  settingCard: { backgroundColor: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: `1px solid ${BORDER_GRAY}`, display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' },
  cardIconWrap: { width: '48px', height: '48px', borderRadius: '10px', backgroundColor: PEACH_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: '18px', fontWeight: '700', color: '#1f2937', margin: 0 },
  cardDesc: { fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: 1.5, flex: 1 },
  viewDetailsBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: MAROON, background: 'none', border: 'none', cursor: 'pointer', marginTop: 'auto', alignSelf: 'flex-end', padding: 0 },
  comingSoon: { fontSize: '13px', color: '#9ca3af', marginTop: 'auto', alignSelf: 'flex-end' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },
};

export default Settings;
