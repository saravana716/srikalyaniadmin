import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Filter, Download, Plus, Eye, Edit2, Trash2, ArrowUpDown, Glasses, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { db } from '../firebase';
import { collection, onSnapshot, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';
import { runDefaultProductStockMigration } from '../utils/productStockMigration';
import '../assets/styles/Dashboard.css';
import '../assets/styles/Table.css';
import '../assets/styles/Products.css';
import './Orders.css';
import {
    CONTACT_LENS_FRAME_TYPE,
    isContactLensesCategory,
    isSolutionSubcategory,
    isColorLensesSubcategory,
    hasContactLensDetails,
    getContactLensTableHint,
    getContactLensSearchText,
    formatContactLensTypeLabel,
    formatReplacementScheduleLabel,
    formatPackSizeLabel,
} from '../config/contactLens';
import PaginationBar from '../components/PaginationBar';
import { usePagination, DEFAULT_PAGE_SIZE } from '../hooks/usePagination';

/** Maps product `status` to a filter id (Add/Edit Product options + unset + other). */
function getProductStatusFilterId(product) {
    const s = (product?.status || '').trim();
    if (!s) return 'unset';
    if (s === 'In Stock') return 'in_stock';
    if (s === 'Out of Stock') return 'out_of_stock';
    if (s === 'Discontinued') return 'discontinued';
    return 'other';
}

const PRODUCT_STATUS_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'in_stock', label: 'In Stock' },
    { id: 'out_of_stock', label: 'Out of Stock' },
    { id: 'discontinued', label: 'Discontinued' },
    { id: 'unset', label: 'Not set' },
    { id: 'other', label: 'Other' },
];

const Products = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('All');
    const [statusFilter, setStatusFilter] = useState('all');
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [imageErrors, setImageErrors] = useState({});
    const [viewProduct, setViewProduct] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const headerCheckboxRef = useRef(null);
    const navigate = useNavigate();

    // Tabs: "All" + categories from Firestore (same as Add Product → Manage Categories)
    const tabs = ['All', ...categories.map(c => c.name)];

    useEffect(() => {
        runDefaultProductStockMigration();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const prodList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(prodList);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'categories'), (snapshot) => {
            setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubscribe();
    }, []);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;
        try {
            await deleteDoc(doc(db, 'products', id));
            setSelectedIds((prev) => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (error) {
            console.error("Error deleting product:", error);
            alert("Failed to delete product");
        }
    };

    const productStatusCounts = useMemo(() => {
        const c = {
            all: products.length,
            in_stock: 0,
            out_of_stock: 0,
            discontinued: 0,
            unset: 0,
            other: 0,
        };
        products.forEach((p) => {
            c[getProductStatusFilterId(p)] += 1;
        });
        return c;
    }, [products]);

    const filteredProducts = useMemo(
        () =>
            products.filter((product) => {
                const matchesTab = activeTab === 'All' || product.category === activeTab;
                const q = searchTerm.trim().toLowerCase();
                const matchesSearch =
                    !q ||
                    (product.name || '').toLowerCase().includes(q) ||
                    (product.category || '').toLowerCase().includes(q) ||
                    (product.brand || '').toLowerCase().includes(q) ||
                    getContactLensSearchText(product).includes(q);
                if (!matchesTab || !matchesSearch) return false;
                if (statusFilter === 'all') return true;
                return getProductStatusFilterId(product) === statusFilter;
            }),
        [products, activeTab, searchTerm, statusFilter]
    );

    const paginationKey = `${activeTab}|${searchTerm}|${statusFilter}`;
    const {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedItems: paginatedProducts,
        pageStart,
        pageEnd,
    } = usePagination(filteredProducts, DEFAULT_PAGE_SIZE, paginationKey);

    const toggleRowSelected = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allFilteredSelected =
        filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));

    useEffect(() => {
        const el = headerCheckboxRef.current;
        if (!el) return;
        const someFiltered = filteredProducts.some((p) => selectedIds.has(p.id));
        el.indeterminate = someFiltered && !allFilteredSelected;
    }, [filteredProducts, selectedIds, allFilteredSelected]);

    useEffect(() => {
        const allowed = new Set(filteredProducts.map((p) => p.id));
        setSelectedIds((prev) => {
            const next = new Set([...prev].filter((id) => allowed.has(id)));
            if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
            return next;
        });
    }, [filteredProducts]);

    const toggleSelectAllFiltered = () => {
        setSelectedIds((prev) => {
            const everyFilteredSelected =
                filteredProducts.length > 0 &&
                filteredProducts.every((p) => prev.has(p.id));
            if (everyFilteredSelected) {
                const next = new Set(prev);
                filteredProducts.forEach((p) => next.delete(p.id));
                return next;
            }
            const next = new Set(prev);
            filteredProducts.forEach((p) => next.add(p.id));
            return next;
        });
    };

    const handleBulkDelete = async () => {
        const ids = [...selectedIds];
        if (ids.length === 0) return;
        const msg =
            ids.length === 1
                ? 'Are you sure you want to delete this product?'
                : `Are you sure you want to delete ${ids.length} products? This cannot be undone.`;
        if (!window.confirm(msg)) return;
        try {
            const chunkSize = 400;
            for (let i = 0; i < ids.length; i += chunkSize) {
                const batch = writeBatch(db);
                ids.slice(i, i + chunkSize).forEach((id) => {
                    batch.delete(doc(db, 'products', id));
                });
                await batch.commit();
            }
            setSelectedIds(new Set());
        } catch (error) {
            console.error('Error deleting products:', error);
            alert('Failed to delete one or more products');
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

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
                            <span className="active">Product</span>
                        </div>
                        <div className="page-title-row">
                            <h1 className="text-2xl font-bold">Product</h1>
                        </div>
                    </div>

                    <div className="controls-row">
                        <div className="search-box">
                            <Search className="search-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Search by product name"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="action-buttons">
                            <button className="btn-secondary"><Filter size={18} /> Filter</button>
                            <button className="btn-secondary"><Download size={18} /> Export</button>
                            <button className="btn-primary" onClick={() => navigate('/add-product')}>
                                <Plus size={18} /> New Product
                            </button>
                        </div>
                    </div>

                    <div className="tabs-container">
                        {tabs.map((tab) => (
                            <div
                                key={tab}
                                className={`tab-item ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                            </div>
                        ))}
                    </div>

                    <div className="orders-filter-row" role="tablist" aria-label="Filter by product status">
                        {PRODUCT_STATUS_FILTERS.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                role="tab"
                                aria-selected={statusFilter === f.id}
                                className={`orders-filter-pill ${statusFilter === f.id ? 'active' : ''}`}
                                onClick={() => setStatusFilter(f.id)}
                            >
                                {f.label}
                                <span className="orders-filter-count">
                                    {f.id === 'all' ? productStatusCounts.all : productStatusCounts[f.id] ?? 0}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="table-card">
                        {!loading && selectedIds.size > 0 && (
                            <div className="products-bulk-bar products-bulk-bar--top" role="toolbar" aria-label="Bulk actions">
                                <span className="products-bulk-bar-count">
                                    {selectedIds.size} selected
                                </span>
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
                        <div className="data-table-container">
                            {loading ? (
                                <div className="flex items-center justify-center p-20">
                                    <Loader2 className="animate-spin text-blue" size={40} />
                                </div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>
                                                <input
                                                    ref={headerCheckboxRef}
                                                    type="checkbox"
                                                    checked={allFilteredSelected}
                                                    onChange={toggleSelectAllFiltered}
                                                    disabled={filteredProducts.length === 0}
                                                    aria-label="Select all products in this list"
                                                />
                                            </th>
                                            <th>
                                                <div className="th-content">
                                                    Product <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th>
                                                <div className="th-content">
                                                    Category <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th>
                                                <div className="th-content">
                                                    Price <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th>
                                                <div className="th-content">
                                                    Stock <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th>
                                                <div className="th-content">
                                                    Status <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th style={{ textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedProducts.map((product) => (
                                            <tr key={product.id}>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(product.id)}
                                                        onChange={() => toggleRowSelected(product.id)}
                                                        aria-label={`Select ${product.name || 'product'}`}
                                                    />
                                                </td>
                                                <td>
                                                    <div className="product-cell">
                                                        <div className="product-img">
                                                            {product.photos?.[0] && !imageErrors[product.id] ? (
                                                                <img
                                                                    src={product.photos[0]}
                                                                    alt={product.name}
                                                                    onError={() => setImageErrors(prev => ({ ...prev, [product.id]: true }))}
                                                                />
                                                            ) : (
                                                                <Glasses size={20} className="text-gray-400" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold">{product.name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="font-medium">{product.category || '—'}</div>
                                                    {getContactLensTableHint(product) ? (
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {getContactLensTableHint(product)}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td>₹ {product.price}</td>
                                                <td className="font-medium">{product.stock != null && product.stock !== '' ? product.stock : 100}</td>
                                                <td>
                                                    <span className={`badge ${product.status === 'In Stock' ? 'badge-paid' : 'badge-unpaid'}`}>
                                                        {product.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setViewProduct(product); }}
                                                            className="action-btn"
                                                            title="View product"
                                                            aria-label="View product"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/edit-product/${product.id}`); }}
                                                            className="action-btn"
                                                            title="Edit product"
                                                            aria-label="Edit product"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                                                            className="action-btn delete"
                                                            title="Delete product"
                                                            aria-label="Delete product"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredProducts.length === 0 && (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                                    No products found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {!loading && (
                            <PaginationBar
                                totalCount={filteredProducts.length}
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

            {/* Product view modal */}
            {viewProduct && (
                <div
                    className="product-view-modal-overlay"
                    onClick={() => { setViewProduct(null); setLightboxImage(null); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Escape' && setViewProduct(null)}
                    aria-label="Close"
                >
                    <div
                        className="product-view-modal"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="product-view-title"
                    >
                        <div className="product-view-modal-header">
                            <h2 id="product-view-title" className="product-view-modal-title">Product Details</h2>
                            <button
                                type="button"
                                onClick={() => setViewProduct(null)}
                                className="product-view-close-btn"
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="product-view-modal-body">
                            <div className="product-view-layout">
                                <div className="product-view-left">
                                    <div className="product-view-gallery">
                                        {viewProduct.photos?.length ? (
                                            viewProduct.photos.map((url, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    className="product-view-gallery-thumb"
                                                    onClick={() => setLightboxImage(url)}
                                                    aria-label={`View image ${i + 1}`}
                                                >
                                                    <img src={url} alt={`${viewProduct.name} ${i + 1}`} />
                                                </button>
                                            ))
                                        ) : (
                                            <div className="product-view-gallery-placeholder">
                                                <Glasses size={40} className="text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="product-view-section">
                                        <h3 className="product-view-section-title">Overview</h3>
                                        <div className="product-view-name">{viewProduct.name || 'Not provided'}</div>
                                        <div className="product-view-price">₹ {viewProduct.price ?? 'Not provided'}</div>
                                        <div className={`product-view-offer-price ${!viewProduct.offerPrice ? 'muted' : ''}`}>
                                            Offer Price: ₹ {viewProduct.offerPrice ?? 'Not provided'}
                                        </div>
                                        <div className="product-view-meta">
                                            <span className="product-view-badge">{viewProduct.category || 'Not provided'}</span>
                                            {viewProduct.contactLensSubcategory ? (
                                                <span className="product-view-badge">{viewProduct.contactLensSubcategory}</span>
                                            ) : null}
                                            <span className={`product-view-badge product-view-badge-status ${viewProduct.status === 'In Stock' ? 'in-stock' : ''}`}>
                                                {viewProduct.status || 'Not provided'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="product-view-right">
                                    <div className="product-view-section">
                                        <h3 className="product-view-section-title">Product information</h3>
                                        <dl className="product-view-dl">
                                            <dt>Size</dt><dd>{viewProduct.size || 'Not provided'}</dd>
                                            <dt>Color</dt><dd>{viewProduct.color || 'Not provided'}</dd>
                                            <dt>Stock</dt><dd>{viewProduct.stock != null && viewProduct.stock !== '' ? `${viewProduct.stock} PCS` : '100 PCS'}</dd>
                                        </dl>
                                    </div>
                                    <div className="product-view-section">
                                        <h3 className="product-view-section-title">Technical</h3>
                                        <dl className="product-view-dl">
                                            <dt>Brand</dt><dd>{viewProduct.brand || 'Not provided'}</dd>
                                            <dt>Model</dt><dd>{viewProduct.model || 'Not provided'}</dd>
                                            <dt>Frame Type</dt><dd>{viewProduct.frameType || 'Not provided'}</dd>
                                            <dt>Frame Shape</dt><dd>{viewProduct.frameShape || 'Not provided'}</dd>
                                            <dt>Frame Material</dt><dd>{viewProduct.frameMaterial || 'Not provided'}</dd>
                                            <dt>Gender</dt><dd>{viewProduct.gender || 'Not provided'}</dd>
                                            <dt>Product Features</dt><dd>{viewProduct.feature || 'Not provided'}</dd>
                                        </dl>
                                    </div>
                                    {(isContactLensesCategory(viewProduct.category) ||
                                        viewProduct.frameType === CONTACT_LENS_FRAME_TYPE ||
                                        hasContactLensDetails(viewProduct)) && (
                                        <div className="product-view-section">
                                            <h3 className="product-view-section-title">Contact lens details</h3>
                                            <dl className="product-view-dl">
                                                <dt>Subcategory</dt>
                                                <dd>{viewProduct.contactLensSubcategory || 'Not provided'}</dd>
                                                {isColorLensesSubcategory(viewProduct.contactLensSubcategory) ||
                                                viewProduct.contactLensType ||
                                                viewProduct.contactLensReplacementSchedule ||
                                                (viewProduct.contactLensPackSize != null &&
                                                    viewProduct.contactLensPackSize !== '') ? (
                                                    <>
                                                        <dt>Lens type</dt>
                                                        <dd>
                                                            {formatContactLensTypeLabel(viewProduct.contactLensType) ||
                                                                'Not provided'}
                                                        </dd>
                                                        <dt>Replacement schedule</dt>
                                                        <dd>
                                                            {formatReplacementScheduleLabel(
                                                                viewProduct.contactLensReplacementSchedule
                                                            ) || 'Not provided'}
                                                        </dd>
                                                        <dt>Pack size</dt>
                                                        <dd>
                                                            {formatPackSizeLabel(viewProduct.contactLensPackSize) ||
                                                                'Not provided'}
                                                        </dd>
                                                    </>
                                                ) : null}
                                            </dl>
                                            {(isSolutionSubcategory(viewProduct.contactLensSubcategory) ||
                                                viewProduct.contactLensVariants?.length > 0) && (
                                                <>
                                                    <h4 className="product-view-subsection-title">Volume &amp; price</h4>
                                                    {viewProduct.contactLensVariants?.length > 0 ? (
                                                        <dl className="product-view-dl">
                                                            {viewProduct.contactLensVariants.map((v, i) => (
                                                                <React.Fragment key={i}>
                                                                    <dt>
                                                                        {v.volumeMl != null ? `${v.volumeMl} ml` : 'Volume'}
                                                                    </dt>
                                                                    <dd>
                                                                        {v.price != null && v.price !== ''
                                                                            ? `₹ ${v.price}`
                                                                            : 'Not provided'}
                                                                    </dd>
                                                                </React.Fragment>
                                                            ))}
                                                        </dl>
                                                    ) : (
                                                        <p className="product-view-empty-note">No volume options saved.</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {viewProduct.lensEnhancements?.length > 0 && (
                                        <div className="product-view-section">
                                            <h3 className="product-view-section-title">Lens Enhancements</h3>
                                            <dl className="product-view-dl">
                                                {viewProduct.lensEnhancements.map((item, i) => (
                                                    <React.Fragment key={i}>
                                                        <dt>{item.name}</dt>
                                                        <dd>₹ {item.price}</dd>
                                                    </React.Fragment>
                                                ))}
                                            </dl>
                                        </div>
                                    )}
                                    <div className="product-view-section">
                                        <h3 className="product-view-section-title">Media</h3>
                                        <dl className="product-view-dl">
                                            <dt>Photos</dt><dd>{viewProduct.photos?.length ? `${viewProduct.photos.length} image(s)` : 'Not provided'}</dd>
                                            <dt>Video</dt><dd>{viewProduct.videoUrl ? 'Yes' : 'Not provided'}</dd>
                                            <dt>360 View</dt><dd>{viewProduct.view360Url ? 'Yes' : 'Not provided'}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Image lightbox — click gallery image to view full size */}
            {lightboxImage && (
                <div
                    className="product-image-lightbox-overlay"
                    onClick={() => setLightboxImage(null)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Escape' && setLightboxImage(null)}
                    aria-label="Close image"
                >
                    <button
                        type="button"
                        className="product-image-lightbox-close"
                        onClick={() => setLightboxImage(null)}
                        aria-label="Close"
                    >
                        <X size={28} />
                    </button>
                    <div className="product-image-lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <img src={lightboxImage} alt="Product full size" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;
