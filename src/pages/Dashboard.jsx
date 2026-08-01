import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { FiSettings, FiBell, FiMenu } from 'react-icons/fi';
import StatsCard from '../components/StatsCard';
import RevenueChart from '../components/RevenueChart';
import AnalyticsChart from '../components/AnalyticsChart';
import PaymentTable from '../components/PaymentTable';
import { useAuth } from '../context/AuthContext';
import { subscribeCustomers } from '../services/customersService';
import { subscribePlans } from '../services/plansService';
import { subscribePayments } from '../services/paymentsService';
import { subscribePlanPurchases } from '../services/planPurchasesService';
import { subscribeNotifications } from '../services/notificationsService';
import { parseAmount, formatINR } from '../utils/currencyUtils';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';

const Dashboard = () => {
    const { user } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [plans, setPlans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [planPurchases, setPlanPurchases] = useState([]);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const unsubs = [
            subscribeCustomers(setCustomers),
            subscribePlans(setPlans),
            subscribePayments(setPayments),
            subscribePlanPurchases(setPlanPurchases),
            subscribeNotifications(setNotifications),
        ];
        return () => unsubs.forEach((fn) => fn());
    }, []);

    const activeChits = planPurchases.filter((p) => p.status === 'Active').length;
    const activePlans = plans.filter((p) => p.status === 'Active').length;
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const monthlyCollection = payments
        .filter((p) => {
            if (p.status !== 'Paid') return false;
            const d = p.dueDate ? new Date(p.dueDate.includes('T') ? p.dueDate : p.dueDate.replace(' ', 'T') + 'Z') : null;
            return d && !Number.isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((sum, p) => sum + parseAmount(p.paidAmount), 0);

    const pendingAmount = payments
        .filter((p) => p.status === 'Pending')
        .reduce((sum, p) => sum + Math.max(0, parseAmount(p.dueAmount) - parseAmount(p.paidAmount)), 0);

    const unreadNotifs = notifications.length;
    const avatarName = encodeURIComponent(user?.name || user?.email || 'Admin');

    return (
        <div style={styles.container} className="dashboard-container">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {isSidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
            )}

            <main style={styles.main} className="dashboard-main">
                <header style={styles.header} className="dashboard-header overview-header">
                    <div style={styles.headerRow}>
                        <button
                            style={styles.hamburger}
                            className="mobile-hamburger"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <FiMenu size={24} color={MAROON} />
                        </button>
                        <h1 style={styles.pageTitle}>Overview</h1>
                    </div>
                    <div style={styles.headerActions} className="dashboard-header-actions">
                        <div style={styles.headerIcons}>
                            <button style={styles.iconButton}><FiSettings /></button>
                            <button style={styles.iconButton}>
                                {unreadNotifs > 0 && (
                                    <span style={styles.notifBadge}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</span>
                                )}
                                <FiBell />
                            </button>
                            <img src={`https://ui-avatars.com/api/?name=${avatarName}&background=801A39&color=fff`} alt="Profile" style={styles.avatar} />
                        </div>
                    </div>
                </header>

                <div style={styles.content} className="dashboard-content">
                    <div style={styles.statsRow} className="stats-row">
                        <StatsCard title="Total Active Chits" value={String(activeChits || activePlans)} />
                        <StatsCard title="Total Customers" value={String(customers.length)} />
                        <StatsCard title="Monthly Collection" value={formatINR(monthlyCollection)} />
                        <StatsCard title="Pending Amount" value={formatINR(pendingAmount)} />
                    </div>

                    <div style={styles.chartsRow} className="charts-row">
                        <RevenueChart />
                        <AnalyticsChart />
                    </div>

                    <div style={styles.tableRow} className="table-row">
                        <PaymentTable />
                    </div>
                </div>
            </main>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#fff',
    },
    main: {
        marginLeft: '260px',
        flex: 1,
        padding: '24px 40px',
        backgroundColor: '#fff',
        maxWidth: '100vw',
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
    headerRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    pageTitle: {
        fontSize: '28px',
        color: MAROON,
        fontWeight: '700',
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
    },
    searchContainer: {
        position: 'relative',
        backgroundColor: LIGHT_GRAY,
        borderRadius: '24px',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        width: '300px',
    },
    searchIcon: {
        color: '#999',
        marginRight: '8px',
        fontSize: '18px',
    },
    searchInput: {
        border: 'none',
        background: 'transparent',
        outline: 'none',
        fontSize: '14px',
        width: '100%',
        color: '#333',
    },
    headerIcons: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    iconButton: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: LIGHT_GRAY,
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#666',
        fontSize: '18px',
        position: 'relative',
    },
    notifBadge: {
        position: 'absolute',
        top: '6px',
        right: '8px',
        minWidth: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: '#ff4444',
        color: '#fff',
        fontSize: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 4px',
    },
    avatar: {
        width: '45px',
        height: '45px',
        borderRadius: '50%',
        objectFit: 'cover',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    statsRow: {
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap',
        flexDirection: 'row',
    },
    chartsRow: {
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap',
        flexDirection: 'row',
    },
    tableRow: {
        width: '100%',
        overflowX: 'auto',
    },
    hamburger: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'none',
        padding: 0,
    },
};

export default Dashboard;
