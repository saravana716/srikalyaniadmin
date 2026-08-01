import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Lock,
    Phone,
    Globe,
    Instagram,
    Facebook,
    Bell,
    Shield,
    Loader2,
    Save,
    Key,
    Server,
    Image as ImageIcon,
    Database,
    MessageCircle,
    Info,
    Truck,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { db, storage, defaultFirebaseConfig } from '../firebase';
import {
    doc,
    getDoc,
    onSnapshot,
    setDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import '../assets/styles/Dashboard.css';
import '../assets/styles/Settings.css';

const SITE_SETTINGS_ID = 'general';

const DEFAULT_SITE_SETTINGS = {
    siteName: '',
    tagline: '',
    logoUrl: '',
    faviconUrl: '',
    socialInstagram: '',
    socialFacebook: '',
    socialWhatsApp: '',
    contactPhone: '',
    contactEmail: '',
    businessAddress: '',
    smsProvider: '',
    smsSenderId: '',
    smsApiKey: '',
    senderEmail: '',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: '',
    notifyNewOrders: true,
    notifyNewCustomers: true,
    adminLoginAlerts: false,
    twoFactorEnabled: false,
    delhiveryApiBaseUrl: 'https://track.delhivery.com/api',
    delhiveryWarehouseName: '',
    delhiveryApiToken: '',
};

const CONFIG_KEYS = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
];

const labelForKey = (key) =>
    key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();

function isStrongPassword(p) {
    if (!p || p.length < 8) return false;
    if (!/[a-z]/.test(p)) return false;
    if (!/[A-Z]/.test(p)) return false;
    if (!/[0-9]/.test(p)) return false;
    return true;
}

function uploadFile(file, storagePath) {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, storagePath);
        const task = uploadBytesResumable(storageRef, file);
        task.on('state_changed', null, reject, () =>
            getDownloadURL(task.snapshot.ref).then(resolve)
        );
    });
}

const SETTINGS_TAB_LIST = [
    { id: 'profile', label: 'Admin profile' },
    { id: 'website', label: 'Website' },
    { id: 'contact', label: 'Contact' },
    { id: 'messaging', label: 'Email & SMS' },
    { id: 'social', label: 'Social' },
    { id: 'alerts', label: 'Alerts & security' },
    { id: 'delhivery', label: 'Delhivery' },
    { id: 'firebase', label: 'Firebase' },
];

function SettingsTabIcon({ id, size = 16 }) {
    const p = { size };
    switch (id) {
        case 'profile':
            return <User {...p} />;
        case 'website':
            return <Globe {...p} />;
        case 'contact':
            return <Phone {...p} />;
        case 'messaging':
            return <Server {...p} />;
        case 'social':
            return <Instagram {...p} />;
        case 'alerts':
            return <Bell {...p} />;
        case 'delhivery':
            return <Truck {...p} />;
        case 'firebase':
            return <Database {...p} />;
        default:
            return null;
    }
}

const SettingsPage = () => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState(defaultFirebaseConfig);

    const [adminId, setAdminId] = useState(null);
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPhone, setAdminPhone] = useState('');
    const [adminProfileUrl, setAdminProfileUrl] = useState('');
    const [adminProfileFile, setAdminProfileFile] = useState(null);
    const profileInputRef = useRef(null);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [site, setSite] = useState(() => ({ ...DEFAULT_SITE_SETTINGS }));
    const [hasStoredSmtpPassword, setHasStoredSmtpPassword] = useState(false);
    const [hasStoredSmsApiKey, setHasStoredSmsApiKey] = useState(false);
    const [smtpPassInput, setSmtpPassInput] = useState('');
    const [smsApiKeyInput, setSmsApiKeyInput] = useState('');
    const [hasStoredDelhiveryToken, setHasStoredDelhiveryToken] = useState(false);
    const [delhiveryTokenInput, setDelhiveryTokenInput] = useState('');

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [faviconFile, setFaviconFile] = useState(null);
    const [faviconPreview, setFaviconPreview] = useState('');
    const logoInputRef = useRef(null);
    const faviconInputRef = useRef(null);

    const [saving, setSaving] = useState({});
    const [activeTab, setActiveTab] = useState('profile');

    useEffect(() => {
        const saved = localStorage.getItem('firebase_config');
        if (saved) {
            try {
                setConfig({ ...defaultFirebaseConfig, ...JSON.parse(saved) });
            } catch (e) {
                setConfig(defaultFirebaseConfig);
            }
        }
    }, []);

    useEffect(() => {
        let raw;
        try {
            raw = JSON.parse(localStorage.getItem('admin_user') || '{}');
        } catch {
            raw = {};
        }
        if (!raw.id) {
            setLoading(false);
            return;
        }
        setAdminId(raw.id);
        setAdminName(raw.name || '');
        setAdminEmail(raw.email || '');
        setAdminPhone(raw.phone || '');
        setAdminProfileUrl(raw.profileImage || '');

        (async () => {
            try {
                const snap = await getDoc(doc(db, 'admin', raw.id));
                if (snap.exists()) {
                    const d = snap.data();
                    setAdminName(d.Name || raw.name || '');
                    setAdminEmail(d.Email || raw.email || '');
                    setAdminPhone(d.Phone || '');
                    setAdminProfileUrl(d.ProfileImage || raw.profileImage || '');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'siteSettings', SITE_SETTINGS_ID), (snap) => {
            if (!snap.exists()) {
                setSite({ ...DEFAULT_SITE_SETTINGS });
                setHasStoredSmtpPassword(false);
                setHasStoredSmsApiKey(false);
                setHasStoredDelhiveryToken(false);
                return;
            }
            const d = snap.data();
            setSite({
                ...DEFAULT_SITE_SETTINGS,
                ...d,
                smtpPort: d.smtpPort ?? DEFAULT_SITE_SETTINGS.smtpPort,
                delhiveryApiBaseUrl:
                    d.delhiveryApiBaseUrl || DEFAULT_SITE_SETTINGS.delhiveryApiBaseUrl,
            });
            setHasStoredSmtpPassword(!!(d.smtpPassword && String(d.smtpPassword).length > 0));
            setHasStoredSmsApiKey(!!(d.smsApiKey && String(d.smsApiKey).length > 0));
            setHasStoredDelhiveryToken(!!(d.delhiveryApiToken && String(d.delhiveryApiToken).length > 0));
        });
        return () => unsub();
    }, []);

    const setSavingKey = (key, v) => setSaving((s) => ({ ...s, [key]: v }));

    const handleProfileImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAdminProfileFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setAdminProfileUrl(reader.result);
        reader.readAsDataURL(file);
    };

    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setLogoPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleFaviconChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFaviconFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setFaviconPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const persistAdminLocal = (name, email, profileImage, phone) => {
        try {
            const prev = JSON.parse(localStorage.getItem('admin_user') || '{}');
            localStorage.setItem(
                'admin_user',
                JSON.stringify({
                    ...prev,
                    name,
                    email,
                    profileImage: profileImage || prev.profileImage,
                    phone: phone ?? prev.phone,
                })
            );
        } catch {
            /* ignore */
        }
    };

    const saveAdminProfile = async () => {
        if (!adminId) return;
        setSavingKey('profile', true);
        try {
            let profileUrl = adminProfileUrl;
            if (adminProfileFile) {
                profileUrl = await uploadFile(
                    adminProfileFile,
                    `settings/profile/${Date.now()}_${adminProfileFile.name}`
                );
                setAdminProfileFile(null);
                setAdminProfileUrl(profileUrl);
            }
            await updateDoc(doc(db, 'admin', adminId), {
                Name: adminName.trim(),
                Email: adminEmail.trim(),
                Phone: adminPhone.trim(),
                ProfileImage: profileUrl || '',
                updatedAt: serverTimestamp(),
            });
            persistAdminLocal(adminName.trim(), adminEmail.trim(), profileUrl, adminPhone.trim());
            alert('Profile saved.');
        } catch (e) {
            console.error(e);
            alert('Could not save profile. Check console.');
        } finally {
            setSavingKey('profile', false);
        }
    };

    const savePassword = async () => {
        if (!adminId) return;
        if (newPassword !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
        if (!isStrongPassword(newPassword)) {
            alert(
                'Use a strong password: at least 8 characters with uppercase, lowercase, and a number.'
            );
            return;
        }
        setSavingKey('password', true);
        try {
            await updateDoc(doc(db, 'admin', adminId), {
                password: newPassword,
                updatedAt: serverTimestamp(),
            });
            setNewPassword('');
            setConfirmPassword('');
            alert('Password updated.');
        } catch (e) {
            console.error(e);
            alert('Could not update password.');
        } finally {
            setSavingKey('password', false);
        }
    };

    const saveSiteDoc = async (partial) => {
        await setDoc(
            doc(db, 'siteSettings', SITE_SETTINGS_ID),
            {
                ...partial,
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    };

    const saveWebsiteBranding = async () => {
        setSavingKey('branding', true);
        try {
            let logoUrl = site.logoUrl;
            let faviconUrl = site.faviconUrl;
            if (logoFile) {
                logoUrl = await uploadFile(logoFile, `settings/site/logo_${Date.now()}_${logoFile.name}`);
                setLogoFile(null);
            }
            if (faviconFile) {
                faviconUrl = await uploadFile(
                    faviconFile,
                    `settings/site/favicon_${Date.now()}_${faviconFile.name}`
                );
                setFaviconFile(null);
            }
            await saveSiteDoc({
                siteName: site.siteName,
                tagline: site.tagline,
                logoUrl: logoUrl || '',
                faviconUrl: faviconUrl || '',
            });
            setSite((s) => ({ ...s, logoUrl, faviconUrl }));
            setLogoPreview(logoUrl || '');
            setFaviconPreview(faviconUrl || '');
            alert('Website & branding saved.');
        } catch (e) {
            console.error(e);
            alert('Could not save website settings.');
        } finally {
            setSavingKey('branding', false);
        }
    };

    const saveSocial = async () => {
        setSavingKey('social', true);
        try {
            await saveSiteDoc({
                socialInstagram: site.socialInstagram,
                socialFacebook: site.socialFacebook,
                socialWhatsApp: site.socialWhatsApp,
            });
            alert('Social links saved.');
        } catch (e) {
            console.error(e);
            alert('Could not save social links.');
        } finally {
            setSavingKey('social', false);
        }
    };

    const saveContact = async () => {
        setSavingKey('contact', true);
        try {
            await saveSiteDoc({
                contactPhone: site.contactPhone,
                contactEmail: site.contactEmail,
                businessAddress: site.businessAddress,
            });
            alert('Contact information saved.');
        } catch (e) {
            console.error(e);
            alert('Could not save contact info.');
        } finally {
            setSavingKey('contact', false);
        }
    };

    const saveMessaging = async () => {
        setSavingKey('messaging', true);
        try {
            const payload = {
                smsProvider: site.smsProvider,
                smsSenderId: site.smsSenderId,
                senderEmail: site.senderEmail,
                smtpHost: site.smtpHost,
                smtpPort: Number(site.smtpPort) || 587,
                smtpUser: site.smtpUser,
            };
            if (smsApiKeyInput.trim()) {
                payload.smsApiKey = smsApiKeyInput.trim();
            }
            if (smtpPassInput.trim()) {
                payload.smtpPassword = smtpPassInput.trim();
            }
            await saveSiteDoc(payload);
            setSmsApiKeyInput('');
            setSmtpPassInput('');
            if (payload.smsApiKey) setHasStoredSmsApiKey(true);
            if (payload.smtpPassword) setHasStoredSmtpPassword(true);
            alert('Email & SMS settings saved.');
        } catch (e) {
            console.error(e);
            alert('Could not save messaging settings.');
        } finally {
            setSavingKey('messaging', false);
        }
    };

    const saveDelhivery = async () => {
        setSavingKey('delhivery', true);
        try {
            const payload = {
                delhiveryApiBaseUrl:
                    (site.delhiveryApiBaseUrl || DEFAULT_SITE_SETTINGS.delhiveryApiBaseUrl).replace(
                        /\/$/,
                        ''
                    ),
                delhiveryWarehouseName: (site.delhiveryWarehouseName || '').trim(),
            };
            if (delhiveryTokenInput.trim()) {
                payload.delhiveryApiToken = delhiveryTokenInput.trim();
            }
            await saveSiteDoc(payload);
            setDelhiveryTokenInput('');
            if (payload.delhiveryApiToken) setHasStoredDelhiveryToken(true);
            alert('Delhivery settings saved.');
        } catch (e) {
            console.error(e);
            alert('Could not save Delhivery settings.');
        } finally {
            setSavingKey('delhivery', false);
        }
    };

    const savePreferences = async () => {
        setSavingKey('prefs', true);
        try {
            await saveSiteDoc({
                notifyNewOrders: !!site.notifyNewOrders,
                notifyNewCustomers: !!site.notifyNewCustomers,
                adminLoginAlerts: !!site.adminLoginAlerts,
                twoFactorEnabled: !!site.twoFactorEnabled,
            });
            alert('Notification & security preferences saved.');
        } catch (e) {
            console.error(e);
            alert('Could not save preferences.');
        } finally {
            setSavingKey('prefs', false);
        }
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const pwdOk = newPassword.length === 0 || isStrongPassword(newPassword);
    const pwdMatch = newPassword === confirmPassword || confirmPassword.length === 0;

    if (loading && adminId) {
        return (
            <div className="dashboard-container">
                <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
                <div className="main-content">
                    <Header toggleSidebar={toggleSidebar} />
                    <div className="dashboard-content flex items-center justify-center p-12">
                        <Loader2 className="animate-spin text-blue-600" size={32} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
            <div className="main-content">
                <Header toggleSidebar={toggleSidebar} />
                <div className="dashboard-content settings-page">
                    <div className="content-header">
                        <div className="breadcrumb">
                            <span className="cursor-pointer" onClick={() => navigate('/dashboard')}>
                                Dashboard
                            </span>
                            <span className="separator"> &gt; </span>
                            <span className="active">Settings</span>
                        </div>
                        <div className="page-title-row">
                            <h1 className="text-2xl font-bold">Settings</h1>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Use the tabs below to edit each section. Changes are saved with the button in that
                            section.
                        </p>
                    </div>

                    <div className="settings-tabs-wrap">
                        <nav className="settings-tabs" role="tablist" aria-label="Settings sections">
                            {SETTINGS_TAB_LIST.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === tab.id}
                                    id={`settings-tab-${tab.id}`}
                                    className={`settings-tab ${activeTab === tab.id ? 'settings-tab--active' : ''}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    <SettingsTabIcon id={tab.id} />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="settings-tab-panel">
                        {activeTab === 'profile' && (
                    <div className="settings-card mb-5">
                        <h2 className="settings-section-title">
                            <User size={18} /> Admin profile
                        </h2>
                        <p className="settings-section-desc">
                            Your account details used for this admin panel. Changing email affects how you log in.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-6">
                            <div className="flex flex-col items-center sm:items-start gap-2">
                                <img
                                    src={
                                        adminProfileUrl ||
                                        `https://ui-avatars.com/api/?name=${encodeURIComponent(adminName || 'Admin')}&background=dbeafe&color=1e40af`
                                    }
                                    alt=""
                                    className="settings-image-preview settings-image-preview--round"
                                />
                                <input
                                    ref={profileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleProfileImageChange}
                                />
                                <button
                                    type="button"
                                    className="settings-btn settings-btn--secondary text-xs"
                                    onClick={() => profileInputRef.current?.click()}
                                >
                                    <ImageIcon size={14} /> Change photo
                                </button>
                            </div>
                            <div className="flex-1 grid gap-3">
                                <div className="settings-form-row settings-form-row--2">
                                    <div>
                                        <label className="settings-label">Name</label>
                                        <input
                                            className="settings-input"
                                            value={adminName}
                                            onChange={(e) => setAdminName(e.target.value)}
                                            placeholder="Admin name"
                                        />
                                    </div>
                                    <div>
                                        <label className="settings-label">Email</label>
                                        <input
                                            className="settings-input"
                                            type="email"
                                            value={adminEmail}
                                            onChange={(e) => setAdminEmail(e.target.value)}
                                            placeholder="admin@example.com"
                                        />
                                    </div>
                                </div>
                                <div className="settings-form-row settings-form-row--2">
                                    <div>
                                        <label className="settings-label">Phone</label>
                                        <input
                                            className="settings-input"
                                            value={adminPhone}
                                            onChange={(e) => setAdminPhone(e.target.value)}
                                            placeholder="+91 …"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            className="settings-btn settings-btn--primary w-full sm:w-auto"
                                            onClick={saveAdminProfile}
                                            disabled={saving.profile}
                                        >
                                            {saving.profile ? (
                                                <Loader2 className="animate-spin" size={18} />
                                            ) : (
                                                <Save size={18} />
                                            )}
                                            Save profile
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="settings-divider" />

                        <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                            <Lock size={16} /> Password
                        </h3>
                        <p className="settings-section-desc" style={{ marginBottom: '0.75rem' }}>
                            Change the default password. Use a strong password (8+ chars, upper, lower, number).
                        </p>
                        <div className="settings-form-row settings-form-row--2">
                            <div>
                                <label className="settings-label">New password</label>
                                <input
                                    className="settings-input"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                />
                                {newPassword.length > 0 &&
                                    (pwdOk ? (
                                        <p className="password-strength-ok">Strong enough</p>
                                    ) : (
                                        <p className="password-strength-bad">
                                            Add uppercase, lowercase, and a number (8+ chars)
                                        </p>
                                    ))}
                            </div>
                            <div>
                                <label className="settings-label">Confirm password</label>
                                <input
                                    className="settings-input"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repeat password"
                                    autoComplete="new-password"
                                />
                                {confirmPassword.length > 0 && !pwdMatch && (
                                    <p className="password-strength-bad">Passwords must match</p>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            className="settings-btn settings-btn--secondary"
                            onClick={savePassword}
                            disabled={saving.password || !newPassword || !pwdOk || !pwdMatch}
                        >
                            {saving.password ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <Key size={18} />
                            )}
                            Update password
                        </button>
                    </div>
                        )}

                        {activeTab === 'website' && (
                    <div className="settings-card mb-5">
                            <h2 className="settings-section-title">
                                <Globe size={18} /> Website
                            </h2>
                            <p className="settings-section-desc">Store name, tagline, logo, and favicon.</p>
                            <div className="settings-form-row">
                                <div>
                                    <label className="settings-label">Site name</label>
                                    <input
                                        className="settings-input"
                                        value={site.siteName}
                                        onChange={(e) => setSite((s) => ({ ...s, siteName: e.target.value }))}
                                        placeholder="VisionKart"
                                    />
                                </div>
                                <div>
                                    <label className="settings-label">Tagline</label>
                                    <input
                                        className="settings-input"
                                        value={site.tagline}
                                        onChange={(e) => setSite((s) => ({ ...s, tagline: e.target.value }))}
                                        placeholder="Short tagline"
                                    />
                                </div>
                            </div>
                            <div className="settings-form-row settings-form-row--2">
                                <div>
                                    <label className="settings-label">Logo</label>
                                    <input
                                        ref={logoInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="settings-input text-xs"
                                        onChange={handleLogoChange}
                                    />
                                    {(logoPreview || site.logoUrl) && (
                                        <img
                                            src={logoPreview || site.logoUrl}
                                            alt=""
                                            className="settings-image-preview mt-2"
                                            style={{ maxHeight: 64, width: 'auto' }}
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="settings-label">Favicon</label>
                                    <input
                                        ref={faviconInputRef}
                                        type="file"
                                        accept="image/*,.ico"
                                        className="settings-input text-xs"
                                        onChange={handleFaviconChange}
                                    />
                                    {(faviconPreview || site.faviconUrl) && (
                                        <img
                                            src={faviconPreview || site.faviconUrl}
                                            alt=""
                                            className="settings-favicon-preview mt-2"
                                        />
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="settings-btn settings-btn--primary mt-2"
                                onClick={saveWebsiteBranding}
                                disabled={saving.branding}
                            >
                                {saving.branding ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                Save website
                            </button>
                        </div>
                        )}

                        {activeTab === 'contact' && (
                    <div className="settings-card mb-5">
                            <h2 className="settings-section-title">
                                <Phone size={18} /> Contact
                            </h2>
                            <p className="settings-section-desc">Shown to customers on your storefront.</p>
                            <div className="settings-form-row">
                                <div>
                                    <label className="settings-label">Phone</label>
                                    <input
                                        className="settings-input"
                                        value={site.contactPhone}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, contactPhone: e.target.value }))
                                        }
                                        placeholder="Business phone"
                                    />
                                </div>
                                <div>
                                    <label className="settings-label">Email</label>
                                    <input
                                        className="settings-input"
                                        type="email"
                                        value={site.contactEmail}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, contactEmail: e.target.value }))
                                        }
                                        placeholder="support@…"
                                    />
                                </div>
                            </div>
                            <div className="settings-form-row">
                                <div>
                                    <label className="settings-label">Business address</label>
                                    <textarea
                                        className="settings-textarea"
                                        value={site.businessAddress}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, businessAddress: e.target.value }))
                                        }
                                        placeholder="Full address"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                className="settings-btn settings-btn--primary"
                                onClick={saveContact}
                                disabled={saving.contact}
                            >
                                {saving.contact ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                Save contact
                            </button>
                        </div>
                        )}

                        {activeTab === 'messaging' && (
                    <div className="settings-card mb-5">
                            <h2 className="settings-section-title">
                                <Server size={18} /> Email & SMS
                            </h2>
                            <p className="settings-section-desc">
                                SMTP (e.g. Gmail app password) and SMS for order confirmation & OTP when your
                                backend uses these values.
                            </p>
                            <div className="settings-form-row">
                                <div>
                                    <label className="settings-label">SMS provider / gateway</label>
                                    <input
                                        className="settings-input"
                                        value={site.smsProvider}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, smsProvider: e.target.value }))
                                        }
                                        placeholder="e.g. Twilio, MSG91"
                                    />
                                </div>
                                <div>
                                    <label className="settings-label">SMS sender ID</label>
                                    <input
                                        className="settings-input"
                                        value={site.smsSenderId}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, smsSenderId: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="settings-form-row">
                                <div>
                                    <label className="settings-label">SMS API key</label>
                                    <input
                                        className="settings-input"
                                        type="password"
                                        value={smsApiKeyInput}
                                        onChange={(e) => setSmsApiKeyInput(e.target.value)}
                                        placeholder={hasStoredSmsApiKey ? '•••••••• (enter new to replace)' : 'API key'}
                                        autoComplete="off"
                                    />
                                    {hasStoredSmsApiKey && !smsApiKeyInput && (
                                        <p className="settings-hint">A key is already stored.</p>
                                    )}
                                </div>
                                <div>
                                    <label className="settings-label">Sender email (From)</label>
                                    <input
                                        className="settings-input"
                                        type="email"
                                        value={site.senderEmail}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, senderEmail: e.target.value }))
                                        }
                                        placeholder="noreply@…"
                                    />
                                </div>
                            </div>
                            <p className="settings-pill-note">SMTP (Gmail example)</p>
                            <div className="settings-form-row settings-form-row--2">
                                <div>
                                    <label className="settings-label">SMTP host</label>
                                    <input
                                        className="settings-input"
                                        value={site.smtpHost}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, smtpHost: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="settings-label">Port</label>
                                    <input
                                        className="settings-input"
                                        type="number"
                                        value={site.smtpPort}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, smtpPort: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="settings-form-row settings-form-row--2">
                                <div>
                                    <label className="settings-label">SMTP user</label>
                                    <input
                                        className="settings-input"
                                        value={site.smtpUser}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, smtpUser: e.target.value }))
                                        }
                                        placeholder="your@gmail.com"
                                    />
                                </div>
                                <div>
                                    <label className="settings-label">SMTP password / app password</label>
                                    <input
                                        className="settings-input"
                                        type="password"
                                        value={smtpPassInput}
                                        onChange={(e) => setSmtpPassInput(e.target.value)}
                                        placeholder={
                                            hasStoredSmtpPassword
                                                ? '•••••••• (enter new to replace)'
                                                : 'Gmail app password'
                                        }
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                            <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-slate-50 text-xs text-slate-600">
                                <Info size={16} className="flex-shrink-0 mt-0.5" />
                                <span>
                                    Used for order confirmation emails and OTP / notifications when your server
                                    or Cloud Functions read these settings. Secrets are stored in Firestore;
                                    restrict rules in production.
                                </span>
                            </div>
                            <button
                                type="button"
                                className="settings-btn settings-btn--primary mt-3"
                                onClick={saveMessaging}
                                disabled={saving.messaging}
                            >
                                {saving.messaging ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                Save email & SMS
                            </button>
                        </div>
                        )}

                        {activeTab === 'social' && (
                    <div className="settings-card mb-5">
                            <h2 className="settings-section-title">
                                <Instagram size={18} /> Social links
                            </h2>
                            <p className="settings-section-desc">Instagram, Facebook, WhatsApp.</p>
                            <div className="settings-form-row">
                                <div>
                                    <label className="settings-label flex items-center gap-2">
                                        <Instagram size={14} /> Instagram
                                    </label>
                                    <input
                                        className="settings-input"
                                        value={site.socialInstagram}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, socialInstagram: e.target.value }))
                                        }
                                        placeholder="https://instagram.com/…"
                                    />
                                </div>
                            </div>
                            <div className="settings-form-row">
                                <div>
                                    <label className="settings-label flex items-center gap-2">
                                        <Facebook size={14} /> Facebook
                                    </label>
                                    <input
                                        className="settings-input"
                                        value={site.socialFacebook}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, socialFacebook: e.target.value }))
                                        }
                                        placeholder="https://facebook.com/…"
                                    />
                                </div>
                            </div>
                            <div className="settings-form-row">
                                <div>
                                    <label className="settings-label flex items-center gap-2">
                                        <MessageCircle size={14} /> WhatsApp
                                    </label>
                                    <input
                                        className="settings-input"
                                        value={site.socialWhatsApp}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, socialWhatsApp: e.target.value }))
                                        }
                                        placeholder="https://wa.me/…"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                className="settings-btn settings-btn--primary"
                                onClick={saveSocial}
                                disabled={saving.social}
                            >
                                {saving.social ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                Save social links
                            </button>
                        </div>
                        )}

                        {activeTab === 'alerts' && (
                    <div className="settings-card mb-5">
                            <h2 className="settings-section-title">
                                <Bell size={18} /> Notifications
                            </h2>
                            <p className="settings-section-desc">Preferences for new orders and customers.</p>
                            <div className="settings-toggle-row">
                                <span className="settings-toggle-label">New orders</span>
                                <label className="settings-switch">
                                    <input
                                        type="checkbox"
                                        checked={!!site.notifyNewOrders}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, notifyNewOrders: e.target.checked }))
                                        }
                                    />
                                    <span className="settings-switch-slider" />
                                </label>
                            </div>
                            <div className="settings-toggle-row">
                                <span className="settings-toggle-label">New customers</span>
                                <label className="settings-switch">
                                    <input
                                        type="checkbox"
                                        checked={!!site.notifyNewCustomers}
                                        onChange={(e) =>
                                            setSite((s) => ({
                                                ...s,
                                                notifyNewCustomers: e.target.checked,
                                            }))
                                        }
                                    />
                                    <span className="settings-switch-slider" />
                                </label>
                            </div>
                            <p className="settings-hint mt-2">
                                Your backend or Cloud Functions can read these flags to send email/push.
                            </p>

                            <div className="settings-divider" />

                            <h2 className="settings-section-title">
                                <Shield size={18} /> Security
                            </h2>
                            <p className="settings-section-desc">Login alerts and two-factor (2FA).</p>
                            <div className="settings-toggle-row">
                                <span className="settings-toggle-label">Admin login alerts</span>
                                <label className="settings-switch">
                                    <input
                                        type="checkbox"
                                        checked={!!site.adminLoginAlerts}
                                        onChange={(e) =>
                                            setSite((s) => ({ ...s, adminLoginAlerts: e.target.checked }))
                                        }
                                    />
                                    <span className="settings-switch-slider" />
                                </label>
                            </div>
                            <div className="settings-toggle-row">
                                <span className="settings-toggle-label">Two-factor authentication (2FA)</span>
                                <label className="settings-switch">
                                    <input
                                        type="checkbox"
                                        checked={!!site.twoFactorEnabled}
                                        onChange={(e) =>
                                            setSite((s) => ({
                                                ...s,
                                                twoFactorEnabled: e.target.checked,
                                            }))
                                        }
                                    />
                                    <span className="settings-switch-slider" />
                                </label>
                            </div>
                            <p className="settings-hint mt-2">
                                2FA and login alerts require your auth backend or Firebase Auth + Cloud
                                Functions to enforce; this stores your preference.
                            </p>

                            <div className="flex justify-end mt-6">
                        <button
                            type="button"
                            className="settings-btn settings-btn--primary"
                            onClick={savePreferences}
                            disabled={saving.prefs}
                        >
                            {saving.prefs ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <Save size={18} />
                            )}
                            Save notification & security preferences
                        </button>
                            </div>
                        </div>
                        )}

                        {activeTab === 'delhivery' && (
                    <div className="settings-card mb-5">
                        <h2 className="settings-section-title">
                            <Truck size={18} /> Delhivery shipping
                        </h2>
                        <p className="settings-section-desc">
                            Paste your <strong>Live API token</strong> from{' '}
                            <a
                                href="https://one.delhivery.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                            >
                                Delhivery One
                            </a>
                            . The <strong>warehouse / pickup location name</strong> must match exactly what
                            you registered in the Delhivery panel.
                        </p>
                        <p className="settings-section-desc" style={{ marginTop: '-0.5rem' }}>
                            <strong>Prepaid accounts:</strong> Delhivery charges a small <strong>manifest fee</strong>{' '}
                            from your Delhivery wallet when a shipment is created. If you see{' '}
                            <em>insufficient balance</em>, recharge in Delhivery One (Wallet / Billing) — your
                            VisionKart order is only updated after Delhivery returns success.
                        </p>
                        <div className="settings-form-row">
                            <div>
                                <label className="settings-label">API base URL</label>
                                <input
                                    className="settings-input"
                                    value={site.delhiveryApiBaseUrl}
                                    onChange={(e) =>
                                        setSite((s) => ({ ...s, delhiveryApiBaseUrl: e.target.value }))
                                    }
                                    placeholder="https://track.delhivery.com/api"
                                />
                                <p className="settings-hint">
                                    Default is production Express API. In <code>npm run dev</code>, requests use a
                                    Vite proxy to avoid CORS.
                                </p>
                            </div>
                        </div>
                        <div className="settings-form-row settings-form-row--2">
                            <div>
                                <label className="settings-label">Warehouse / pickup location name</label>
                                <input
                                    className="settings-input"
                                    value={site.delhiveryWarehouseName}
                                    onChange={(e) =>
                                        setSite((s) => ({ ...s, delhiveryWarehouseName: e.target.value }))
                                    }
                                    placeholder="As shown in Delhivery dashboard"
                                />
                            </div>
                            <div>
                                <label className="settings-label">Live API token</label>
                                <input
                                    className="settings-input"
                                    type="password"
                                    value={delhiveryTokenInput}
                                    onChange={(e) => setDelhiveryTokenInput(e.target.value)}
                                    placeholder={
                                        hasStoredDelhiveryToken
                                            ? '•••••••• (enter new to replace)'
                                            : 'Token from Delhivery One'
                                    }
                                    autoComplete="off"
                                />
                                {hasStoredDelhiveryToken && !delhiveryTokenInput && (
                                    <p className="settings-hint">A token is already stored in Firestore.</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-amber-50 text-xs text-amber-900 border border-amber-100">
                            <Info size={16} className="flex-shrink-0 mt-0.5" />
                            <span>
                                Shipment requests go through{' '}
                                <code>/api/delhivery-shipment</code> on this server so Delhivery works
                                on the deployed admin panel, not only on localhost.
                            </span>
                        </div>
                        <button
                            type="button"
                            className="settings-btn settings-btn--primary mt-3"
                            onClick={saveDelhivery}
                            disabled={saving.delhivery}
                        >
                            {saving.delhivery ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <Save size={18} />
                            )}
                            Save Delhivery
                        </button>
                    </div>
                        )}

                        {activeTab === 'firebase' && (
                    <div className="card settings-dev-card" style={{ padding: '1.5rem 1.75rem', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div
                                style={{
                                    padding: '0.5rem',
                                    background: '#eff6ff',
                                    borderRadius: '10px',
                                    color: '#2563eb',
                                }}
                            >
                                <Database size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold" style={{ margin: 0 }}>
                                    Firebase connection
                                </h2>
                                <p className="text-sm text-gray-500" style={{ margin: '0.25rem 0 0' }}>
                                    Project the admin app uses (read-only).
                                </p>
                            </div>
                        </div>
                        <dl style={{ margin: 0 }}>
                            {CONFIG_KEYS.map((key, i) => (
                                <div
                                    key={key}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(160px, 240px) minmax(0, 1fr)',
                                        gap: '0.75rem 1rem',
                                        padding: '0.65rem 0',
                                        borderBottom: i < CONFIG_KEYS.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        alignItems: 'start',
                                    }}
                                >
                                    <dt
                                        style={{
                                            margin: 0,
                                            fontSize: '0.8125rem',
                                            fontWeight: 600,
                                            color: '#64748b',
                                        }}
                                    >
                                        {labelForKey(key)}
                                    </dt>
                                    <dd
                                        style={{
                                            margin: 0,
                                            fontSize: '0.875rem',
                                            color: '#0f172a',
                                            wordBreak: 'break-all',
                                            fontFamily: 'ui-monospace, monospace',
                                        }}
                                    >
                                        {config[key] ?? '—'}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
