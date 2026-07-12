import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './Button';
import {
    MdDashboard,
    MdPeople,
    MdAssignment,
    MdPayment,
    MdSchedule,
    MdTrendingUp,
    MdDescription,
    MdSettings,
    MdClose,
    MdLogout,
    MdInventory2,
    MdLocalOffer,
    MdAdminPanelSettings,
} from 'react-icons/md';

const Sidebar = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);

    const menuItems = [
        { name: 'Dashboard', icon: <MdDashboard />, path: '/dashboard' },
        { name: 'Customers', icon: <MdPeople />, path: '/customers' },
        { name: 'Chit Fund Plans', icon: <MdAssignment />, path: '/plans' },
        { name: 'Plan Purchases', icon: <MdAssignment />, path: '/plan-purchases' },
        { name: 'Payment', icon: <MdPayment />, path: '/payment' },
        { name: 'Installments', icon: <MdSchedule />, path: '/installments' },
        { name: 'Products', icon: <MdInventory2 />, path: '/products' },
        { name: 'Offers', icon: <MdLocalOffer />, path: '/offers' },
        { name: 'Gold Rate Manage', icon: <MdTrendingUp />, path: '/gold-rate' },
        { name: 'Reports', icon: <MdDescription />, path: '/reports' },
        { name: 'Admin Accounts', icon: <MdAdminPanelSettings />, path: '/admin-accounts' },
        { name: 'Settings', icon: <MdSettings />, path: '/settings' },
    ];

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            logout();
            onClose?.();
            navigate('/login');
        } finally {
            setLoggingOut(false);
        }
    };

    return (
        <div className={`sidebar ${isOpen ? 'open' : ''}`} style={styles.sidebar}>
            <button
                style={styles.closeButton}
                className="sidebar-close-btn"
                onClick={onClose}
            >
                <MdClose size={24} />
            </button>

            <div style={styles.logoContainer}>
                <div style={styles.logo}>
                    <div style={styles.logoCircle}>
                        <span style={{ fontSize: '24px' }}>♛</span>
                    </div>
                    <span style={styles.logoText}>SRI KALYANI JEWELLERY</span>
                    <span style={styles.logoTagline}>Authentic Gold & Diamond</span>
                </div>
            </div>

            <nav style={styles.nav}>
                {menuItems.map((item, index) => (
                    <NavLink
                        key={index}
                        to={item.path}
                        onClick={onClose}
                        className="sidebar-nav-link"
                        style={({ isActive }) => ({
                            ...styles.link,
                            ...(isActive ? styles.activeLink : {}),
                        })}
                    >
                        <span style={styles.icon}>{item.icon}</span>
                        {item.name}
                    </NavLink>
                ))}
            </nav>

            <div style={styles.logoutWrap}>
                {user?.email && (
                    <div style={styles.userEmail}>{user.name || user.email}</div>
                )}
                <Button
                    type="button"
                    variant="secondary"
                    loading={loggingOut}
                    loadingText="Logging out…"
                    onClick={handleLogout}
                    style={{ ...styles.logoutLink, width: '100%', justifyContent: 'flex-start' }}
                >
                    {!loggingOut && <MdLogout style={styles.logoutIcon} />}
                    Logout
                </Button>
            </div>
        </div>
    );
};

const styles = {
    sidebar: {
        width: '260px',
        height: '100vh',
        backgroundColor: '#F8F8F8',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        borderRight: '1px solid #eee',
    },
    logoContainer: {
        padding: '20px 24px',
        backgroundColor: '#F5F5F5',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '8px',
        marginTop: '20px',
    },
    logo: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
    },
    logoCircle: {
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        backgroundColor: '#801A39',
        color: 'gold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '10px',
    },
    logoText: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#1a1a1a',
        letterSpacing: '0.5px',
    },
    logoTagline: {
        fontSize: '11px',
        color: '#666',
        marginTop: '4px',
    },
    nav: {
        display: 'flex',
        flexDirection: 'column',
        padding: '0 12px',
        flex: 1,
        overflowY: 'auto',
    },
    link: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        color: '#333',
        textDecoration: 'none',
        fontSize: '15px',
        fontWeight: '500',
        marginBottom: '4px',
        borderRadius: '8px',
        transition: 'all 0.2s',
    },
    activeLink: {
        backgroundColor: '#801A39',
        color: '#fff',
        fontWeight: '600',
    },
    icon: {
        marginRight: '12px',
        fontSize: '20px',
    },
    logoutWrap: {
        padding: '16px 12px 24px',
        borderTop: '1px solid #eee',
    },
    userEmail: {
        fontSize: '12px',
        color: '#666',
        padding: '0 16px 8px',
        wordBreak: 'break-all',
    },
    logoutLink: {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '12px 16px',
        color: '#333',
        fontSize: '15px',
        fontWeight: '500',
        borderRadius: '8px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        textAlign: 'left',
    },
    logoutIcon: {
        marginRight: '12px',
        fontSize: '20px',
    },
    closeButton: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#333',
        display: 'none',
    },
};

export default Sidebar;
