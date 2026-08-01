import React, { useState, useEffect, useMemo } from 'react';
import PaginationBar from '../components/PaginationBar';
import { usePagination, DEFAULT_PAGE_SIZE } from '../hooks/usePagination';
import { Search, Filter, Download, Eye, Trash2, ArrowUpDown, Loader2, X, ShoppingBag } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { db } from '../firebase';
import { collection, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/Dashboard.css';
import '../assets/styles/Table.css';
import '../assets/styles/Products.css';
import {
    formatTimestamp,
    formatTimestampShort,
    formatRupee,
    collectPrimitiveEntries,
    coerceFirestoreDate,
    getUserDisplayName,
    getUserEmail,
    getUserPhone,
    getUserAddressSummary,
    getUserCreatedAt,
    getUserSearchBlob,
    getOrderTotalValue,
} from '../utils/firestoreDisplay';

function ordersForUser(orders, user) {
    if (!user) return [];
    const email = getUserEmail(user).toLowerCase();
    const phone = getUserPhone(user).replace(/\s/g, '');
    const uid = user.id;

    return orders.filter((o) => {
        if (uid && (o.userId === uid || o.customerId === uid)) return true;
        const orderEmails = [
            o.customerEmail,
            o.email,
            o.userEmail,
            o.billingAddress?.email,
            o.shippingAddress?.email,
        ]
            .filter(Boolean)
            .map((e) => String(e).toLowerCase().trim());
        if (email && orderEmails.includes(email)) return true;
        const orderPhones = [
            o.phone,
            o.phoneNumber,
            o.billingAddress?.phone,
            o.shippingAddress?.phone,
        ]
            .filter(Boolean)
            .map((p) => String(p).replace(/\s/g, ''));
        if (phone && orderPhones.some((p) => p === phone)) return true;
        return false;
    });
}

const Customers = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [users, setUsers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewUser, setViewUser] = useState(null);
    const navigate = useNavigate();

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => {
                const ta = coerceFirestoreDate(getUserCreatedAt(a))?.getTime() ?? 0;
                const tb = coerceFirestoreDate(getUserCreatedAt(b))?.getTime() ?? 0;
                return tb - ta;
            });
            setUsers(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const handleDelete = async (id) => {
        if (
            !window.confirm(
                'Remove this user profile from Firestore? This does not delete the Firebase Auth account.'
            )
        ) {
            return;
        }
        try {
            await deleteDoc(doc(db, 'users', id));
            setViewUser(null);
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Failed to delete user document');
        }
    };

    const filteredUsers = useMemo(() => {
        const qv = searchTerm.trim().toLowerCase();
        return users.filter((u) => {
            if (!qv) return true;
            return getUserSearchBlob(u).includes(qv);
        });
    }, [users, searchTerm]);

    const {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedItems: paginatedUsers,
        pageStart,
        pageEnd,
    } = usePagination(filteredUsers, DEFAULT_PAGE_SIZE, searchTerm);

    const relatedOrders = useMemo(
        () => (viewUser ? ordersForUser(orders, viewUser) : []),
        [viewUser, orders]
    );

    const computedStats = useMemo(() => {
        const total = relatedOrders.reduce((acc, o) => acc + (parseFloat(getOrderTotalValue(o)) || 0), 0);
        return { orderCount: relatedOrders.length, totalSpent: total };
    }, [relatedOrders]);

    const extraExclude = new Set([
        'id',
        'name',
        'displayName',
        'fullName',
        'firstName',
        'lastName',
        'email',
        'userEmail',
        'phone',
        'phoneNumber',
        'mobile',
        'address',
        'defaultAddress',
        'shippingAddress',
        'savedAddresses',
        'createdAt',
        'created_at',
        'joinedAt',
        'registeredAt',
        'updatedAt',
        'photoURL',
        'photoUrl',
        'avatar',
        'purchases',
        'ordersCount',
    ]);
    const extraPrimitives = viewUser ? collectPrimitiveEntries(viewUser, extraExclude) : [];

    const openRelatedOrderInvoiceOrDetails = (order) => {
        if (order.invoiceUrl) {
            window.open(order.invoiceUrl, '_blank', 'noopener,noreferrer');
            return;
        }
        navigate(`/orders?order=${encodeURIComponent(order.id)}`);
    };

    return (
        <div className="dashboard-container">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
            <div className="main-content">
                <Header toggleSidebar={toggleSidebar} />
                <div className="dashboard-content">
                    <div className="content-header">
                        <div className="breadcrumb">
                            <span className="cursor-pointer" onClick={() => navigate('/dashboard')}>
                                Dashboard
                            </span>
                            <span className="separator"> &gt; </span>
                            <span className="active">Customers</span>
                        </div>
                        <div className="page-title-row">
                            <div>
                                <h1 className="text-2xl font-bold">Customers</h1>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Live data from the <code className="text-xs bg-slate-100 px-1 rounded">users</code>{' '}
                                    collection
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="controls-row">
                        <div className="search-box">
                            <Search className="search-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Search name, email, phone, user id…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="action-buttons">
                            <button type="button" className="btn-secondary">
                                <Filter size={18} /> Filter
                            </button>
                            <button type="button" className="btn-secondary">
                                <Download size={18} /> Export
                            </button>
                        </div>
                    </div>

                    <div className="table-card">
                        <div className="data-table-container">
                            {loading ? (
                                <div className="flex items-center justify-center p-20">
                                    <Loader2 className="animate-spin text-blue-500" size={40} />
                                </div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                <div className="th-content">
                                                    User <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th>
                                                <div className="th-content">
                                                    Contact <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th>
                                                <div className="th-content">
                                                    Purchases <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th>
                                                <div className="th-content">
                                                    Orders <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th>
                                                <div className="th-content">
                                                    Address <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th>
                                                <div className="th-content">
                                                    Joined <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th style={{ textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedUsers.map((user) => {
                                            const ro = ordersForUser(orders, user);
                                            const liveTotal = ro.reduce(
                                                (acc, o) => acc + (parseFloat(getOrderTotalValue(o)) || 0),
                                                0
                                            );
                                            const liveCount = ro.length;
                                            const name = getUserDisplayName(user);
                                            const addr = getUserAddressSummary(user);
                                            const created = getUserCreatedAt(user);
                                            return (
                                                <tr key={user.id}>
                                                    <td>
                                                        <div className="customer-cell">
                                                            <span className="text-xs text-secondary font-mono">
                                                                {user.id.length > 14
                                                                    ? `${user.id.slice(0, 12)}…`
                                                                    : user.id}
                                                            </span>
                                                            <div className="font-semibold">{name || '—'}</div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="contact-cell">
                                                            <div className="text-xs text-secondary break-all">
                                                                {getUserEmail(user) || '—'}
                                                            </div>
                                                            <div className="text-xs text-secondary">
                                                                {getUserPhone(user) || '—'}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {liveTotal > 0
                                                            ? formatRupee(liveTotal)
                                                            : user.purchases || '—'}
                                                    </td>
                                                    <td>{liveCount > 0 ? liveCount : user.ordersCount ?? '—'}</td>
                                                    <td style={{ maxWidth: '220px' }}>
                                                        <div className="truncate-2-lines text-xs text-secondary">
                                                            {addr || '—'}
                                                        </div>
                                                    </td>
                                                    <td className="text-sm">
                                                        {created ? formatTimestampShort(created) : '—'}
                                                    </td>
                                                    <td>
                                                        <div
                                                            className="action-btns"
                                                            style={{ justifyContent: 'flex-end' }}
                                                        >
                                                            <button
                                                                type="button"
                                                                className="action-btn"
                                                                title="View"
                                                                onClick={() => setViewUser(user)}
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="action-btn delete"
                                                                title="Delete profile document"
                                                                onClick={() => handleDelete(user.id)}
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredUsers.length === 0 && !loading && (
                                            <tr>
                                                <td
                                                    colSpan="7"
                                                    style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}
                                                >
                                                    No users found in the users collection
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        {!loading && (
                            <PaginationBar
                                totalCount={filteredUsers.length}
                                pageStart={pageStart}
                                pageEnd={pageEnd}
                                currentPage={currentPage}
                                totalPages={totalPages}
                                setCurrentPage={setCurrentPage}
                            />
                        )}
                    </div>
                </div>
            </div>

            {viewUser && (
                <div
                    className="product-view-modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="customer-view-title"
                    onClick={(e) => e.target === e.currentTarget && setViewUser(null)}
                >
                    <div className="product-view-modal" style={{ maxWidth: '720px' }}>
                        <div className="product-view-modal-header">
                            <div>
                                <h2 id="customer-view-title" className="product-view-modal-title">
                                    {getUserDisplayName(viewUser) || 'User'}
                                </h2>
                                <p className="text-sm text-slate-500 mt-1 font-mono break-all">{viewUser.id}</p>
                                {getUserCreatedAt(viewUser) && (
                                    <p className="text-sm text-slate-500 mt-1">
                                        Joined {formatTimestamp(getUserCreatedAt(viewUser))}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                className="product-view-close-btn"
                                onClick={() => setViewUser(null)}
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="product-view-modal-body">
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                    gap: '1rem',
                                    marginBottom: '1.25rem',
                                }}
                            >
                                <div className="p-3 rounded-lg bg-slate-50">
                                    <div className="text-xs text-slate-500">Total spent (matched orders)</div>
                                    <div className="text-lg font-semibold">{formatRupee(computedStats.totalSpent)}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-50">
                                    <div className="text-xs text-slate-500">Orders</div>
                                    <div className="text-lg font-semibold flex items-center gap-1">
                                        <ShoppingBag size={18} className="text-slate-400" />
                                        {computedStats.orderCount}
                                    </div>
                                </div>
                                {(viewUser.purchases != null || viewUser.ordersCount != null) && (
                                    <div className="p-3 rounded-lg bg-slate-50">
                                        <div className="text-xs text-slate-500">Stored on profile</div>
                                        <div className="text-sm font-medium">
                                            {viewUser.purchases != null && <span>{String(viewUser.purchases)} · </span>}
                                            {viewUser.ordersCount != null && (
                                                <span>{viewUser.ordersCount} orders</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Contact
                            </h4>
                            <dl className="text-sm space-y-2 mb-6">
                                <div className="flex justify-between gap-4">
                                    <dt className="text-slate-500">Email</dt>
                                    <dd className="text-right break-all">{getUserEmail(viewUser) || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="text-slate-500">Phone</dt>
                                    <dd>{getUserPhone(viewUser) || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500 mb-1">Address</dt>
                                    <dd className="whitespace-pre-wrap text-slate-800">
                                        {getUserAddressSummary(viewUser) || '—'}
                                    </dd>
                                </div>
                            </dl>

                            {extraPrimitives.length > 0 && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                        Other fields
                                    </h4>
                                    <dl className="text-sm space-y-1">
                                        {extraPrimitives.map(([k, v]) => (
                                            <div key={k} className="flex justify-between gap-4 border-b border-slate-50 pb-1">
                                                <dt className="text-slate-500 shrink-0">{k}</dt>
                                                <dd className="text-right break-all">
                                                    {v?.toDate ? formatTimestamp(v) : String(v)}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            )}

                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Related orders
                            </h4>
                            {relatedOrders.length === 0 ? (
                                <p className="text-sm text-slate-500 mb-4">
                                    No orders matched by user id, email, or phone (including nested billing/shipping on
                                    orders).
                                </p>
                            ) : (
                                <div
                                    className="data-table-container mb-4"
                                    style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                >
                                    <table className="data-table" style={{ margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>Order</th>
                                                <th>Total</th>
                                                <th>Status</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {relatedOrders.slice(0, 25).map((o) => (
                                                <tr key={o.id}>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="customer-related-order-id"
                                                            onClick={() => openRelatedOrderInvoiceOrDetails(o)}
                                                            title={
                                                                o.invoiceUrl
                                                                    ? 'Open invoice PDF'
                                                                    : 'View order (opens Orders page)'
                                                            }
                                                        >
                                                            #{o.id.slice(0, 10)}…
                                                        </button>
                                                    </td>
                                                    <td>{formatRupee(getOrderTotalValue(o))}</td>
                                                    <td>{o.status || '—'}</td>
                                                    <td className="text-xs">{formatTimestamp(o.createdAt)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {relatedOrders.length > 25 && (
                                        <p className="text-xs text-slate-500 p-2">
                                            Showing 25 of {relatedOrders.length} orders.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setViewUser(null)}>
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                                    onClick={() => handleDelete(viewUser.id)}
                                >
                                    Delete profile
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;
