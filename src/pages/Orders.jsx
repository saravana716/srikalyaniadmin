import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Filter, Download, Plus, Eye, Loader2, X, FileText, Truck, ExternalLink } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PaginationBar from '../components/PaginationBar';
import { usePagination, DEFAULT_PAGE_SIZE } from '../hooks/usePagination';
import { db } from '../firebase';
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../assets/styles/Dashboard.css';
import '../assets/styles/Table.css';
import '../assets/styles/Products.css';
import './Orders.css';
import {
    formatTimestamp,
    formatTimestampShort,
    formatRupee,
    getOrderLineItems,
    stringifyAddress,
    getOrderCustomerName,
    getOrderTotalValue,
    getOrderSearchBlobWithUser,
    getOrderLifecycleBucket,
    getUserDisplayName,
    getUserEmail,
    getUserPhone,
} from '../utils/firestoreDisplay';
import {
    createDelhiveryShipment,
    extractShippingForDelhivery,
    formatDelhiveryUserMessage,
} from '../utils/delhiveryApi';

/**
 * Admin-selectable order `status` values (saved to Firestore).
 * `Delivered` is the single “finished / received” state (legacy `Completed` is migrated to `Delivered`).
 */
const ORDER_STATUS_OPTIONS = [
    'Pending',
    'Ordered',
    'Processing',
    'Shipping',
    'Shipped',
    'Delivered',
    'Cancelled',
    'Returned',
];

/** Map legacy `Completed` to `Delivered` for display and new saves. */
function normalizeOrderStatusForUi(status) {
    if (status == null || status === '') return '';
    return status === 'Completed' ? 'Delivered' : status;
}

const LIFECYCLE_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'shipped', label: 'Shipped' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'cancelled', label: 'Cancelled' },
];

/** Prefer Firestore `users` profile when order.userId matches */
function getOrderRowCustomer(order, usersById) {
    const uid = order.userId;
    const profile = uid ? usersById.get(uid) : null;
    const name = profile
        ? getUserDisplayName(profile) || getOrderCustomerName(order)
        : getOrderCustomerName(order);
    const email = profile
        ? getUserEmail(profile) ||
          order.customerEmail ||
          order.email ||
          order.shippingAddress?.email ||
          order.billingAddress?.email ||
          ''
        : order.customerEmail ||
          order.email ||
          order.shippingAddress?.email ||
          order.billingAddress?.email ||
          '';
    const phone = profile
        ? getUserPhone(profile) ||
          order.phone ||
          order.phoneNumber ||
          order.shippingAddress?.phone ||
          order.billingAddress?.phone ||
          ''
        : order.phone ||
          order.phoneNumber ||
          order.shippingAddress?.phone ||
          order.billingAddress?.phone ||
          '';
    return {
        name: name && name !== '—' ? name : '—',
        email,
        phone,
        hasProfile: Boolean(profile),
    };
}

const Orders = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [orders, setOrders] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewOrder, setViewOrder] = useState(null);
    /** Firestore order id while `status` is saving (table or modal). */
    const [statusSavingId, setStatusSavingId] = useState(null);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [siteSettings, setSiteSettings] = useState(null);
    const [delhiverySubmitting, setDelhiverySubmitting] = useState(false);

    const usersById = useMemo(() => {
        const m = new Map();
        users.forEach((u) => m.set(u.id, u));
        return m;
    }, [users]);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    useEffect(() => {
        const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return () => unsubUsers();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'siteSettings', 'general'), (snap) => {
            setSiteSettings(snap.exists() ? snap.data() : {});
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setOrders(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const openId = searchParams.get('order');
        if (!openId || !orders.length) return;
        const found = orders.find((o) => o.id === openId);
        if (found) setViewOrder(found);
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.delete('order');
                return next;
            },
            { replace: true }
        );
    }, [searchParams, orders, setSearchParams]);

    const bucketCounts = useMemo(() => {
        const c = { all: orders.length, pending: 0, shipped: 0, delivered: 0, cancelled: 0 };
        orders.forEach((o) => {
            c[getOrderLifecycleBucket(o)] += 1;
        });
        return c;
    }, [orders]);

    const filteredOrders = useMemo(() => {
        const qv = searchTerm.trim().toLowerCase();
        return orders.filter((order) => {
            if (statusFilter !== 'all' && getOrderLifecycleBucket(order) !== statusFilter) return false;
            if (!qv) return true;
            const profile = order.userId ? usersById.get(order.userId) : null;
            return getOrderSearchBlobWithUser(order, profile).includes(qv);
        });
    }, [orders, statusFilter, searchTerm, usersById]);

    const paginationResetKey = `${statusFilter}|${searchTerm}`;
    const {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedItems: paginatedOrders,
        pageStart,
        pageEnd,
    } = usePagination(filteredOrders, DEFAULT_PAGE_SIZE, paginationResetKey);

    /** Maps `order.status` to a tone class for colored selects (same palette as badges). */
    const getStatusBadgeClass = (status) => {
        const s = status || 'Pending';
        switch (s) {
            case 'Pending':
                return 'orders-tone-pending';
            case 'Processing':
                return 'orders-tone-processing';
            case 'Ordered':
                return 'badge-shipping';
            case 'Shipping':
            case 'Shipped':
                return 'badge-shipping';
            case 'Completed':
            case 'Delivered':
                return 'badge-paid';
            case 'Cancelled':
                return 'badge-cancelled';
            case 'Return':
            case 'Returned':
                return 'badge-unpaid';
            default:
                return 'badge-secondary';
        }
    };

    const handleDeleteOrder = async (order) => {
        if (!window.confirm(`Delete order ${order.id}? This cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, 'orders', order.id));
            setViewOrder(null);
        } catch (err) {
            console.error(err);
            alert('Failed to delete order');
        }
    };

    const handleDelhiveryShip = async () => {
        if (!viewOrder) return;
        const token = siteSettings?.delhiveryApiToken;
        const warehouse = siteSettings?.delhiveryWarehouseName;
        const base = siteSettings?.delhiveryApiBaseUrl;
        if (!token || !String(warehouse || '').trim()) {
            alert('Configure Delhivery: add your Live API token and warehouse name under Settings → Delhivery.');
            return;
        }
        if (viewOrder.delhivery?.waybill) {
            alert('This order already has a Delhivery waybill.');
            return;
        }
        const pre = extractShippingForDelhivery(viewOrder);
        if (!pre.ok) {
            alert(pre.error);
            return;
        }
        setDelhiverySubmitting(true);
        try {
            let result = await createDelhiveryShipment({
                apiToken: token,
                apiBaseRoot: base,
                warehouseName: warehouse,
                order: viewOrder,
            });
            if (
                !result.success &&
                /already|duplicate|exist|unique/i.test(String(result.message || ''))
            ) {
                result = await createDelhiveryShipment({
                    apiToken: token,
                    apiBaseRoot: base,
                    warehouseName: warehouse,
                    order: viewOrder,
                    orderRefSuffix: `-${Date.now()}`,
                });
            }
            if (!result.success) {
                alert(formatDelhiveryUserMessage(result.message));
                return;
            }
            const waybill = result.waybill || '';
            const nextStatus =
                viewOrder.status === 'Pending' || viewOrder.status === 'Processing'
                    ? 'Shipping'
                    : viewOrder.status;
            await updateDoc(doc(db, 'orders', viewOrder.id), {
                delhivery: {
                    waybill,
                    message: result.message || '',
                    createdAt: serverTimestamp(),
                    raw: result.raw || null,
                },
                fulfillmentStatus: 'Delhivery shipment created',
                status: nextStatus,
                updatedAt: serverTimestamp(),
            });
            setViewOrder((prev) =>
                prev
                    ? {
                          ...prev,
                          delhivery: {
                              waybill,
                              message: result.message,
                              raw: result.raw,
                          },
                          fulfillmentStatus: 'Delhivery shipment created',
                          status: nextStatus,
                      }
                    : prev
            );
            alert(waybill ? `Delhivery shipment created. Waybill: ${waybill}` : 'Delhivery shipment created.');
        } catch (err) {
            console.error(err);
            const msg = err?.message || String(err);
            if (/Failed to fetch|NetworkError|load failed/i.test(msg)) {
                alert(
                    'Could not reach /api/delhivery-shipment on this server. Redeploy the admin panel (ensure the api/delhivery-shipment.js file is included), then try again.'
                );
            } else {
                alert(formatDelhiveryUserMessage(msg));
            }
        } finally {
            setDelhiverySubmitting(false);
        }
    };

    const handleUpdateOrderStatus = async (orderId, newStatus) => {
        if (!orderId || !newStatus) return;
        const current = orders.find((o) => o.id === orderId)?.status ?? '';
        if (newStatus === (current || '')) return;

        setStatusSavingId(orderId);
        try {
            await updateDoc(doc(db, 'orders', orderId), {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });
            setViewOrder((prev) =>
                prev && prev.id === orderId ? { ...prev, status: newStatus } : prev
            );
        } catch (err) {
            console.error(err);
            alert('Failed to update status. Check Firestore rules.');
        } finally {
            setStatusSavingId(null);
        }
    };

    /** All values shown in status dropdowns: standard list plus any status seen on loaded orders (Completed → Delivered). */
    const statusSelectOptions = useMemo(() => {
        const set = new Set(ORDER_STATUS_OPTIONS);
        orders.forEach((o) => {
            const t = o.status != null ? String(o.status).trim() : '';
            if (t) set.add(t === 'Completed' ? 'Delivered' : t);
        });
        if (viewOrder?.status && String(viewOrder.status).trim()) {
            const t = String(viewOrder.status).trim();
            set.add(t === 'Completed' ? 'Delivered' : t);
        }
        set.delete('Completed');
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [orders, viewOrder?.status]);

    /** Migrate legacy `Completed` → `Delivered` in Firestore (same meaning; avoids duplicate statuses). */
    const migrateCompletedLock = useRef(false);
    useEffect(() => {
        const legacy = orders.filter((o) => o.status === 'Completed');
        if (legacy.length === 0) return;
        if (migrateCompletedLock.current) return;
        migrateCompletedLock.current = true;
        (async () => {
            try {
                await Promise.all(
                    legacy.map((o) =>
                        updateDoc(doc(db, 'orders', o.id), {
                            status: 'Delivered',
                            updatedAt: serverTimestamp(),
                        })
                    )
                );
            } catch (err) {
                console.error('Completed → Delivered migration:', err);
            } finally {
                migrateCompletedLock.current = false;
            }
        })();
    }, [orders]);

    const lineItems = viewOrder ? getOrderLineItems(viewOrder) : [];
    const shippingAddr =
        viewOrder?.shippingAddress || viewOrder?.deliveryAddress || viewOrder?.address;
    const billingAddr = viewOrder?.billingAddress;
    const amounts = viewOrder?.amounts && typeof viewOrder.amounts === 'object' ? viewOrder.amounts : null;
    const taxDetails = amounts?.taxDetails && typeof amounts.taxDetails === 'object' ? amounts.taxDetails : null;

    const viewProfile = viewOrder?.userId ? usersById.get(viewOrder.userId) : null;
    const customerNameFlat =
        viewOrder &&
        (viewProfile
            ? getUserDisplayName(viewProfile) || getOrderCustomerName(viewOrder)
            : viewOrder.customerName ||
              viewOrder.shippingAddress?.fullName ||
              viewOrder.billingAddress?.fullName);
    const customerEmailFlat =
        viewOrder &&
        (viewProfile
            ? getUserEmail(viewProfile) ||
              viewOrder.customerEmail ||
              viewOrder.email ||
              viewOrder.shippingAddress?.email ||
              viewOrder.billingAddress?.email
            : viewOrder.customerEmail ||
              viewOrder.email ||
              viewOrder.shippingAddress?.email ||
              viewOrder.billingAddress?.email);
    const customerPhoneFlat =
        viewOrder &&
        (viewProfile
            ? getUserPhone(viewProfile) ||
              viewOrder.phone ||
              viewOrder.phoneNumber ||
              viewOrder.shippingAddress?.phone ||
              viewOrder.billingAddress?.phone
            : viewOrder.phone ||
              viewOrder.phoneNumber ||
              viewOrder.shippingAddress?.phone ||
              viewOrder.billingAddress?.phone);

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
                            <span className="active">Orders</span>
                        </div>
                        <div className="page-title-row">
                            <div>
                                <h1 className="text-2xl font-bold">Orders</h1>
                                <p className="orders-status-legend text-sm text-slate-500 mt-0.5">
                                    Order status (editable in the table):{' '}
                                    {ORDER_STATUS_OPTIONS.join(', ')}
                                    . Use <strong>Delivered</strong> when the order is complete (legacy{' '}
                                    <strong>Completed</strong> is merged into Delivered). Fulfillment under the
                                    dropdown is read-only from the order record.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="controls-row">
                        <div className="search-box">
                            <Search className="search-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Search order id, customer, email, phone, status…"
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
                            <button type="button" className="btn-primary">
                                <Plus size={18} /> New Order
                            </button>
                        </div>
                    </div>

                    <div className="orders-filter-row">
                        {LIFECYCLE_FILTERS.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                className={`orders-filter-pill ${statusFilter === f.id ? 'active' : ''}`}
                                onClick={() => setStatusFilter(f.id)}
                            >
                                {f.label}
                                <span className="orders-filter-count">
                                    {f.id === 'all' ? bucketCounts.all : bucketCounts[f.id] ?? 0}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="orders-slim-card">
                        <div className="data-table-container" style={{ overflowX: 'auto' }}>
                            {loading ? (
                                <div className="flex items-center justify-center p-20">
                                    <Loader2 className="animate-spin text-blue-500" size={40} />
                                </div>
                            ) : (
                                <table className="orders-slim-table orders-slim-table--customer">
                                    <thead>
                                        <tr>
                                            <th>Order ID</th>
                                            <th>Customer</th>
                                            <th>Date</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th style={{ textAlign: 'right', width: '1%' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedOrders.map((order) => {
                                            const row = getOrderRowCustomer(order, usersById);
                                            return (
                                                <tr key={order.id}>
                                                    <td className="col-id" title={order.id}>
                                                        {order.id.length > 12
                                                            ? `${order.id.slice(0, 10)}…`
                                                            : order.id}
                                                    </td>
                                                    <td className="orders-col-customer">
                                                        <div className="orders-customer-name">
                                                            {row.name}
                                                            {row.hasProfile && (
                                                                <span className="orders-profile-badge" title="Linked users profile">
                                                                    Profile
                                                                </span>
                                                            )}
                                                        </div>
                                                        {row.email && (
                                                            <div className="orders-customer-meta">{row.email}</div>
                                                        )}
                                                        {row.phone && (
                                                            <div className="orders-customer-meta">{row.phone}</div>
                                                        )}
                                                        {!row.email && !row.phone && !row.hasProfile && (
                                                            <div className="orders-customer-meta muted">—</div>
                                                        )}
                                                    </td>
                                                    <td className="col-date">
                                                        {order.createdAt
                                                            ? formatTimestampShort(order.createdAt)
                                                            : '—'}
                                                    </td>
                                                    <td className="col-amount">
                                                        {formatRupee(getOrderTotalValue(order))}
                                                    </td>
                                                    <td className="orders-col-status">
                                                        <div
                                                            className={`orders-status-cell orders-status-select-wrap ${getStatusBadgeClass(order.status)}`}
                                                        >
                                                            <select
                                                                className="orders-table-status-select"
                                                                aria-label={`Order status for ${order.id}`}
                                                                value={normalizeOrderStatusForUi(order.status)}
                                                                disabled={statusSavingId === order.id}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => {
                                                                    const v = e.target.value;
                                                                    if (v) handleUpdateOrderStatus(order.id, v);
                                                                }}
                                                            >
                                                                {!order.status && (
                                                                    <option value="" disabled>
                                                                        Select…
                                                                    </option>
                                                                )}
                                                                {statusSelectOptions.map((s) => (
                                                                    <option key={s} value={s}>
                                                                        {s}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {statusSavingId === order.id && (
                                                                <Loader2
                                                                    className="orders-table-status-spinner animate-spin"
                                                                    size={16}
                                                                    aria-hidden
                                                                />
                                                            )}
                                                        </div>
                                                        {order.fulfillmentStatus && (
                                                            <div className="orders-fulfillment-hint">
                                                                {order.fulfillmentStatus}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div className="orders-slim-actions">
                                                            <button
                                                                type="button"
                                                                className="btn-icon"
                                                                title="View details"
                                                                onClick={() => setViewOrder(order)}
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                            {order.invoiceUrl ? (
                                                                <a
                                                                    href={order.invoiceUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn-icon primary"
                                                                    title="View invoice PDF"
                                                                >
                                                                    <FileText size={18} />
                                                                </a>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn-icon"
                                                                    disabled
                                                                    title="No invoice yet"
                                                                >
                                                                    <FileText size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredOrders.length === 0 && !loading && (
                                            <tr>
                                                <td
                                                    colSpan="6"
                                                    style={{
                                                        textAlign: 'center',
                                                        padding: '2.5rem',
                                                        color: '#64748b',
                                                    }}
                                                >
                                                    No orders match this filter
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        {!loading && (
                            <PaginationBar
                                totalCount={filteredOrders.length}
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

            {viewOrder && (
                <div
                    className="product-view-modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="order-view-title"
                    onClick={(e) => e.target === e.currentTarget && setViewOrder(null)}
                >
                    <div className="product-view-modal" style={{ maxWidth: '640px' }}>
                        <div className="product-view-modal-header">
                            <div>
                                <h2 id="order-view-title" className="product-view-modal-title">
                                    Order
                                </h2>
                                <p className="text-sm text-slate-500 mt-1 font-mono break-all">{viewOrder.id}</p>
                                {viewProfile && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Customer profile from{' '}
                                        <code className="bg-slate-100 px-1 rounded">users</code> ({viewOrder.userId})
                                    </p>
                                )}
                            </div>
                            <div className="order-modal-actions-top">
                                {viewOrder.invoiceUrl && (
                                    <a
                                        href={viewOrder.invoiceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="order-invoice-btn"
                                    >
                                        <FileText size={16} />
                                        View invoice
                                    </a>
                                )}
                                <button
                                    type="button"
                                    className="product-view-close-btn"
                                    onClick={() => setViewOrder(null)}
                                    aria-label="Close"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="product-view-modal-body">
                            <div className="order-detail-section">
                                <div className="order-status-editor">
                                    <label className="order-status-label" htmlFor="order-status-select">
                                        Order status
                                    </label>
                                    <div
                                        className={`order-status-row orders-status-select-wrap ${getStatusBadgeClass(viewOrder.status)}`}
                                    >
                                        <select
                                            id="order-status-select"
                                            className="order-status-select"
                                            value={normalizeOrderStatusForUi(viewOrder.status)}
                                            disabled={statusSavingId === viewOrder.id}
                                            onChange={(e) =>
                                                handleUpdateOrderStatus(viewOrder.id, e.target.value)
                                            }
                                        >
                                            {!viewOrder.status && (
                                                <option value="" disabled>
                                                    Select status
                                                </option>
                                            )}
                                            {statusSelectOptions.map((s) => (
                                                <option key={s} value={s}>
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                        {statusSavingId === viewOrder.id && (
                                            <Loader2 className="order-status-spinner animate-spin" size={18} />
                                        )}
                                    </div>
                                    {viewOrder.fulfillmentStatus && (
                                        <p className="order-fulfillment-readonly text-xs text-slate-500 mt-2">
                                            Fulfillment: {viewOrder.fulfillmentStatus}
                                        </p>
                                    )}
                                </div>
                                <dl className="text-sm space-y-2">
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500">Customer</dt>
                                        <dd className="text-right font-medium">{customerNameFlat || '—'}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500">Placed on</dt>
                                        <dd>{formatTimestamp(viewOrder.createdAt)}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500">Total</dt>
                                        <dd className="font-semibold">{formatRupee(getOrderTotalValue(viewOrder))}</dd>
                                    </div>
                                    {(viewOrder.paymentMethod || viewOrder.paymentMode) && (
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-slate-500">Payment</dt>
                                            <dd>{viewOrder.paymentMethod || viewOrder.paymentMode}</dd>
                                        </div>
                                    )}
                                    {viewOrder.appliedCoupon != null && viewOrder.appliedCoupon !== '' && (
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-slate-500">Coupon</dt>
                                            <dd className="text-right break-all">
                                                {typeof viewOrder.appliedCoupon === 'object'
                                                    ? JSON.stringify(viewOrder.appliedCoupon)
                                                    : String(viewOrder.appliedCoupon)}
                                            </dd>
                                        </div>
                                    )}
                                    {viewOrder.userId && (
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-slate-500">User ID</dt>
                                            <dd className="text-right break-all text-xs">{viewOrder.userId}</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>

                            {amounts && (
                                <div className="order-detail-section">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                        Amounts
                                    </h4>
                                    <dl className="text-sm space-y-2">
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-slate-500">Subtotal</dt>
                                            <dd>{formatRupee(amounts.subtotal ?? amounts.rawSubtotal)}</dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-slate-500">Tax</dt>
                                            <dd>{formatRupee(amounts.tax)}</dd>
                                        </div>
                                        {taxDetails && (
                                            <div className="text-xs text-slate-500 pl-2 border-l-2 border-slate-200 space-y-1">
                                                {taxDetails.isIntraState != null && (
                                                    <div>Intra-state: {taxDetails.isIntraState ? 'Yes' : 'No'}</div>
                                                )}
                                                {(taxDetails.cgst != null || taxDetails.sgst != null) && (
                                                    <div>
                                                        CGST {formatRupee(taxDetails.cgst)} · SGST{' '}
                                                        {formatRupee(taxDetails.sgst)}
                                                    </div>
                                                )}
                                                {taxDetails.igst != null && taxDetails.igst > 0 && (
                                                    <div>IGST {formatRupee(taxDetails.igst)}</div>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-slate-500">Discount</dt>
                                            <dd>{formatRupee(amounts.discount)}</dd>
                                        </div>
                                        <div className="flex justify-between gap-4 pt-2 border-t border-slate-100 font-semibold">
                                            <dt>Total</dt>
                                            <dd>{formatRupee(amounts.total)}</dd>
                                        </div>
                                    </dl>
                                </div>
                            )}

                            <div className="order-detail-section">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                    Contact
                                </h4>
                                <dl className="text-sm space-y-2">
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500">Email</dt>
                                        <dd className="text-right break-all">{customerEmailFlat || '—'}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500">Phone</dt>
                                        <dd>{customerPhoneFlat || '—'}</dd>
                                    </div>
                                </dl>
                            </div>

                            {(shippingAddr || billingAddr) && (
                                <div className="order-detail-section">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                        Addresses
                                    </h4>
                                    <div className="order-address-grid">
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1">Shipping</div>
                                            <pre
                                                style={{
                                                    whiteSpace: 'pre-wrap',
                                                    fontFamily: 'inherit',
                                                    fontSize: '0.8125rem',
                                                    margin: 0,
                                                    color: '#334155',
                                                }}
                                            >
                                                {stringifyAddress(shippingAddr) || '—'}
                                            </pre>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1">Billing</div>
                                            <pre
                                                style={{
                                                    whiteSpace: 'pre-wrap',
                                                    fontFamily: 'inherit',
                                                    fontSize: '0.8125rem',
                                                    margin: 0,
                                                    color: '#334155',
                                                }}
                                            >
                                                {stringifyAddress(billingAddr) || '—'}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {lineItems.length > 0 && (
                                <div className="order-detail-section">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                        Items
                                    </h4>
                                    <div className="order-items-simple">
                                        <table className="order-items-simple-table">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Qty</th>
                                                    <th className="text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lineItems.map((line, idx) => (
                                                    <tr key={`${line.sku || line.name}-${idx}`}>
                                                        <td className="order-items-name">{line.name}</td>
                                                        <td className="order-items-qty">{line.qty}</td>
                                                        <td className="order-items-amount text-right">
                                                            {formatRupee(line.price)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="order-detail-section order-delhivery-section">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <Truck size={14} className="text-slate-600" />
                                    Delhivery
                                </h4>
                                {!siteSettings?.delhiveryApiToken || !String(siteSettings?.delhiveryWarehouseName || '').trim() ? (
                                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                                        Add your <strong>Live API token</strong> and <strong>warehouse name</strong> in{' '}
                                        <strong>Settings → Delhivery</strong> (from{' '}
                                        <a
                                            href="https://one.delhivery.com/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline"
                                        >
                                            Delhivery One
                                        </a>
                                        ).
                                    </p>
                                ) : null}
                                {viewOrder.delhivery?.waybill ? (
                                    <div className="text-sm space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-slate-500">Waybill</span>
                                            <span className="font-mono font-semibold text-slate-900">
                                                {viewOrder.delhivery.waybill}
                                            </span>
                                            <a
                                                href={`https://www.delhivery.com/track/package/${encodeURIComponent(viewOrder.delhivery.waybill)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-blue-600 text-sm font-medium hover:underline"
                                            >
                                                Track <ExternalLink size={14} />
                                            </a>
                                        </div>
                                        {viewOrder.delhivery.message && (
                                            <p className="text-xs text-slate-500">{viewOrder.delhivery.message}</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        <button
                                            type="button"
                                            className="btn-primary inline-flex items-center justify-center gap-2"
                                            onClick={handleDelhiveryShip}
                                            disabled={
                                                delhiverySubmitting ||
                                                !siteSettings?.delhiveryApiToken ||
                                                !String(siteSettings?.delhiveryWarehouseName || '').trim()
                                            }
                                        >
                                            {delhiverySubmitting ? (
                                                <Loader2 className="animate-spin" size={18} />
                                            ) : (
                                                <Truck size={18} />
                                            )}
                                            Send to Delhivery
                                        </button>
                                        <p className="text-xs text-slate-500 max-w-md">
                                            Creates a forward shipment via Delhivery. Needs valid PIN and phone on
                                            shipping address. Prepaid Delhivery accounts need wallet balance for
                                            manifest charges — recharge in Delhivery One if you see an insufficient
                                            balance error.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setViewOrder(null)}>
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                                    onClick={() => handleDeleteOrder(viewOrder)}
                                >
                                    Delete order
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Orders;
