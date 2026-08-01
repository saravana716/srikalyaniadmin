import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Loader2, Search, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { db } from '../firebase';
import {
    collection,
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    writeBatch,
} from 'firebase/firestore';
import '../assets/styles/Dashboard.css';
import '../assets/styles/Table.css';
import '../assets/styles/Products.css';
import '../assets/styles/Coupons.css';
import PaginationBar from '../components/PaginationBar';
import { usePagination, DEFAULT_PAGE_SIZE } from '../hooks/usePagination';

const COLLECTION = 'categoryDiscounts';

const DEFAULT_EXAMPLES = [
    { categoryName: 'Sunglasses', discountPercent: 20 },
    { categoryName: 'Spectacles', discountPercent: 20 },
    { categoryName: 'Contact lenses', discountPercent: 10 },
];

const emptyForm = () => ({
    categoryName: '',
    discountPercent: '',
});

function sortDiscounts(list) {
    return [...list].sort((a, b) =>
        String(a.categoryName || '').localeCompare(String(b.categoryName || ''), undefined, { sensitivity: 'base' })
    );
}

const Discounts = () => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const headerCheckboxRef = useRef(null);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, COLLECTION),
            (snapshot) => {
                const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                setItems(sortDiscounts(list));
                setLoading(false);
            },
            (err) => {
                console.error('Category discounts:', err);
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, 'categories'),
            (snapshot) => {
                const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                list.sort((a, b) =>
                    String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
                );
                setCategories(list);
            },
            (err) => console.error('Categories listener (discounts):', err)
        );
        return () => unsub();
    }, []);

    /** Category names already used by another discount row (not the row being edited). */
    const usedCategoryKeys = useMemo(() => {
        const s = new Set();
        items.forEach((row) => {
            if (row.id === editingId) return;
            const k = String(row.categoryName || '').trim().toLowerCase();
            if (k) s.add(k);
        });
        return s;
    }, [items, editingId]);

    const categoryNamesFromFirestore = useMemo(
        () => new Set(categories.map((c) => String(c.name || '').trim().toLowerCase()).filter(Boolean)),
        [categories]
    );

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return items;
        return items.filter((row) => String(row.categoryName || '').toLowerCase().includes(q));
    }, [items, searchTerm]);

    const paginationKey = searchTerm;
    const {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedItems: paginatedRows,
        pageStart,
        pageEnd,
    } = usePagination(filtered, DEFAULT_PAGE_SIZE, paginationKey);

    const toggleRowSelected = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allFilteredSelected =
        filtered.length > 0 && filtered.every((row) => selectedIds.has(row.id));

    useEffect(() => {
        const el = headerCheckboxRef.current;
        if (!el) return;
        const some = filtered.some((row) => selectedIds.has(row.id));
        el.indeterminate = some && !allFilteredSelected;
    }, [filtered, selectedIds, allFilteredSelected]);

    useEffect(() => {
        const allowed = new Set(filtered.map((r) => r.id));
        setSelectedIds((prev) => {
            const next = new Set([...prev].filter((id) => allowed.has(id)));
            if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
            return next;
        });
    }, [filtered]);

    const toggleSelectAllFiltered = () => {
        setSelectedIds((prev) => {
            const every =
                filtered.length > 0 && filtered.every((row) => prev.has(row.id));
            if (every) {
                const next = new Set(prev);
                filtered.forEach((row) => next.delete(row.id));
                return next;
            }
            const next = new Set(prev);
            filtered.forEach((row) => next.add(row.id));
            return next;
        });
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowForm(true);
    };

    const openEdit = (row) => {
        setEditingId(row.id);
        setForm({
            categoryName: row.categoryName || '',
            discountPercent: row.discountPercent != null ? String(row.discountPercent) : '',
        });
        setShowForm(true);
    };

    const save = async () => {
        const categoryName = form.categoryName.trim();
        if (!categoryName) {
            alert('Select a category from the list.');
            return;
        }
        const inCatalog = categoryNamesFromFirestore.has(categoryName.toLowerCase());
        if (!inCatalog) {
            alert('Selected category must exist in Categories. Add it there first, or pick another category.');
            return;
        }
        const discountPercent = Number(form.discountPercent);
        if (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
            alert('Enter a discount between 0 and 100.');
            return;
        }

        const key = categoryName.toLowerCase();
        const duplicate = items.some(
            (row) =>
                row.id !== editingId && String(row.categoryName || '').trim().toLowerCase() === key
        );
        if (duplicate) {
            alert('A discount for this category name already exists.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                categoryName,
                discountPercent,
                updatedAt: serverTimestamp(),
            };
            if (editingId) {
                await updateDoc(doc(db, COLLECTION, editingId), payload);
            } else {
                await addDoc(collection(db, COLLECTION), {
                    ...payload,
                    createdAt: serverTimestamp(),
                });
            }
            setShowForm(false);
        } catch (err) {
            console.error(err);
            alert('Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const removeOne = async (id) => {
        if (!window.confirm('Delete this category discount?')) return;
        try {
            await deleteDoc(doc(db, COLLECTION, id));
            setSelectedIds((prev) => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (err) {
            console.error(err);
            alert('Failed to delete.');
        }
    };

    const handleBulkDelete = async () => {
        const ids = [...selectedIds];
        if (ids.length === 0) return;
        const msg =
            ids.length === 1
                ? 'Delete this category discount?'
                : `Delete ${ids.length} category discounts? This cannot be undone.`;
        if (!window.confirm(msg)) return;
        try {
            const chunkSize = 400;
            for (let i = 0; i < ids.length; i += chunkSize) {
                const batch = writeBatch(db);
                ids.slice(i, i + chunkSize).forEach((id) => {
                    batch.delete(doc(db, COLLECTION, id));
                });
                await batch.commit();
            }
            setSelectedIds(new Set());
        } catch (err) {
            console.error(err);
            alert('Failed to delete some rows.');
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const insertExamples = async () => {
        if (
            !window.confirm(
                'Add example discounts (20% / 20% / 10%) only for categories that exist in Categories and are not already in this list?'
            )
        ) {
            return;
        }
        setSeeding(true);
        try {
            const existing = new Set(
                items.map((d) => String(d.categoryName || '').trim().toLowerCase())
            );
            const nameByKey = new Map(
                categories.map((c) => [String(c.name || '').trim().toLowerCase(), String(c.name || '').trim()])
            );
            for (const row of DEFAULT_EXAMPLES) {
                const k = row.categoryName.toLowerCase();
                if (existing.has(k)) continue;
                const canonical = nameByKey.get(k);
                if (!canonical) continue;
                await addDoc(collection(db, COLLECTION), {
                    categoryName: canonical,
                    discountPercent: row.discountPercent,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                existing.add(k);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to add examples.');
        } finally {
            setSeeding(false);
        }
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
                            <span className="active">Discounts</span>
                        </div>
                        <div className="page-title-row">
                            <div>
                                <h1 className="text-2xl font-bold">Category discounts</h1>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Choose a category from your <span className="font-medium">Categories</span>{' '}
                                    collection; one discount row per category. Storefront can read{' '}
                                    <code className="text-xs bg-slate-100 px-1 rounded">categoryDiscounts</code>.
                                </p>
                            </div>
                            <div className="action-buttons flex-wrap justify-end">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={insertExamples}
                                    disabled={seeding || loading}
                                >
                                    {seeding ? <Loader2 className="animate-spin" size={18} /> : null}
                                    Insert examples
                                </button>
                                <button type="button" className="btn-primary" onClick={openAdd}>
                                    <Plus size={18} /> Add discount
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="controls-row">
                        <div className="search-box">
                            <Search className="search-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Search by category name"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="table-card">
                        <div className="data-table-container">
                            {loading ? (
                                <div className="flex items-center justify-center p-20">
                                    <Loader2 className="animate-spin text-blue-600" size={40} />
                                </div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40 }}>
                                                <input
                                                    ref={headerCheckboxRef}
                                                    type="checkbox"
                                                    checked={allFilteredSelected}
                                                    onChange={toggleSelectAllFiltered}
                                                    disabled={filtered.length === 0}
                                                    aria-label="Select all rows"
                                                />
                                            </th>
                                            <th>Category</th>
                                            <th>Discount</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedRows.map((row) => (
                                            <tr key={row.id}>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(row.id)}
                                                        onChange={() => toggleRowSelected(row.id)}
                                                        aria-label={`Select ${row.categoryName}`}
                                                    />
                                                </td>
                                                <td className="font-medium">{row.categoryName || '—'}</td>
                                                <td>
                                                    <span className="badge badge-paid">{row.discountPercent}%</span>
                                                </td>
                                                <td>
                                                    <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                                                        <button
                                                            type="button"
                                                            className="action-btn"
                                                            title="Edit"
                                                            aria-label="Edit"
                                                            onClick={() => openEdit(row)}
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="action-btn delete"
                                                            title="Delete"
                                                            aria-label="Delete"
                                                            onClick={() => removeOne(row.id)}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                                                    {items.length === 0
                                                        ? 'No category discounts yet. Add one or use Insert examples.'
                                                        : 'No categories match your search.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {!loading && selectedIds.size > 0 && (
                            <div className="products-bulk-bar" role="toolbar" aria-label="Bulk actions">
                                <span className="products-bulk-bar-count">{selectedIds.size} selected</span>
                                <div className="products-bulk-bar-actions">
                                    <button type="button" className="btn-secondary" onClick={clearSelection}>
                                        Clear
                                    </button>
                                    <button type="button" className="btn-danger-outline" onClick={handleBulkDelete}>
                                        <Trash2 size={16} aria-hidden />
                                        Delete selected
                                    </button>
                                </div>
                            </div>
                        )}

                        {!loading && (
                            <PaginationBar
                                totalCount={filtered.length}
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

            {showForm && (
                <div
                    className="modal-overlay coupons-modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="discount-form-title"
                    onClick={() => setShowForm(false)}
                >
                    <div className="modal-content coupons-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 id="discount-form-title">
                                {editingId ? 'Edit category discount' : 'Add category discount'}
                            </h3>
                            <button type="button" onClick={() => setShowForm(false)} aria-label="Close">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="disc-category">Category *</label>
                                <div className="select-wrapper">
                                    <select
                                        id="disc-category"
                                        value={form.categoryName}
                                        onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                                    >
                                        <option value="">Select category</option>
                                        {form.categoryName &&
                                            !categories.some(
                                                (c) => String(c.name || '') === form.categoryName
                                            ) && (
                                                <option value={form.categoryName}>
                                                    {form.categoryName} (not in Categories — save to fix or delete)
                                                </option>
                                            )}
                                        {categories.map((cat) => {
                                            const name = String(cat.name || '').trim();
                                            if (!name) return null;
                                            const taken = usedCategoryKeys.has(name.toLowerCase());
                                            const isCurrent = form.categoryName === name;
                                            return (
                                                <option key={cat.id} value={name} disabled={taken && !isCurrent}>
                                                    {name}
                                                    {taken && !isCurrent ? ' — already has a discount' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <ChevronDown className="select-icon" size={18} />
                                </div>
                                {categories.length === 0 && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        No categories in Firestore yet. Add categories under{' '}
                                        <span className="font-medium">Categories</span> first.
                                    </p>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="disc-pct">Discount (%) *</label>
                                <input
                                    id="disc-pct"
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    value={form.discountPercent}
                                    onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                                    placeholder="0–100"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                                    {saving ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} /> Saving…
                                        </>
                                    ) : editingId ? (
                                        'Save changes'
                                    ) : (
                                        'Add'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Discounts;
