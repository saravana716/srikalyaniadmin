import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Download, Plus, ArrowUpDown, Package, Edit2, Loader2, X, AlertTriangle } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { runDefaultProductStockMigration } from '../utils/productStockMigration';
import { getContactLensTableHint } from '../config/contactLens';
import '../assets/styles/Dashboard.css';
import '../assets/styles/Table.css';
import PaginationBar from '../components/PaginationBar';
import { usePagination, DEFAULT_PAGE_SIZE } from '../hooks/usePagination';

function createdAtMs(v) {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v === 'number') return v;
    if (v.seconds != null) return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
    return 0;
}

/** Firestore missing/invalid stock → treat as default 100 (matches product defaults). Explicit 0 stays 0. */
function resolveProductStock(product) {
    const raw = product?.stock;
    if (raw === null || raw === undefined || raw === '') return 100;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(n) || n < 0) return 100;
    return n;
}

const Inventory = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProduct, setEditingProduct] = useState(null);
    const [newStock, setNewStock] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const navigate = useNavigate();

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    useEffect(() => {
        runDefaultProductStockMigration();
    }, []);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt));
            setProducts(list);
            setLoading(false);
        }, (err) => {
            console.error('Inventory products listener:', err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleUpdateStock = async (e) => {
        e.preventDefault();
        if (!editingProduct) return;

        setIsUpdating(true);
        try {
            const productRef = doc(db, 'products', editingProduct.id);
            const next = parseInt(String(newStock).trim(), 10);
            await updateDoc(productRef, {
                stock: Number.isFinite(next) && next >= 0 ? next : 0
            });
            setEditingProduct(null);
        } catch (error) {
            console.error("Error updating stock:", error);
            alert("Failed to update stock");
        } finally {
            setIsUpdating(false);
        }
    };

    const filteredProducts = useMemo(() => {
        const q = searchTerm.toLowerCase();
        return products.filter((p) => {
            const name = (p.name || '').toLowerCase();
            return name.includes(q) || (p.sku && String(p.sku).toLowerCase().includes(q));
        });
    }, [products, searchTerm]);

    const {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedItems: paginatedInventory,
        pageStart,
        pageEnd,
    } = usePagination(filteredProducts, DEFAULT_PAGE_SIZE, searchTerm);

    const getStockStatus = (stock) => {
        const n = Number(stock);
        if (!Number.isFinite(n) || n <= 0) return { label: 'Out of Stock', color: 'badge-cancelled' };
        if (n <= 10) return { label: 'Low Stock', color: 'badge-unpaid' };
        return { label: 'In Stock', color: 'badge-paid' };
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
                            <span className="active">Inventory</span>
                        </div>
                        <div className="page-title-row">
                            <h1 className="text-2xl font-bold">Inventory</h1>
                        </div>
                    </div>

                    <div className="controls-row">
                        <div className="search-box">
                            <Search className="search-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name or SKU..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="action-buttons">
                            <button className="btn-secondary"><Filter size={18} /> Filter</button>
                            <button className="btn-secondary"><Download size={18} /> Export</button>
                            <button className="btn-primary" onClick={() => navigate('/add-product')}><Plus size={18} /> Add Stock</button>
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
                                            <th>Product Name</th>
                                            <th>SKU</th>
                                            <th>Category</th>
                                            <th>Stock Level</th>
                                            <th>Status</th>
                                            <th style={{ textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedInventory.map((product) => {
                                            const qty = resolveProductStock(product);
                                            const status = getStockStatus(qty);
                                            return (
                                                <tr key={product.id}>
                                                    <td>
                                                        <div className="font-semibold">{product.name}</div>
                                                    </td>
                                                    <td className="text-xs text-secondary">{product.sku || 'N/A'}</td>
                                                    <td>
                                                        <div>{product.category || 'Uncategorized'}</div>
                                                        {getContactLensTableHint(product) ? (
                                                            <div className="text-xs text-secondary" style={{ marginTop: 2 }}>
                                                                {getContactLensTableHint(product)}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="font-medium">{qty} PCS</td>
                                                    <td>
                                                        <span className={`badge ${status.color}`}>
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                                                            <button
                                                                className="action-btn"
                                                                title="Update Stock"
                                                                onClick={() => {
                                                                    setEditingProduct(product);
                                                                    setNewStock(resolveProductStock(product));
                                                                }}
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {filteredProducts.length === 0 && (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                                                    <Package size={40} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                                                    <p className="text-secondary">No products found in inventory</p>
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

            {/* Quick Update Stock Modal */}
            {editingProduct && (
                <div className="modal-overlay" style={{ display: 'flex' }}>
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3 className="text-lg font-bold">Update Stock</h3>
                            <button onClick={() => setEditingProduct(null)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUpdateStock} className="modal-body">
                            <div className="mb-4">
                                <p className="text-sm font-semibold text-secondary mb-1">Product</p>
                                <p className="font-medium">{editingProduct.name}</p>
                                <p className="text-xs text-secondary">SKU: {editingProduct.sku}</p>
                            </div>
                            <div className="form-group">
                                <label>New Stock Level</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={newStock}
                                    onChange={(e) => setNewStock(e.target.value)}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            {newStock <= 10 && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg mt-4 text-xs">
                                    <AlertTriangle size={16} />
                                    <span>Warning: This will set stock to low/out level.</span>
                                </div>
                            )}
                            <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="btn-primary w-full" disabled={isUpdating}>
                                    {isUpdating ? 'Updating...' : 'Update Stock'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
