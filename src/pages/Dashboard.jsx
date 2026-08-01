import React, { useState, useEffect, useMemo } from 'react';
import PaginationBar from '../components/PaginationBar';
import { usePagination, DEFAULT_PAGE_SIZE } from '../hooks/usePagination';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    Wallet, ShoppingBag, AlertCircle, Package, ArrowRight, Glasses, Users
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { runDefaultProductStockMigration } from '../utils/productStockMigration';
import {
    getOrderTotalValue,
    coerceFirestoreDate,
    getOrderLifecycleBucket,
    orderItemsSummary,
} from '../utils/firestoreDisplay';
import '../assets/styles/Dashboard.css';
import '../assets/styles/Utilities.css';

function orderTotalNum(o) {
    const v = getOrderTotalValue(o);
    return parseFloat(v) || 0;
}

function pctChange(cur, prev) {
    if (prev <= 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
}

function computePeriodMetrics(orders) {
    const now = Date.now();
    const period = 30 * 24 * 60 * 60 * 1000;
    const curStart = now - period;
    const prevStart = now - 2 * period;
    let curRev = 0;
    let prevRev = 0;
    let curCount = 0;
    let prevCount = 0;
    orders.forEach((o) => {
        const t = coerceFirestoreDate(o.createdAt)?.getTime();
        if (!t) return;
        const v = orderTotalNum(o);
        if (t >= curStart) {
            curRev += v;
            curCount += 1;
        } else if (t >= prevStart && t < curStart) {
            prevRev += v;
            prevCount += 1;
        }
    });
    return {
        revenuePct: pctChange(curRev, prevRev),
        ordersPct: pctChange(curCount, prevCount),
    };
}

/** Daily: last 7 days. Weekly: current week Mon–Sun. Monthly: last 6 calendar months. */
function buildSalesSeries(orders, timeframe) {
    const now = new Date();
    const total = (o) => orderTotalNum(o);
    const dt = (o) => coerceFirestoreDate(o.createdAt);

    if (timeframe === 'Daily') {
        const out = [];
        for (let i = 6; i >= 0; i -= 1) {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - i);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);
            const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
            let sum = 0;
            orders.forEach((o) => {
                const t = dt(o);
                if (t && t >= d && t <= dayEnd) sum += total(o);
            });
            out.push({ name: label, value: Math.round(sum) });
        }
        return out;
    }

    if (timeframe === 'Weekly') {
        const out = [];
        const x = new Date(now);
        x.setHours(0, 0, 0, 0);
        const day = x.getDay();
        const diff = x.getDate() - day + (day === 0 ? -6 : 1);
        x.setDate(diff);
        const weekStart = x;
        for (let i = 0; i < 7; i += 1) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);
            const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
            let sum = 0;
            orders.forEach((o) => {
                const t = dt(o);
                if (t && t >= d && t <= dayEnd) sum += total(o);
            });
            out.push({ name: label, value: Math.round(sum) });
        }
        return out;
    }

    const out = [];
    for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        d.setHours(0, 0, 0, 0);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const label = d.toLocaleDateString('en-IN', { month: 'short' });
        let sum = 0;
        orders.forEach((o) => {
            const t = dt(o);
            if (t && t >= d && t <= monthEnd) sum += total(o);
        });
        out.push({ name: label, value: Math.round(sum) });
    }
    return out;
}

const ORDER_STATUS_PIE = [
    { key: 'delivered', name: 'Delivered', color: '#3b82f6' },
    { key: 'shipped', name: 'Shipped', color: '#10b981' },
    { key: 'pending', name: 'Pending', color: '#f59e0b' },
    { key: 'cancelled', name: 'Cancelled', color: '#ef4444' },
];

const Dashboard = () => {
    const [timeframe, setTimeframe] = useState('Weekly');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        ordersCount: 0,
        customersCount: 0,
        productsCount: 0,
        lowStockCount: 0
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const navigate = useNavigate();

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    useEffect(() => {
        runDefaultProductStockMigration();
    }, []);

    useEffect(() => {
        // Fetch real-time products and low stock items
        const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStats(prev => ({ ...prev, productsCount: snapshot.size }));
            const lowStock = list.filter(p => (parseInt(p.stock) || 0) <= 10);
            setLowStockItems(lowStock);
            setStats(prev => ({ ...prev, lowStockCount: lowStock.length }));
        });

        // Fetch real-time registered users count (Firestore `users` collection)
        const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            setStats(prev => ({ ...prev, customersCount: snapshot.size }));
        });

        // Fetch real-time orders and revenue
        const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => {
            const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStats(prev => ({
                ...prev,
                ordersCount: snapshot.size,
                totalRevenue: ordersList.reduce(
                    (acc, curr) => acc + (parseFloat(getOrderTotalValue(curr)) || 0),
                    0
                )
            }));
            setRecentOrders(ordersList);
        });

        return () => {
            unsubProducts();
            unsubUsers();
            unsubOrders();
        };
    }, []);

    const {
        currentPage: ordersPage,
        setCurrentPage: setOrdersPage,
        totalPages: ordersTotalPages,
        paginatedItems: paginatedRecentOrders,
        pageStart: ordersPageStart,
        pageEnd: ordersPageEnd,
    } = usePagination(recentOrders, DEFAULT_PAGE_SIZE, '');
    const {
        currentPage: lowStockPage,
        setCurrentPage: setLowStockPage,
        totalPages: lowStockTotalPages,
        paginatedItems: paginatedLowStock,
        pageStart: lowStockPageStart,
        pageEnd: lowStockPageEnd,
    } = usePagination(lowStockItems, DEFAULT_PAGE_SIZE, '');

    const adminName = useMemo(() => {
        try {
            const raw = localStorage.getItem('admin_user');
            return raw ? JSON.parse(raw).name || 'Admin' : 'Admin';
        } catch {
            return 'Admin';
        }
    }, []);

    const periodMetrics = useMemo(() => computePeriodMetrics(recentOrders), [recentOrders]);
    const salesSeries = useMemo(() => buildSalesSeries(recentOrders, timeframe), [recentOrders, timeframe]);
    const orderStatusPieData = useMemo(() => {
        const counts = { delivered: 0, shipped: 0, pending: 0, cancelled: 0 };
        recentOrders.forEach((o) => {
            const b = getOrderLifecycleBucket(o);
            if (counts[b] !== undefined) counts[b] += 1;
        });
        return ORDER_STATUS_PIE.map((row) => ({
            name: row.name,
            value: counts[row.key] ?? 0,
            color: row.color,
        })).filter((row) => row.value > 0);
    }, [recentOrders]);

    const StatCard = ({ title, value, subtext, icon, trend, trendUp, bgColor, iconColor }) => (
        <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ backgroundColor: bgColor || '#f0f4ff', color: iconColor || '#3b82f6' }}>
                {icon}
            </div>
            <div className="stat-info">
                <h3>{title}</h3>
                <div className="stat-value">{value}</div>
                {(trend || subtext) && (
                    <div
                        className={trend ? `stat-trend ${trendUp ? 'trend-up' : 'trend-down'}` : 'stat-trend'}
                        style={!trend ? { color: '#64748b', fontWeight: 400 } : undefined}
                    >
                        {trend ? <>{trend} </> : null}
                        {subtext && (
                            <span style={{ color: '#94a3b8', fontWeight: '400', marginLeft: trend ? '4px' : '0' }}>{subtext}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="dashboard-container">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
            <main className="main-content">
                <Header toggleSidebar={toggleSidebar} />
                <div className="dashboard-content">
                    <div className="flex flex-col mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Hello, {adminName}! 👋</h2>
                        <p className="text-sm text-gray-500">Welcome back to your store overview.</p>
                    </div>
                    <div className="stats-grid">
                        <StatCard
                            title="Total Revenue"
                            value={`₹${stats.totalRevenue.toLocaleString()}`}
                            subtext="vs prior 30 days"
                            icon={<Wallet size={24} />}
                            trend={`${periodMetrics.revenuePct >= 0 ? '+' : ''}${periodMetrics.revenuePct}%`}
                            trendUp={periodMetrics.revenuePct >= 0}
                            bgColor="#eff6ff"
                            iconColor="#3b82f6"
                        />
                        <StatCard
                            title="Total Orders"
                            value={stats.ordersCount}
                            icon={<ShoppingBag size={24} />}
                            subtext="vs prior 30 days"
                            trend={`${periodMetrics.ordersPct >= 0 ? '+' : ''}${periodMetrics.ordersPct}%`}
                            trendUp={periodMetrics.ordersPct >= 0}
                            bgColor="#f0fdf4"
                            iconColor="#22c55e"
                        />
                        <StatCard
                            title="Active Customers"
                            value={stats.customersCount}
                            icon={<Users size={24} />}
                            subtext="Registered users (all time)"
                            bgColor="#fffbeb"
                            iconColor="#f59e0b"
                        />
                        <StatCard
                            title="Total Products"
                            value={stats.productsCount}
                            icon={<Package size={24} />}
                            subtext="Catalog size (all time)"
                            bgColor="#faf5ff"
                            iconColor="#a855f7"
                        />
                        <StatCard
                            title="Low Stock Items"
                            value={stats.lowStockCount}
                            icon={<AlertCircle size={24} />}
                            subtext="Stock ≤ 10 units"
                            bgColor="#fef2f2"
                            iconColor="#ef4444"
                        />
                    </div>

                    <div className="charts-grid">
                        <div className="chart-card">
                            <div className="chart-header">
                                <h3 className="chart-title">Sales Analytics</h3>
                                <div className="flex gap-2">
                                    {['Daily', 'Weekly', 'Monthly'].map((tf) => (
                                        <button
                                            key={tf}
                                            onClick={() => setTimeframe(tf)}
                                            className={`px-3 py-1 text-sm rounded transition-colors ${timeframe === tf
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {tf}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={salesSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                        <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']} />
                                        <CartesianGrid vertical={false} stroke="#f3f4f6" />
                                        <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="chart-card flex flex-col items-center justify-center">
                            <h3 className="chart-title self-start mb-4">Order status</h3>
                            <div style={{ height: '250px', width: '100%' }}>
                                {orderStatusPieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={orderStatusPieData}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                cx="50%"
                                                cy="50%"
                                            >
                                                {orderStatusPieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-sm text-gray-400">
                                        No orders yet
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="tables-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                        <div className="table-card">
                            <div className="table-header">
                                <h3 className="chart-title">Recent Orders</h3>
                                <span
                                    className="text-sm text-gray-500 cursor-pointer flex items-center gap-1"
                                    onClick={() => navigate('/orders')}
                                >
                                    Show All <ArrowRight size={14} />
                                </span>
                            </div>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Price</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRecentOrders.map((order, index) => (
                                        <tr key={order.id || index}>
                                            <td className="product-cell">
                                                <div className="product-img flex items-center justify-center text-gray-400 bg-blue-50" style={{ minWidth: '40px' }}>
                                                    <Glasses size={20} />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500">#{order.id.slice(0, 8)}</div>
                                                    <div className="font-medium text-sm">{orderItemsSummary(order).text}</div>
                                                </div>
                                            </td>
                                            <td>₹{getOrderTotalValue(order) || 0}</td>
                                            <td>
                                                <span
                                                    className={`status-badge ${order.status === 'Completed' || order.status === 'Delivered' ? 'status-success' : 'status-warning'}`}
                                                >
                                                    {order.status === 'Completed' ? 'Delivered' : order.status || 'Pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {recentOrders.length === 0 && (
                                        <tr>
                                            <td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>No recent orders</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            <PaginationBar
                                totalCount={recentOrders.length}
                                pageStart={ordersPageStart}
                                pageEnd={ordersPageEnd}
                                currentPage={ordersPage}
                                totalPages={ordersTotalPages}
                                setCurrentPage={setOrdersPage}
                            />
                        </div>

                        <div className="table-card">
                            <div className="table-header">
                                <h3 className="chart-title">Low Stock Alert</h3>
                                <span
                                    className="text-sm text-gray-500 cursor-pointer flex items-center gap-1"
                                    onClick={() => navigate('/inventory')}
                                >
                                    Show All <ArrowRight size={14} />
                                </span>
                            </div>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th className="text-right">Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedLowStock.map((item, index) => (
                                        <tr key={item.id || index}>
                                            <td className="product-cell">
                                                <div className="product-img flex items-center justify-center text-gray-400 bg-blue-50" style={{ minWidth: '40px' }}>
                                                    <Glasses size={20} />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500">SKU: {item.sku || 'N/A'}</div>
                                                    <div className="font-medium text-sm">{item.name}</div>
                                                </div>
                                            </td>
                                            <td className="text-right font-medium" style={{ color: '#ef4444' }}>{item.stock || 0} PCS</td>
                                        </tr>
                                    ))}
                                    {lowStockItems.length === 0 && (
                                        <tr>
                                            <td colSpan="2" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>All products in stock</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            <PaginationBar
                                totalCount={lowStockItems.length}
                                pageStart={lowStockPageStart}
                                pageEnd={lowStockPageEnd}
                                currentPage={lowStockPage}
                                totalPages={lowStockTotalPages}
                                setCurrentPage={setLowStockPage}
                            />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
