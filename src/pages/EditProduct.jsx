import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Maximize, ChevronDown, Edit2, Trash2, X, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { db, storage } from '../firebase';
import { collection, getDoc, doc, updateDoc, onSnapshot, serverTimestamp, deleteField } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import '../assets/styles/Dashboard.css';
import '../assets/styles/AddProduct.css';
import ContactLensProductFields from '../components/ContactLensProductFields';
import {
    CONTACT_LENS_FRAME_TYPE,
    isContactLensesCategory,
    applyContactLensProductPayload,
    emptyContactLensRow,
    resetContactLensFormState,
    variantsToRows,
    findSolutionSubcategoryName,
    packSizeToFormState,
} from '../config/contactLens';

const DEFAULT_STOCK = 100;
const PHOTO_SLOT_COUNT = 8;
const PHOTO_INDICES = Array.from({ length: PHOTO_SLOT_COUNT }, (_, i) => i + 1);

const EditProduct = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [categories, setCategories] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [loadingProduct, setLoadingProduct] = useState(true);
    const [formData, setFormData] = useState({
        name: '', size: '', color: '', category: '', price: '', offerPrice: '', stock: String(DEFAULT_STOCK), status: '',
        brand: '', model: '', frameType: '', frameShape: '', frameMaterial: '', gender: '', feature: ''
    });
    const [previews, setPreviews] = useState(() => ({
        ...Object.fromEntries(PHOTO_INDICES.map((n) => [`photo${n}`, null])),
        video: null,
        view360: null,
    }));
    const [files, setFiles] = useState(() => ({
        ...Object.fromEntries(PHOTO_INDICES.map((n) => [`photo${n}`, null])),
        video: null,
        view360: null,
    }));
    const [existingMedia, setExistingMedia] = useState({ photos: [], videoUrl: null, view360Url: null });
    const [contactLensSubcategory, setContactLensSubcategory] = useState('');
    const [contactLensType, setContactLensType] = useState('');
    const [replacementSchedule, setReplacementSchedule] = useState('');
    const [packSize, setPackSize] = useState('');
    const [customPackCount, setCustomPackCount] = useState('');
    const [contactLensRows, setContactLensRows] = useState([emptyContactLensRow()]);

    const fileInputRefs = {
        photo1: useRef(null),
        photo2: useRef(null),
        photo3: useRef(null),
        photo4: useRef(null),
        photo5: useRef(null),
        photo6: useRef(null),
        photo7: useRef(null),
        photo8: useRef(null),
        video: useRef(null),
        view360: useRef(null),
    };

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'categories'), (snapshot) => {
            setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);
    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'products', id));
                if (!snap.exists()) {
                    alert('Product not found.');
                    navigate('/products');
                    return;
                }
                const data = snap.data();
                const rawStock = data.stock;
                const stockVal = rawStock != null && rawStock !== '' && !Number.isNaN(Number(rawStock))
                    ? Number(rawStock)
                    : DEFAULT_STOCK;
                setFormData({
                    name: data.name || '',
                    size: data.size || '',
                    color: data.color || '',
                    category: data.category || '',
                    price: data.price ?? '',
                    offerPrice: data.offerPrice ?? '',
                    stock: String(stockVal),
                    status: data.status || '',
                    brand: data.brand || '',
                    model: data.model || '',
                    frameType: data.frameType || '',
                    frameShape: data.frameShape || '',
                    frameMaterial: data.frameMaterial || '',
                    gender: data.gender || '',
                    feature: data.feature || ''
                });
                let sub = data.contactLensSubcategory || '';
                if (!sub && data.contactLensVariants?.length) {
                    sub = findSolutionSubcategoryName([]);
                }
                setContactLensSubcategory(sub);
                setContactLensType(data.contactLensType || '');
                setReplacementSchedule(data.contactLensReplacementSchedule || '');
                const packForm = packSizeToFormState(data.contactLensPackSize);
                setPackSize(packForm.packSize);
                setCustomPackCount(packForm.customPackCount);
                setContactLensRows(variantsToRows(data.contactLensVariants));
                const photos = data.photos || [];
                setExistingMedia({
                    photos,
                    videoUrl: data.videoUrl || null,
                    view360Url: data.view360Url || null
                });
                const photoPreviews = {};
                PHOTO_INDICES.forEach((n, i) => {
                    photoPreviews[`photo${n}`] = photos[i] || null;
                });
                setPreviews({
                    ...photoPreviews,
                    video: data.videoUrl ? 'uploaded' : null,
                    view360: data.view360Url || null,
                });
            } catch (err) {
                console.error(err);
                alert('Failed to load product.');
                navigate('/products');
            } finally {
                setLoadingProduct(false);
            }
        };
        load();
    }, [id, navigate]);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const MAX_IMAGE_SIZE_MB = 4;
    const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

    const handleFileChange = (e, key) => {
        const file = e.target.files[0];
        if (!file) return;
        const isImage = key.startsWith('photo') || key === 'view360';
        if (isImage && file.size > MAX_IMAGE_BYTES) {
            alert(`Image must be under ${MAX_IMAGE_SIZE_MB}MB.`);
            e.target.value = '';
            return;
        }
        setFiles(prev => ({ ...prev, [key]: file }));
        const reader = new FileReader();
        reader.onloadend = () => setPreviews(prev => ({ ...prev, [key]: reader.result }));
        reader.readAsDataURL(file);
    };

    const triggerFileInput = (key) => fileInputRefs[key].current?.click();

    const handlePhotoRemove = (key, e) => {
        e.stopPropagation();
        e.preventDefault();
        setFiles((prev) => ({ ...prev, [key]: null }));
        setPreviews((prev) => ({ ...prev, [key]: null }));
        const ref = fileInputRefs[key];
        if (ref?.current) ref.current.value = '';
    };

    const uploadFile = (file, folder) => {
        return new Promise((resolve, reject) => {
            if (!file) { resolve(null); return; }
            const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);
            uploadTask.on('state_changed', null, reject, () => getDownloadURL(uploadTask.snapshot.ref).then(resolve));
        });
    };

    const handleSaveProduct = async () => {
        if (!formData.name) {
            alert('Please fill in product name.');
            return;
        }
        setIsSaving(true);
        try {
            const newPhotos = [];
            for (const n of PHOTO_INDICES) {
                const key = `photo${n}`;
                if (files[key]) {
                    const url = await uploadFile(files[key], 'products/photos');
                    if (url) newPhotos.push(url);
                    continue;
                }
                const pv = previews[key];
                if (pv && typeof pv === 'string' && (pv.startsWith('http://') || pv.startsWith('https://'))) {
                    newPhotos.push(pv);
                }
            }
            const videoUrl = files.video ? await uploadFile(files.video, 'products/videos') : existingMedia.videoUrl;
            const view360Url = files.view360 ? await uploadFile(files.view360, 'products/360views') : existingMedia.view360Url;

            const stockNum = parseInt(String(formData.stock).trim(), 10);
            const stock = Number.isFinite(stockNum) && stockNum >= 0 ? stockNum : DEFAULT_STOCK;
            const { stock: _s, ...formWithoutStock } = formData;

            const payload = {
                ...formWithoutStock,
                stock,
                photos: newPhotos,
                videoUrl: videoUrl || null,
                view360Url: view360Url || null,
                updatedAt: serverTimestamp()
            };
            applyContactLensProductPayload(payload, {
                category: formData.category,
                frameType: formData.frameType,
                subcategory: contactLensSubcategory,
                volumeRows: contactLensRows,
                lensType: contactLensType,
                replacementSchedule,
                packSize,
                customPackCount,
                deleteField,
            });
            await updateDoc(doc(db, 'products', id), payload);
            alert('Product updated successfully!');
            navigate('/products');
        } catch (err) {
            console.error(err);
            alert('Failed to update product.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loadingProduct) {
        return (
            <div className="dashboard-container">
                <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                    <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color, #2563eb)' }} />
                </div>
            </div>
        );
    }

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
                            <span className="cursor-pointer" onClick={() => navigate('/products')}>Product</span>
                            <span className="separator"> &gt; </span>
                            <span className="active">Edit Product</span>
                        </div>
                        <div className="page-title-row">
                            <h1 className="text-2xl font-bold">Edit Product</h1>
                        </div>
                    </div>

                    <div className="add-product-grid">
                        <div className="form-section card">
                            <h2 className="section-title">Product Information</h2>
                            <div className="form-group">
                                <label>Product Name</label>
                                <input type="text" placeholder="Input product name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label>Size</label>
                                    <div className="select-wrapper">
                                        <select value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })}>
                                            <option value="">Select Size</option>
                                            <option>Small</option><option>Medium</option><option>Large</option><option>XL</option>
                                        </select>
                                        <ChevronDown className="select-icon" size={18} />
                                    </div>
                                </div>
                                <div className="form-group flex-1">
                                    <label>Color</label>
                                    <input type="text" placeholder="Color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label>Product Category</label>
                                    <div className="select-wrapper">
                                        <select
                                            value={formData.category}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setFormData({ ...formData, category: v });
                                                if (!isContactLensesCategory(v) && formData.frameType !== CONTACT_LENS_FRAME_TYPE) {
                                                    resetContactLensFormState({
                                                        setSubcategory: setContactLensSubcategory,
                                                        setVolumeRows: setContactLensRows,
                                                        setLensType: setContactLensType,
                                                        setReplacementSchedule,
                                                        setPackSize,
                                                        setCustomPackCount,
                                                    });
                                                }
                                            }}
                                        >
                                            <option value="">Select category</option>
                                            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                        <ChevronDown className="select-icon" size={18} />
                                    </div>
                                </div>
                                <div className="form-group flex-1">
                                    <label>Price</label>
                                    <input type="number" placeholder="Price" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
                                </div>
                            </div>
                            <ContactLensProductFields
                                category={formData.category}
                                frameType={formData.frameType}
                                categories={categories}
                                contactLensSubcategory={contactLensSubcategory}
                                setContactLensSubcategory={setContactLensSubcategory}
                                contactLensRows={contactLensRows}
                                setContactLensRows={setContactLensRows}
                                contactLensType={contactLensType}
                                setContactLensType={setContactLensType}
                                replacementSchedule={replacementSchedule}
                                setReplacementSchedule={setReplacementSchedule}
                                packSize={packSize}
                                setPackSize={setPackSize}
                                customPackCount={customPackCount}
                                setCustomPackCount={setCustomPackCount}
                            />
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label>Offer Price</label>
                                    <input type="number" placeholder="Offer price (optional)" value={formData.offerPrice} onChange={(e) => setFormData({ ...formData, offerPrice: e.target.value })} />
                                </div>
                                <div className="form-group flex-1">
                                    <label>Stock (PCS)</label>
                                    <input type="number" min="0" placeholder={String(DEFAULT_STOCK)} value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <div className="select-wrapper">
                                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                                        <option value="">Select status</option>
                                        <option>In Stock</option><option>Out of Stock</option><option>Discontinued</option>
                                    </select>
                                    <ChevronDown className="select-icon" size={18} />
                                </div>
                            </div>
                            <h2 className="section-title mt-8">Technical Information</h2>
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label>Brand</label>
                                    <div className="select-wrapper">
                                        <select value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })}>
                                            <option value="">Select Brand</option>
                                            <option>Visionkart</option><option>Ray-Ban</option><option>Oakley</option><option>Gucci</option><option>Prada</option><option>Bausch + Lomb</option>
                                        </select>
                                        <ChevronDown className="select-icon" size={18} />
                                    </div>
                                </div>
                                <div className="form-group flex-1">
                                    <label>Model</label>
                                    <input type="text" placeholder="Model" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label>Frame Type</label>
                                    <div className="select-wrapper">
                                        <select
                                            value={formData.frameType}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setFormData({ ...formData, frameType: v });
                                                if (!isContactLensesCategory(formData.category) && v !== CONTACT_LENS_FRAME_TYPE) {
                                                    resetContactLensFormState({
                                                        setSubcategory: setContactLensSubcategory,
                                                        setVolumeRows: setContactLensRows,
                                                        setLensType: setContactLensType,
                                                        setReplacementSchedule,
                                                        setPackSize,
                                                        setCustomPackCount,
                                                    });
                                                }
                                            }}
                                        >
                                            <option value="">Select Frame Type</option>
                                            <option>Full Rim</option><option>Half Rim</option><option>Rimless</option><option>Shell</option>
                                            <option>{CONTACT_LENS_FRAME_TYPE}</option>
                                        </select>
                                        <ChevronDown className="select-icon" size={18} />
                                    </div>
                                </div>
                                <div className="form-group flex-1">
                                    <label>Frame Shape</label>
                                    <div className="select-wrapper">
                                        <select value={formData.frameShape} onChange={(e) => setFormData({ ...formData, frameShape: e.target.value })}>
                                            <option value="">Select Frame Shape</option>
                                            <option>Rectangle</option><option>Rectangle (Blue)</option><option>Rectangle (Black)</option>
                                            <option>Round</option><option>Wayfarer</option><option>Aviator</option><option>Cat Eye</option><option>Oval</option>
                                        </select>
                                        <ChevronDown className="select-icon" size={18} />
                                    </div>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label>Frame Material</label>
                                    <div className="select-wrapper">
                                        <select value={formData.frameMaterial} onChange={(e) => setFormData({ ...formData, frameMaterial: e.target.value })}>
                                            <option value="">Select Material</option>
                                            <option>Plastic</option><option>Metal</option><option>Acetate</option><option>Titanium</option><option>Carbon Fiber</option>
                                        </select>
                                        <ChevronDown className="select-icon" size={18} />
                                    </div>
                                </div>
                                <div className="form-group flex-1">
                                    <label>Gender</label>
                                    <div className="select-wrapper">
                                        <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                                            <option value="">Select Gender</option>
                                            <option>Men</option><option>Women</option><option>Unisex</option><option>Kids</option>
                                        </select>
                                        <ChevronDown className="select-icon" size={18} />
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Product Features</label>
                                <input type="text" placeholder="e.g. UV Protection" value={formData.feature} onChange={(e) => setFormData({ ...formData, feature: e.target.value })} />
                            </div>
                        </div>

                        <div className="upload-section card">
                            <h2 className="section-title">Product images</h2>
                            <p className="section-subtitle">
                                Gallery with up to 8 images. Use SVG, PNG or JPG — max 4MB per file.
                            </p>
                            <div className="image-upload-grid">
                                {PHOTO_INDICES.map((idx) => {
                                    const key = `photo${idx}`;
                                    const hasPreview = Boolean(previews[key]);
                                    return (
                                        <div
                                            key={idx}
                                            className={`upload-box upload-box--photo ${hasPreview ? 'has-preview' : 'upload-box--empty'}`}
                                            onClick={() => triggerFileInput(key)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === 'Enter' && triggerFileInput(key)}
                                        >
                                            <input
                                                type="file"
                                                ref={fileInputRefs[key]}
                                                style={{ display: 'none' }}
                                                accept="image/*"
                                                onChange={(e) => handleFileChange(e, key)}
                                            />
                                            {hasPreview && (
                                                <button
                                                    type="button"
                                                    className="photo-remove-btn"
                                                    onClick={(e) => handlePhotoRemove(key, e)}
                                                    aria-label={`Remove image ${idx}`}
                                                >
                                                    <X size={14} strokeWidth={2.5} />
                                                </button>
                                            )}
                                            {hasPreview ? (
                                                <img src={previews[key]} alt={`Product image ${idx}`} className="upload-preview" />
                                            ) : (
                                                <div className="upload-slot-inner">
                                                    <span className="upload-slot-badge">{idx}</span>
                                                    <Camera size={22} className="upload-icon" strokeWidth={1.75} />
                                                    <span className="upload-slot-cta">Add image</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="media-upload-extra">
                                <p className="media-upload-extra-label">Optional media</p>
                                <div className="video-upload-row">
                                    <div
                                        className={`upload-box upload-box--media flex-1 ${previews.video ? 'has-media' : 'upload-box--empty'}`}
                                        onClick={() => triggerFileInput('video')}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && triggerFileInput('video')}
                                    >
                                        <input type="file" ref={fileInputRefs.video} style={{ display: 'none' }} accept="video/*" onChange={(e) => handleFileChange(e, 'video')} />
                                        {previews.video ? (
                                            <div className="video-preview-placeholder">
                                                Video {previews.video === 'uploaded' ? 'saved' : 'selected'}
                                            </div>
                                        ) : (
                                            <>
                                                <Video size={22} className="upload-icon" strokeWidth={1.75} />
                                                <span className="upload-slot-cta">Product video</span>
                                            </>
                                        )}
                                    </div>
                                    <div
                                        className={`upload-box upload-box--media flex-1 ${previews.view360 ? 'has-media' : 'upload-box--empty'}`}
                                        onClick={() => triggerFileInput('view360')}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && triggerFileInput('view360')}
                                    >
                                        <input type="file" ref={fileInputRefs.view360} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileChange(e, 'view360')} />
                                        {previews.view360 ? (
                                            <img src={previews.view360} alt="360° preview" className="upload-preview" />
                                        ) : (
                                            <>
                                                <Maximize size={22} className="upload-icon" strokeWidth={1.75} />
                                                <span className="upload-slot-cta">360° image</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="save-btn-container">
                                <button className="btn-primary save-btn" onClick={handleSaveProduct} disabled={isSaving}>
                                    {isSaving ? <><Loader2 className="animate-spin mr-2" size={18} /> Updating...</> : 'Update Product'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default EditProduct;
