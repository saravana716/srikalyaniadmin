import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ActionMenu from '../components/ActionMenu';
import Button from '../components/Button';
import { FiSearch, FiSettings, FiBell, FiMenu, FiX } from 'react-icons/fi';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import {
  subscribeProducts,
  addProduct as addProductToDb,
  updateProduct as updateProductInDb,
  deleteProduct as deleteProductFromDb,
} from '../services/productsService';
import { validateImageFile } from '../utils/uploadImage';

const MAROON = '#801A39';
const LIGHT_GRAY = '#F0F0F0';
const BORDER_GRAY = '#e0e0e0';

const ProductImageUpload = ({
  slotKey,
  label,
  required,
  existingUrl,
  file,
  preview,
  cleared,
  onFileChange,
  onClear,
}) => {
  const displaySrc = preview || (!cleared && existingUrl) || null;
  const inputId = `product-${slotKey}-input`;

  return (
    <div style={styles.imageSlot}>
      <label htmlFor={inputId} style={styles.imageSlotLabel}>
        {label} {required ? <span style={styles.requiredMark}>*</span> : <span style={styles.optionalMark}>(optional)</span>}
      </label>
      <div style={styles.imagePreviewBox}>
        {displaySrc ? (
          <img src={displaySrc} alt={label} style={styles.imagePreview} />
        ) : (
          <span style={styles.imagePlaceholder}>No image</span>
        )}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        style={styles.hiddenFileInput}
        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
      />
      <div style={styles.imageActions}>
        <label htmlFor={inputId} style={styles.imageChooseBtn}>
          {displaySrc ? 'Change' : 'Upload'}
        </label>
        {displaySrc && (
          <button type="button" style={styles.imageRemoveBtn} onClick={onClear}>
            Remove
          </button>
        )}
      </div>
      {file && <span style={styles.fileName}>{file.name}</span>}
    </div>
  );
};

const AddEditProductModal = ({ product, onClose, onSave, error, saving }) => {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? 'Gold');
  const [price, setPrice] = useState(product?.price ?? '');
  const [weight, setWeight] = useState(product?.weight ?? '');
  const [purity, setPurity] = useState(product?.purity ?? '');
  const [status, setStatus] = useState(product?.status ?? 'Active');
  const [description, setDescription] = useState(product?.description ?? '');
  const [imageError, setImageError] = useState('');

  const [image1File, setImage1File] = useState(null);
  const [image2File, setImage2File] = useState(null);
  const [image3File, setImage3File] = useState(null);
  const [image1Preview, setImage1Preview] = useState(null);
  const [image2Preview, setImage2Preview] = useState(null);
  const [image3Preview, setImage3Preview] = useState(null);
  const [clearImage2, setClearImage2] = useState(false);
  const [clearImage3, setClearImage3] = useState(false);
  const [clearImage1, setClearImage1] = useState(false);

  const setPreview = (setter, prev, file) => {
    if (prev) URL.revokeObjectURL(prev);
    setter(file ? URL.createObjectURL(file) : null);
  };

  const handleImageChange = (slot, file) => {
    const validationError = file ? validateImageFile(file) : null;
    if (validationError) {
      setImageError(validationError);
      return;
    }
    setImageError('');

    if (slot === 'image1') {
      setImage1File(file);
      setPreview(setImage1Preview, image1Preview, file);
      if (file) setClearImage1(false);
    } else if (slot === 'image2') {
      setImage2File(file);
      setPreview(setImage2Preview, image2Preview, file);
      if (file) setClearImage2(false);
    } else if (slot === 'image3') {
      setImage3File(file);
      setPreview(setImage3Preview, image3Preview, file);
      if (file) setClearImage3(false);
    }
  };

  const handleImageClear = (slot) => {
    if (slot === 'image1') {
      setImage1File(null);
      setPreview(setImage1Preview, image1Preview, null);
      setClearImage1(true);
    } else if (slot === 'image2') {
      setImage2File(null);
      setPreview(setImage2Preview, image2Preview, null);
      setClearImage2(true);
    } else if (slot === 'image3') {
      setImage3File(null);
      setPreview(setImage3Preview, image3Preview, null);
      setClearImage3(true);
    }
  };

  const hasImage1 = image1File || (!clearImage1 && product?.image1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!hasImage1) {
      setImageError('Primary image (Image 1) is required.');
      return;
    }

    setImageError('');
    await onSave({
      name,
      category,
      price,
      weight,
      purity,
      status,
      description,
      image1: clearImage1 ? '' : (product?.image1 || ''),
      image2: clearImage2 ? '' : (product?.image2 || ''),
      image3: clearImage3 ? '' : (product?.image3 || ''),
      image1File,
      image2File,
      image3File,
      clearImage2,
      clearImage3,
    }, product?.id);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Edit Product' : 'Add Product'}</h2>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && !imageError && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>}
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Product Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={styles.formInput} required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.formSelect}>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Diamond">Diamond</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Price</label>
            <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} style={styles.formInput} placeholder="e.g. ₹25,000" required />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Weight</label>
            <input type="text" value={weight} onChange={(e) => setWeight(e.target.value)} style={styles.formInput} placeholder="e.g. 10g" />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Purity</label>
            <input type="text" value={purity} onChange={(e) => setPurity(e.target.value)} style={styles.formInput} placeholder="e.g. 22K" />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.formSelect}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...styles.formInput, minHeight: 80 }} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Product Images</label>
            <p style={styles.imageHint}>Image 1 is required. Image 2 and Image 3 are optional.</p>
            {(imageError || error) && (
              <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{imageError || error}</p>
            )}
            <div style={styles.imageGrid}>
              <ProductImageUpload
                slotKey="image1"
                label="Image 1"
                required
                existingUrl={product?.image1}
                file={image1File}
                preview={image1Preview}
                cleared={clearImage1}
                onFileChange={(file) => handleImageChange('image1', file)}
                onClear={() => handleImageClear('image1')}
              />
              <ProductImageUpload
                slotKey="image2"
                label="Image 2"
                existingUrl={product?.image2}
                file={image2File}
                preview={image2Preview}
                cleared={clearImage2}
                onFileChange={(file) => handleImageChange('image2', file)}
                onClear={() => handleImageClear('image2')}
              />
              <ProductImageUpload
                slotKey="image3"
                label="Image 3"
                existingUrl={product?.image3}
                file={image3File}
                preview={image3Preview}
                cleared={clearImage3}
                onFileChange={(file) => handleImageChange('image3', file)}
                onClear={() => handleImageClear('image3')}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} style={styles.modalBtnCancel}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText={isEdit ? 'Uploading & updating…' : 'Uploading & adding…'} style={styles.modalBtnPrimary}>
              {isEdit ? 'Update' : 'Add Product'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Products = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionAnchorEl, setActionAnchorEl] = useState(null);

  useEffect(() => {
    const unsub = subscribeProducts((data) => {
      setList(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = list.filter((row) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return [row.name, row.category, row.price, row.purity].some((v) => String(v || '').toLowerCase().includes(q));
  });

  const handleSave = async (data, id) => {
    setSaveError(null);
    setSaving(true);
    try {
      if (id) await updateProductInDb(id, data);
      else await addProductToDb(data);
      setShowAddModal(false);
      setEditingRow(null);
    } catch (e) {
      setSaveError(e?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!row?.id || !window.confirm('Delete this product?')) return;
    setDeleting(true);
    try {
      await deleteProductFromDb(row.id);
      setOpenActionId(null);
    } catch (e) {
      console.error('Delete product failed', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={styles.container} className="dashboard-container">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

      {showAddModal && (
        <AddEditProductModal onClose={() => { if (!saving) { setShowAddModal(false); setSaveError(null); } }} onSave={handleSave} error={saveError} saving={saving} />
      )}
      {editingRow && (
        <AddEditProductModal product={editingRow} onClose={() => { if (!saving) { setEditingRow(null); setSaveError(null); } }} onSave={handleSave} error={saveError} saving={saving} />
      )}

      <main style={styles.main} className="dashboard-main">
        <header style={styles.header} className="dashboard-header">
          <div style={styles.headerRow}>
            <button style={styles.hamburger} className="mobile-hamburger" onClick={() => setIsSidebarOpen(true)}>
              <FiMenu size={24} color={MAROON} />
            </button>
            <h1 style={styles.pageTitle}>Products</h1>
          </div>
          <div style={styles.headerActions} className="dashboard-header-actions">
            <button type="button" style={styles.addBtn} onClick={() => setShowAddModal(true)}>+ Add Product</button>
            <div style={styles.searchContainer} className="search-container">
              <FiSearch style={styles.searchIcon} />
              <input type="text" placeholder="Search products..." style={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </header>

        <ActionMenu
          isOpen={!!openActionId}
          onClose={() => { setOpenActionId(null); setActionAnchorEl(null); }}
          anchorEl={actionAnchorEl}
          busy={deleting}
          onView={() => { const row = list.find((r) => r.id === openActionId); if (row) setEditingRow(row); }}
          onEdit={() => { const row = list.find((r) => r.id === openActionId); if (row) setEditingRow(row); }}
          onDelete={() => { const row = list.find((r) => r.id === openActionId); if (row) return handleDelete(row); }}
        />

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Image</th>
                <th style={styles.th}><span className="th-content">Name <MdKeyboardArrowUp size={14} /><MdKeyboardArrowDown size={14} /></span></th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Price</th>
                <th style={styles.th}>Weight</th>
                <th style={styles.th}>Purity</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} style={styles.tr}>
                  <td style={styles.td}>
                    {row.image1 ? (
                      <img src={row.image1} alt={row.name} style={styles.tableThumb} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={styles.td}>{row.name}</td>
                  <td style={styles.td}>{row.category}</td>
                  <td style={styles.td}>{row.price}</td>
                  <td style={styles.td}>{row.weight || '—'}</td>
                  <td style={styles.td}>{row.purity || '—'}</td>
                  <td style={styles.td}>
                    <span style={row.status === 'Active' ? styles.badgeActive : styles.badgeInactive}>{row.status}</span>
                  </td>
                  <td style={styles.tdAction}>
                    <button
                      type="button"
                      style={styles.actionMenuTrigger}
                      onClick={(e) => {
                        setOpenActionId(openActionId === row.id ? null : row.id);
                        setActionAnchorEl(openActionId === row.id ? null : e.currentTarget);
                      }}
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <p style={{ color: '#666' }}>Loading products…</p>}
        {!loading && filtered.length === 0 && <p style={{ color: '#666' }}>No products found. Add your first product.</p>}
      </main>
    </div>
  );
};

const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#fff' },
  main: { marginLeft: '260px', flex: 1, padding: '24px 40px', backgroundColor: '#fff', maxWidth: '100vw', transition: 'margin-left 0.3s ease' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px', flexWrap: 'wrap' },
  headerRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  pageTitle: { fontSize: '28px', color: MAROON, fontWeight: '700' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  searchContainer: { position: 'relative', backgroundColor: LIGHT_GRAY, borderRadius: '24px', padding: '10px 16px', display: 'flex', alignItems: 'center', width: '300px' },
  searchIcon: { color: '#999', marginRight: '8px', fontSize: '18px' },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '100%', color: '#333' },
  addBtn: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' },
  formInput: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${BORDER_GRAY}`, fontSize: '14px', backgroundColor: '#fff' },
  tableWrap: { overflowX: 'auto', border: `1px solid ${BORDER_GRAY}`, borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '700px' },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#333', backgroundColor: '#fafafa', borderBottom: `1px solid ${BORDER_GRAY}` },
  tr: { borderBottom: `1px solid ${BORDER_GRAY}` },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  tdAction: { padding: '14px 16px' },
  badgeActive: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#16a34a', color: '#fff', fontSize: '13px' },
  badgeInactive: { display: 'inline-block', padding: '4px 12px', borderRadius: '6px', backgroundColor: '#dc2626', color: '#fff', fontSize: '13px' },
  actionMenuTrigger: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#666' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' },
  modalBox: { backgroundColor: '#fff', borderRadius: '12px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER_GRAY}` },
  modalTitle: { fontSize: '20px', fontWeight: '700', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', color: '#666' },
  modalBtnCancel: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #9ca3af', backgroundColor: '#fff', cursor: 'pointer' },
  modalBtnPrimary: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: MAROON, color: '#fff', cursor: 'pointer' },
  imageHint: { fontSize: '13px', color: '#6b7280', margin: '0 0 12px' },
  imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' },
  imageSlot: { display: 'flex', flexDirection: 'column', gap: '8px' },
  imageSlotLabel: { fontSize: '13px', fontWeight: '600', color: '#374151' },
  requiredMark: { color: '#dc2626' },
  optionalMark: { color: '#9ca3af', fontWeight: '400', fontSize: '12px' },
  imagePreviewBox: {
    width: '100%',
    height: '120px',
    borderRadius: '8px',
    border: `1px dashed ${BORDER_GRAY}`,
    backgroundColor: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%', objectFit: 'cover' },
  imagePlaceholder: { fontSize: '13px', color: '#9ca3af' },
  hiddenFileInput: { display: 'none' },
  imageActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  imageChooseBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: MAROON,
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
  },
  imageRemoveBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: `1px solid ${BORDER_GRAY}`,
    backgroundColor: '#fff',
    color: '#374151',
    fontSize: '13px',
    cursor: 'pointer',
  },
  fileName: { fontSize: '11px', color: '#6b7280', wordBreak: 'break-all' },
  tableThumb: { width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: `1px solid ${BORDER_GRAY}` },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 0 },
};

export default Products;
