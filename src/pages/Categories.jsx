import React, { useState, useEffect, useRef } from 'react';
import PaginationBar from '../components/PaginationBar';
import { usePagination, DEFAULT_PAGE_SIZE } from '../hooks/usePagination';
import { Plus, Edit2, Trash2, X, Layers, Loader2, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { db, storage } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import '../assets/styles/Dashboard.css';
import '../assets/styles/Categories.css';

const uploadImage = (file, folder) => {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
        const task = uploadBytesResumable(storageRef, file);
        task.on('state_changed', null, reject, () => getDownloadURL(task.snapshot.ref).then(resolve));
    });
};

const Categories = () => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [categoryName, setCategoryName] = useState('');
    const [categoryImageFile, setCategoryImageFile] = useState(null);
    const [categoryImagePreview, setCategoryImagePreview] = useState(null);
    const categoryImageInputRef = useRef(null);

    const [showSubForm, setShowSubForm] = useState(false);
    const [parentCategoryId, setParentCategoryId] = useState(null);
    const [editingSubId, setEditingSubId] = useState(null);
    const [subName, setSubName] = useState('');
    const [subImageFile, setSubImageFile] = useState(null);
    const [subImagePreview, setSubImagePreview] = useState(null);
    const subImageInputRef = useRef(null);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'categories'), (snapshot) => {
            setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedItems: paginatedCategories,
        pageStart,
        pageEnd,
    } = usePagination(categories, DEFAULT_PAGE_SIZE, '');

    const openAddCategory = () => {
        setEditingCategoryId(null);
        setCategoryName('');
        setCategoryImageFile(null);
        setCategoryImagePreview(null);
        setShowCategoryForm(true);
    };

    const openEditCategory = (cat) => {
        setEditingCategoryId(cat.id);
        setCategoryName(cat.name || '');
        setCategoryImagePreview(cat.imageUrl || null);
        setCategoryImageFile(null);
        setShowCategoryForm(true);
    };

    const handleCategoryImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCategoryImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setCategoryImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const saveCategory = async () => {
        if (!categoryName.trim()) {
            alert('Enter category name.');
            return;
        }
        setSaving(true);
        try {
            let imageUrl = categoryImagePreview && !categoryImageFile ? categoryImagePreview : null;
            if (categoryImageFile) {
                imageUrl = await uploadImage(categoryImageFile, 'categories/images');
            }
            const payload = { name: categoryName.trim(), imageUrl: imageUrl || null, updatedAt: serverTimestamp() };
            if (editingCategoryId) {
                const existing = categories.find(c => c.id === editingCategoryId);
                await updateDoc(doc(db, 'categories', editingCategoryId), {
                    ...payload,
                    subcategories: existing?.subcategories || []
                });
            } else {
                await addDoc(collection(db, 'categories'), {
                    ...payload,
                    subcategories: [],
                    createdAt: serverTimestamp()
                });
            }
            setShowCategoryForm(false);
        } catch (err) {
            console.error(err);
            alert('Failed to save category.');
        } finally {
            setSaving(false);
        }
    };

    const deleteCategory = async (id) => {
        if (!window.confirm('Delete this category? Products using it may be affected.')) return;
        try {
            await deleteDoc(doc(db, 'categories', id));
        } catch (err) {
            console.error(err);
            alert('Failed to delete category.');
        }
    };

    const openAddSub = (cat) => {
        setParentCategoryId(cat.id);
        setEditingSubId(null);
        setSubName('');
        setSubImageFile(null);
        setSubImagePreview(null);
        setShowSubForm(true);
    };

    const openEditSub = (cat, sub) => {
        setParentCategoryId(cat.id);
        setEditingSubId(sub.id);
        setSubName(sub.name || '');
        setSubImagePreview(sub.imageUrl || null);
        setSubImageFile(null);
        setShowSubForm(true);
    };

    const handleSubImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSubImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setSubImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const saveSubcategory = async () => {
        if (!subName.trim() || !parentCategoryId) return;
        setSaving(true);
        try {
            const parent = categories.find(c => c.id === parentCategoryId);
            const subs = parent?.subcategories || [];
            let imageUrl = subImagePreview && !subImageFile ? subImagePreview : null;
            if (subImageFile) {
                imageUrl = await uploadImage(subImageFile, 'categories/subcategories');
            }
            if (editingSubId) {
                const newSubs = subs.map(s => s.id === editingSubId ? { ...s, name: subName.trim(), imageUrl } : s);
                await updateDoc(doc(db, 'categories', parentCategoryId), { subcategories: newSubs, updatedAt: serverTimestamp() });
            } else {
                const newSub = { id: Date.now().toString(), name: subName.trim(), imageUrl };
                await updateDoc(doc(db, 'categories', parentCategoryId), {
                    subcategories: [...subs, newSub],
                    updatedAt: serverTimestamp()
                });
            }
            setShowSubForm(false);
        } catch (err) {
            console.error(err);
            alert('Failed to save subcategory.');
        } finally {
            setSaving(false);
        }
    };

    const deleteSubcategory = async (catId, subId) => {
        if (!window.confirm('Delete this subcategory?')) return;
        try {
            const parent = categories.find(c => c.id === catId);
            const newSubs = (parent?.subcategories || []).filter(s => s.id !== subId);
            await updateDoc(doc(db, 'categories', catId), { subcategories: newSubs, updatedAt: serverTimestamp() });
        } catch (err) {
            console.error(err);
            alert('Failed to delete subcategory.');
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
                            <span className="cursor-pointer" onClick={() => navigate('/dashboard')}>Dashboard</span>
                            <span className="separator"> &gt; </span>
                            <span className="active">Categories</span>
                        </div>
                        <div className="page-title-row">
                            <h1 className="text-2xl font-bold">Categories & Subcategories</h1>
                            <button type="button" className="btn-primary" onClick={openAddCategory}>
                                <Plus size={18} /> Add Category
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="categories-loading">
                            <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)' }} />
                        </div>
                    ) : (
                        <>
                        <div className="categories-grid">
                            {paginatedCategories.map((cat) => (
                                <div key={cat.id} className="category-card">
                                    <div className="category-card-header">
                                        <div className="category-image-wrap">
                                            {cat.imageUrl ? (
                                                <img src={cat.imageUrl} alt={cat.name} />
                                            ) : (
                                                <div className="category-image-placeholder">
                                                    <Camera size={28} />
                                                    <span>No image</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="category-info">
                                            <h3 className="category-name">{cat.name}</h3>
                                            <div className="category-actions">
                                                <button type="button" className="btn-icon" onClick={() => openEditCategory(cat)} title="Edit category">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button type="button" className="btn-icon danger" onClick={() => deleteCategory(cat.id)} title="Delete category">
                                                    <Trash2 size={16} />
                                                </button>
                                                <button type="button" className="btn-icon primary" onClick={() => openAddSub(cat)} title="Add subcategory">
                                                    <Plus size={16} /> Sub
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="subcategories-list">
                                        <span className="subcategories-label">Subcategories</span>
                                        {(cat.subcategories || []).length === 0 ? (
                                            <p className="no-subs">No subcategories. Click &quot;Sub&quot; to add.</p>
                                        ) : (
                                            <ul>
                                                {(cat.subcategories || []).map((sub) => (
                                                    <li key={sub.id} className="subcategory-item">
                                                        {sub.imageUrl ? (
                                                            <img src={sub.imageUrl} alt={sub.name} className="sub-thumb" />
                                                        ) : (
                                                            <div className="sub-thumb placeholder"><Layers size={16} /></div>
                                                        )}
                                                        <span>{sub.name}</span>
                                                        <div className="sub-actions">
                                                            <button type="button" className="btn-icon small" onClick={() => openEditSub(cat, sub)}><Edit2 size={14} /></button>
                                                            <button type="button" className="btn-icon small danger" onClick={() => deleteSubcategory(cat.id, sub.id)}><Trash2 size={14} /></button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {categories.length === 0 && (
                                <div className="categories-empty">
                                    <Layers size={48} className="text-gray-400" />
                                    <p>No categories yet. Click &quot;Add Category&quot; to create one.</p>
                                </div>
                            )}
                        </div>
                        <PaginationBar
                            totalCount={categories.length}
                            pageStart={pageStart}
                            pageEnd={pageEnd}
                            currentPage={currentPage}
                            totalPages={totalPages}
                            setCurrentPage={setCurrentPage}
                        />
                        </>
                    )}
                </div>
            </div>

            {/* Category Add/Edit Modal */}
            {showCategoryForm && (
                <div className="modal-overlay categories-modal-overlay" onClick={() => setShowCategoryForm(false)}>
                    <div className="modal-content categories-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingCategoryId ? 'Edit Category' : 'Add Category'}</h3>
                            <button type="button" onClick={() => setShowCategoryForm(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Category image</label>
                                <div className="image-upload-box" onClick={() => categoryImageInputRef.current?.click()}>
                                    <input ref={categoryImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCategoryImageChange} />
                                    {categoryImagePreview ? (
                                        <img src={categoryImagePreview} alt="Preview" />
                                    ) : (
                                        <><Camera size={32} /><span>Click to upload</span></>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Category name</label>
                                <input type="text" value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="e.g. Sunglasses" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowCategoryForm(false)}>Cancel</button>
                                <button type="button" className="btn-primary" onClick={saveCategory} disabled={saving}>
                                    {saving ? <><Loader2 className="animate-spin" size={18} /> Saving...</> : (editingCategoryId ? 'Update' : 'Add')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Subcategory Add/Edit Modal */}
            {showSubForm && (
                <div className="modal-overlay categories-modal-overlay" onClick={() => setShowSubForm(false)}>
                    <div className="modal-content categories-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingSubId ? 'Edit Subcategory' : 'Add Subcategory'}</h3>
                            <button type="button" onClick={() => setShowSubForm(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Subcategory image</label>
                                <div className="image-upload-box" onClick={() => subImageInputRef.current?.click()}>
                                    <input ref={subImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleSubImageChange} />
                                    {subImagePreview ? (
                                        <img src={subImagePreview} alt="Preview" />
                                    ) : (
                                        <><Camera size={32} /><span>Click to upload</span></>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Subcategory name</label>
                                <input type="text" value={subName} onChange={e => setSubName(e.target.value)} placeholder="e.g. Aviator" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowSubForm(false)}>Cancel</button>
                                <button type="button" className="btn-primary" onClick={saveSubcategory} disabled={saving || !subName.trim()}>
                                    {saving ? <><Loader2 className="animate-spin" size={18} /> Saving...</> : (editingSubId ? 'Update' : 'Add')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Categories;
