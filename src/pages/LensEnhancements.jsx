import React, { useState, useEffect, useMemo } from 'react';
import PaginationBar from '../components/PaginationBar';
import { usePagination, DEFAULT_PAGE_SIZE } from '../hooks/usePagination';
import { Plus, Edit2, Trash2, X, Loader2, Glasses } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import '../assets/styles/Dashboard.css';
import '../assets/styles/Categories.css';
import '../assets/styles/LensEnhancements.css';

/** Lens types (tabs). Legacy docs without `lensCategory` are treated as Single Vision. */
const LENS_CATEGORIES = [
    { id: 'Single Vision', label: 'Single Vision' },
    { id: 'Bifocal', label: 'Bifocal' },
    { id: 'Progressive', label: 'Progressive' },
];

/** Default enhancement names per lens type (wireframe). */
const DEFAULT_OPTIONS_BY_CATEGORY = {
    'Single Vision': ['Anti-Glare', 'Blue Cut', 'UV Protection', 'Tinted'],
    Bifocal: ['Anti-Glare', 'Blue Cut', 'Tinted'],
    Progressive: ['Anti-Glare', 'Tinted'],
};

function categoryOf(item) {
    const c = item.lensCategory;
    if (c && LENS_CATEGORIES.some((x) => x.id === c)) return c;
    return 'Single Vision';
}

const LensEnhancements = () => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [enhancements, setEnhancements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeCategory, setActiveCategory] = useState('Single Vision');

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [formCategory, setFormCategory] = useState('Single Vision');

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'lensEnhancements'), (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setEnhancements(list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const categoryCounts = useMemo(() => {
        const counts = { 'Single Vision': 0, Bifocal: 0, Progressive: 0 };
        enhancements.forEach((e) => {
            counts[categoryOf(e)] += 1;
        });
        return counts;
    }, [enhancements]);

    const itemsInCategory = useMemo(
        () =>
            enhancements
                .filter((e) => categoryOf(e) === activeCategory)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        [enhancements, activeCategory]
    );

    const {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedItems: paginatedInCategory,
        pageStart,
        pageEnd,
    } = usePagination(itemsInCategory, DEFAULT_PAGE_SIZE, activeCategory);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const nextOrderInCategory = (catId) => {
        const inCat = enhancements.filter((e) => categoryOf(e) === catId);
        if (inCat.length === 0) return 0;
        return Math.max(...inCat.map((e) => Number(e.order) || 0)) + 1;
    };

    const openAdd = () => {
        setEditingId(null);
        setName('');
        setPrice('');
        setFormCategory(activeCategory);
        setShowForm(true);
    };

    const openEdit = (item) => {
        setEditingId(item.id);
        setName(item.name || '');
        setPrice(String(item.price ?? ''));
        setFormCategory(categoryOf(item));
        setShowForm(true);
    };

    const save = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            alert('Enter enhancement name.');
            return;
        }
        const priceNum = price === '' ? 0 : Number(price);
        if (Number.isNaN(priceNum) || priceNum < 0) {
            alert('Enter a valid price (₹).');
            return;
        }
        if (!LENS_CATEGORIES.some((c) => c.id === formCategory)) {
            alert('Select a lens category.');
            return;
        }
        setSaving(true);
        try {
            if (editingId) {
                const prev = enhancements.find((e) => e.id === editingId);
                const prevCat = prev ? categoryOf(prev) : formCategory;
                const payload = {
                    name: trimmedName,
                    price: priceNum,
                    lensCategory: formCategory,
                    updatedAt: serverTimestamp(),
                };
                if (prevCat !== formCategory) {
                    payload.order = nextOrderInCategory(formCategory);
                }
                await updateDoc(doc(db, 'lensEnhancements', editingId), payload);
            } else {
                await addDoc(collection(db, 'lensEnhancements'), {
                    name: trimmedName,
                    price: priceNum,
                    lensCategory: formCategory,
                    order: nextOrderInCategory(formCategory),
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

    const remove = async (id) => {
        if (!window.confirm('Delete this lens enhancement? Products using it may be affected.')) return;
        try {
            await deleteDoc(doc(db, 'lensEnhancements', id));
        } catch (err) {
            console.error(err);
            alert('Failed to delete.');
        }
    };

    const addStandardOptionsForTab = async () => {
        const defaults = DEFAULT_OPTIONS_BY_CATEGORY[activeCategory] || [];
        const existing = new Set(
            enhancements
                .filter((e) => categoryOf(e) === activeCategory)
                .map((e) => e.name.trim().toLowerCase())
        );
        const toAdd = defaults.filter((n) => !existing.has(n.trim().toLowerCase()));
        if (toAdd.length === 0) {
            alert(`All default options for "${activeCategory}" already exist. Use "Add new option" for more.`);
            return;
        }
        setSaving(true);
        try {
            let ord = nextOrderInCategory(activeCategory);
            for (let i = 0; i < toAdd.length; i += 1) {
                await addDoc(collection(db, 'lensEnhancements'), {
                    name: toAdd[i],
                    price: 0,
                    lensCategory: activeCategory,
                    order: ord + i,
                    createdAt: serverTimestamp(),
                });
            }
            alert(`Added ${toAdd.length} option(s) under "${activeCategory}". Edit each to set price (₹).`);
        } catch (err) {
            console.error(err);
            alert('Failed to add options.');
        } finally {
            setSaving(false);
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
                            <span className="active">Lens Enhancements</span>
                        </div>
                        <div className="page-title-row">
                            <h1 className="text-2xl font-bold">Lens Enhancements</h1>
                            <div className="lens-enhancements-header-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={addStandardOptionsForTab}
                                    disabled={saving}
                                    title={`Add default options for ${activeCategory} (price 0 — edit to set ₹)`}
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : null} Add defaults
                                    for tab
                                </button>
                                <button type="button" className="btn-primary" onClick={openAdd}>
                                    <Plus size={18} /> Add new option
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="section-subtitle" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
                        Pick a <strong>lens type</strong> tab, then manage enhancement cards for that category.
                        Existing items without a type appear under <strong>Single Vision</strong>.
                    </p>

                    <div className="lens-cat-tabs-wrap">
                        <nav className="lens-cat-tabs" role="tablist" aria-label="Lens type">
                            {LENS_CATEGORIES.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeCategory === c.id}
                                    className={`lens-cat-tab ${activeCategory === c.id ? 'lens-cat-tab--active' : ''}`}
                                    onClick={() => {
                                        setActiveCategory(c.id);
                                        setCurrentPage(1);
                                    }}
                                >
                                    {c.label}
                                    <span className="lens-cat-count">{categoryCounts[c.id] ?? 0}</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    {loading ? (
                        <div className="categories-loading">
                            <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)' }} />
                        </div>
                    ) : (
                        <>
                            <div className="lens-enhancement-panel">
                                {itemsInCategory.length === 0 ? (
                                    <div className="lens-panel-empty">
                                        <Glasses size={40} className="text-gray-400 mb-2" style={{ margin: '0 auto' }} />
                                        <p>No enhancements for <strong>{activeCategory}</strong> yet.</p>
                                        <p className="mt-2" style={{ fontSize: '0.9rem' }}>
                                            Use <strong>Add defaults for tab</strong> for Anti-Glare, Blue Cut, etc.,
                                            or <strong>Add new option</strong>.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="lens-cards-row">
                                        <span className="lens-edge-label" aria-hidden>
                                            Start
                                        </span>
                                        <div className="lens-cards-scroll">
                                            {paginatedInCategory.map((item) => (
                                                <div key={item.id} className="lens-item-card">
                                                    <div className="category-card-header">
                                                        <div className="category-image-wrap lens-enhancement-icon">
                                                            <Glasses size={28} className="text-gray-400" />
                                                        </div>
                                                        <div className="category-info">
                                                            <h3 className="category-name">{item.name}</h3>
                                                            <p className="lens-enhancement-price-display">
                                                                ₹ {item.price ?? 0}
                                                            </p>
                                                            <div className="category-actions">
                                                                <button
                                                                    type="button"
                                                                    className="btn-icon"
                                                                    onClick={() => openEdit(item)}
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn-icon danger"
                                                                    onClick={() => remove(item.id)}
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <span className="lens-edge-label" aria-hidden>
                                            End
                                        </span>
                                    </div>
                                )}
                            </div>
                            {itemsInCategory.length > 0 && (
                                <PaginationBar
                                    totalCount={itemsInCategory.length}
                                    pageStart={pageStart}
                                    pageEnd={pageEnd}
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    setCurrentPage={setCurrentPage}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="modal-overlay categories-modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-content categories-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingId ? 'Edit Lens Enhancement' : 'Add Lens Enhancement'}</h3>
                            <button type="button" onClick={() => setShowForm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group lens-form-category">
                                <label>Lens type (category)</label>
                                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                                    {LENS_CATEGORIES.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Enhancement name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Anti-Glare, Blue Cut"
                                />
                            </div>
                            <div className="form-group">
                                <label>Price (₹)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                                    {saving ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} /> Saving...
                                        </>
                                    ) : editingId ? (
                                        'Update'
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

export default LensEnhancements;
