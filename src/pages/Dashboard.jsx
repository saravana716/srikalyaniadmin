import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import { FiSettings, FiBell, FiMenu } from 'react-icons/fi';
import StatsCard from '../components/StatsCard';
import RevenueChart from '../components/RevenueChart';
import AnalyticsChart from '../components/AnalyticsChart';
import PaymentTable from '../components/PaymentTable';
import { useAuth } from '../context/AuthContext';
import { subscribeCustomers } from '../services/customersService';
import { subscribePlans } from '../services/plansService';
import { subscribeAllPayments } from '../services/paymentsService';
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
    const [allPayments, setAllPayments] = useState([]);
    const [planPurchases, setPlanPurchases] = useState([]);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        let isMounted = true;
        const unsubs = [
            subscribeCustomers((data) => { if (isMounted) setCustomers(data); }),
            subscribePlans((data) => { if (isMounted) setPlans(data); }),
            subscribeAllPayments((data) => { if (isMounted) setAllPayments(data); }),
            subscribePlanPurchases((data) => { if (isMounted) setPlanPurchases(data); }),
            subscribeNotifications((data) => { if (isMounted) setNotifications(data); }),
        ];
        return () => {
            isMounted = false;
            unsubs.forEach((fn) => {
                try { if (typeof fn === 'function') fn(); } catch (e) {}
            });
        };
    }, []);

    // Merge planPurchases with scheme enrollments from customers for accurate active chit metrics
    const effectivePlanPurchases = useMemo(() => {
        const map = new Map();
        (planPurchases || []).forEach((r) => {
            if (r.id) map.set(r.id, r);
        });

        (customers || []).forEach((c) => {
            if (c.type === 'scheme_enrollment' || c.planName || c.plan) {
                const pName = c.planName || (c.plan ? `${c.plan} Gold Plan` : '');
                if (!pName) return;
                const alreadyHas = Array.from(map.values()).some((existing) => {
                    const eCus = String(existing.cusId || existing.customerId || '').trim().toLowerCase();
                    const eName = String(existing.planName || existing.name || '').trim().toLowerCase();
                    const thisCus = String(c.cusId || c.id || '').trim().toLowerCase();
                    return (eCus === thisCus && eName === pName.trim().toLowerCase()) || existing.id === c.id;
                });
                if (!alreadyHas) {
                    map.set(c.id, {
                        id: c.id,
                        cusId: c.cusId || c.id,
                        customerId: c.id,
                        name: c.name,
                        customerName: c.name,
                        planName: pName,
                        amount: c.amount || 0,
                        savedAmount: c.accountBalance ?? c.savedAmount ?? c.amount ?? 0,
                        status: c.status || 'Active',
                    });
                }
            }
        });

        return Array.from(map.values());
    }, [planPurchases, customers]);

    const activeChits = useMemo(() => {
        return effectivePlanPurchases.filter((p) => {
            const s = String(p.status || 'Active').trim().toLowerCase();
            return s === 'active';
        }).length;
    }, [effectivePlanPurchases]);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate current month dynamic collection from all payments
    const monthlyCollection = useMemo(() => {
        return (allPayments || []).reduce((sum, p) => {
            const status = String(p.status || 'Paid').toLowerCase();
            if (status === 'failed' || status === 'cancelled') return sum;

            const amt = Number(p.paidAmount ?? p.amount ?? p.dueAmount ?? 0) || 0;
            if (amt <= 0) return sum;

            const rawTs = p.paidDate || p.createdAt || p.date || p.dueDate;
            if (!rawTs) return sum;

            let d = null;
            if (typeof rawTs?.toDate === 'function') {
                d = rawTs.toDate();
            } else if (typeof rawTs === 'object' && rawTs.seconds) {
                d = new Date(rawTs.seconds * 1000);
            } else {
                const str = String(rawTs);
                d = new Date(str.includes('T') ? str : str.replace(' ', 'T'));
            }

            if (d && !Number.isNaN(d.getTime())) {
                if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                    return sum + amt;
                }
            }
            return sum;
        }, 0);
    }, [allPayments, currentMonth, currentYear]);

    // Calculate dynamic pending amount across active plan purchases
    const pendingAmount = useMemo(() => {
        return effectivePlanPurchases.reduce((sum, p) => {
            const s = String(p.status || 'Active').trim().toLowerCase();
            if (s !== 'active') return sum;
            const targetDuration = Number(p.durationMonths) || 11;
            const monthlyAmt = Number(p.amount) || 0;
            const targetTotal = targetDuration * monthlyAmt;
            const saved = Number(p.savedAmount ?? p.amount ?? 0) || 0;
            const remaining = Math.max(0, targetTotal - saved);
            return sum + remaining;
        }, 0);
    }, [effectivePlanPurchases]);

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
                        <StatsCard title="Total Active Chits" value={String(activeChits)} />
                        <StatsCard title="Total Customers" value={String(customers.length)} />
                        <StatsCard title="Monthly Collection" value={formatINR(monthlyCollection)} />
                        <StatsCard title="Pending Amount" value={formatINR(pendingAmount)} />
                    </div>

                    <div style={styles.chartsRow} className="charts-row">
                        <RevenueChart payments={allPayments} />
                        <AnalyticsChart planPurchases={effectivePlanPurchases} />
                    </div>

                    <div style={styles.tableRow} className="table-row">
                        <PaymentTable payments={allPayments} />
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
