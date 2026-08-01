import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Loader2, TicketPercent } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import '../assets/styles/Dashboard.css';
import '../assets/styles/Table.css';
import '../assets/styles/Coupons.css';
import PaginationBar from '../components/PaginationBar';
import { usePagination, DEFAULT_PAGE_SIZE } from '../hooks/usePagination';

function createdAtMillis(v) {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v === 'number') return v;
    if (v.seconds != null) return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
    return 0;
}

const emptyForm = () => ({
    title: '',
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderAmount: '',
    expiryDate: '',
    description: '',
    active: true
});

const Coupons = () => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm());

    useEffect(() => {
        // Do not use orderBy('createdAt') on the server: Firestore omits documents
        // that lack that field (e.g. console-created rows), so the table looked empty.
        const unsub = onSnapshot(
            collection(db, 'coupons'),
            (snapshot) => {
                const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt));
                setCoupons(list);
                setLoading(false);
            },
            (err) => {
                console.error('Coupons listener:', err);
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowForm(true);
    };

    const openEdit = (c) => {
        setEditingId(c.id);
        setForm({
            title: c.title || '',
            code: c.code || '',
            discountType: c.discountType === 'fixed' ? 'fixed' : 'percentage',
            discountValue: c.discountValue != null ? String(c.discountValue) : '',
            minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : '',
            expiryDate: c.expiryDate || '',
            description: c.description || '',
            active: c.active !== false
        });
        setShowForm(true);
    };

    const save = async () => {
        const code = form.code.trim().toUpperCase().replace(/\s+/g, '');
        if (!code) {
            alert('Enter a coupon code.');
            return;
        }
        const discountValue = Number(form.discountValue);
        if (isNaN(discountValue) || discountValue < 0) {
            alert('Enter a valid discount value.');
            return;
        }
        if (form.discountType === 'percentage' && discountValue > 100) {
            alert('Percentage cannot exceed 100.');
            return;
        }
        const minOrder = form.minOrderAmount === '' ? null : Number(form.minOrderAmount);
        if (form.minOrderAmount !== '' && (isNaN(minOrder) || minOrder < 0)) {
            alert('Enter a valid minimum order amount or leave empty.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                title: form.title.trim() || code,
                code,
                discountType: form.discountType,
                discountValue,
                minOrderAmount: minOrder,
                expiryDate: form.expiryDate || null,
                description: form.description.trim() || null,
                active: !!form.active,
                updatedAt: serverTimestamp()
            };
            if (editingId) {
                await updateDoc(doc(db, 'coupons', editingId), payload);
            } else {
                await addDoc(collection(db, 'coupons'), {
                    ...payload,
                    createdAt: serverTimestamp()
                });
            }
            setShowForm(false);
        } catch (err) {
            console.error(err);
            alert('Failed to save coupon.');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id) => {
        if (!window.confirm('Delete this coupon?')) return;
        try {
            await deleteDoc(doc(db, 'coupons', id));
        } catch (err) {
            console.error(err);
            alert('Failed to delete.');
        }
    };

    const formatDiscount = (c) => {
        if (c.discountType === 'fixed') return `₹ ${c.discountValue}`;
        return `${c.discountValue}%`;
    };

    const {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedItems: paginatedCoupons,
        pageStart,
        pageEnd,
    } = usePagination(coupons, DEFAULT_PAGE_SIZE, '');

    return (
        <div className="dashboard-container">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
            <div className="main-content">
                <Header toggleSidebar={toggleSidebar} />
                <div className="dashboard-content">
                    <div className="content-header">
                        <div className="breadcrumb">
                            <span className="cursor-pointer" onClick={() => navigate('/dashboard')}>Dashboard</span>
                            <span className="separator"> &gt; </span>
                            <span className="active">Coupons</span>
                        </div>
                        <div className="page-title-row">
                            <h1 className="text-2xl font-bold">Coupons</h1>
                            <button type="button" className="btn-primary" onClick={openAdd}>
                                <Plus size={18} /> Add Coupon
                            </button>
                        </div>
                    </div>
                    <p className="coupons-intro">Create discount codes. Customers can apply them at checkout (storefront).</p>

                    <div className="table-card">
                        {loading ? (
                            <div className="categories-loading">
                                <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)' }} />
                            </div>
                        ) : (
                            <div className="data-table-container">
                                <table className="data-table coupons-table">
                                    <thead>
                                        <tr>
                                            <th>Code</th>
                                            <th>Title</th>
                                            <th>Discount</th>
                                            <th>Min order (₹)</th>
                                            <th>Expires</th>
                                            <th>Status</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedCoupons.map((c) => (
                                            <tr key={c.id}>
                                                <td><code className="coupon-code">{c.code}</code></td>
                                                <td>{c.title || '—'}</td>
                                                <td>{formatDiscount(c)}</td>
                                                <td>{c.minOrderAmount != null ? `₹ ${c.minOrderAmount}` : '—'}</td>
                                                <td>{c.expiryDate || '—'}</td>
                                                <td>
                                                    <span className={`badge ${c.active !== false ? 'badge-paid' : 'badge-unpaid'}`}>
                                                        {c.active !== false ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                                                        <button type="button" className="action-btn" onClick={() => openEdit(c)} title="Edit"><Edit2 size={18} /></button>
                                                        <button type="button" className="action-btn delete" onClick={() => remove(c.id)} title="Delete"><Trash2 size={18} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {coupons.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="coupons-empty-cell">
                                                    <TicketPercent size={40} className="text-gray-400" style={{ marginBottom: 8 }} />
                                                    <div>No coupons yet. Click &quot;Add Coupon&quot; to create one.</div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                {!loading && (
                                    <PaginationBar
                                        totalCount={coupons.length}
                                        pageStart={pageStart}
                                        pageEnd={pageEnd}
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        setCurrentPage={setCurrentPage}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="modal-overlay coupons-modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-content coupons-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingId ? 'Edit Coupon' : 'Add Coupon'}</h3>
                            <button type="button" onClick={() => setShowForm(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Coupon code *</label>
                                <input
                                    type="text"
                                    value={form.code}
                                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. SAVE20"
                                    disabled={!!editingId}
                                />
                                {editingId && <small className="form-hint">Code cannot be changed after creation.</small>}
                            </div>
                            <div className="form-group">
                                <label>Title (display)</label>
                                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Summer sale" />
                            </div>
                            <div className="form-row coupons-form-row">
                                <div className="form-group flex-1">
                                    <label>Discount type *</label>
                                    <select value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value })}>
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed amount (₹)</option>
                                    </select>
                                </div>
                                <div className="form-group flex-1">
                                    <label>Discount value *</label>
                                    <input type="number" min="0" step="0.01" value={form.discountValue} onChange={e => setForm({ ...form, discountValue: e.target.value })} placeholder={form.discountType === 'percentage' ? '10' : '100'} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Minimum order (₹)</label>
                                <input type="number" min="0" step="1" value={form.minOrderAmount} onChange={e => setForm({ ...form, minOrderAmount: e.target.value })} placeholder="Optional" />
                            </div>
                            <div className="form-group">
                                <label>Expiry date</label>
                                <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
                            </div>
                            <div className="form-group checkbox-row">
                                <label>
                                    <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                                    <span>Active</span>
                                </label>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                                    {saving ? <><Loader2 className="animate-spin" size={18} /> Saving...</> : (editingId ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Coupons;
