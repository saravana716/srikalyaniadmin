import React, { useMemo, useRef } from 'react';
import { ChevronDown, Calendar, Package } from 'lucide-react';
import ContactLensVariantFields from './ContactLensVariantFields';
import {
    CONTACT_LENS_FRAME_TYPE,
    CONTACT_LENS_TYPES,
    CONTACT_LENS_REPLACEMENT_SCHEDULES,
    CONTACT_LENS_PACK_SIZES,
    CONTACT_LENS_PACK_SIZE_CUSTOM,
    isContactLensesCategory,
    isSolutionSubcategory,
    isColorLensesSubcategory,
    emptyContactLensRow,
} from '../config/contactLens';
import sphericalImg from '../assets/contact-lens/spherical.svg';
import toricImg from '../assets/contact-lens/toric.svg';
import multifocalImg from '../assets/contact-lens/multifocal.svg';
import '../assets/styles/ContactLens.css';

const LENS_TYPE_IMAGES = {
    spherical: sphericalImg,
    toric: toricImg,
    multifocal: multifocalImg,
};

export default function ContactLensProductFields({
    category,
    frameType,
    categories,
    contactLensSubcategory,
    setContactLensSubcategory,
    contactLensRows,
    setContactLensRows,
    contactLensType = '',
    setContactLensType,
    replacementSchedule = '',
    setReplacementSchedule,
    packSize = '',
    setPackSize,
    customPackCount = '',
    setCustomPackCount,
}) {
    const isContact = isContactLensesCategory(category);
    const showLegacyVolume = !isContact && frameType === CONTACT_LENS_FRAME_TYPE;

    const solutionRowsRef = useRef(null);

    const subcategoryOptions = useMemo(() => {
        if (!isContact) return [];
        const cat = categories.find((c) => c.name === category);
        return cat?.subcategories || [];
    }, [categories, category, isContact]);

    const clearColorLensFields = () => {
        if (setContactLensType) setContactLensType('');
        if (setReplacementSchedule) setReplacementSchedule('');
        if (setPackSize) setPackSize('');
        if (setCustomPackCount) setCustomPackCount('');
    };

    const handleSubcategoryChange = (name) => {
        const prev = contactLensSubcategory;
        if (isSolutionSubcategory(prev)) {
            solutionRowsRef.current = contactLensRows;
        }

        setContactLensSubcategory(name);

        if (isSolutionSubcategory(name)) {
            clearColorLensFields();
            setContactLensRows(solutionRowsRef.current ?? contactLensRows);
            return;
        }

        if (isColorLensesSubcategory(name)) {
            setContactLensRows([emptyContactLensRow()]);
            return;
        }

        clearColorLensFields();
        setContactLensRows([emptyContactLensRow()]);
    };

    const toggleLensType = (id) => {
        if (!setContactLensType) return;
        setContactLensType(contactLensType === id ? '' : id);
    };

    const toggleSchedule = (id) => {
        if (!setReplacementSchedule) return;
        setReplacementSchedule(replacementSchedule === id ? '' : id);
    };

    const selectPackSize = (id) => {
        if (!setPackSize) return;
        if (packSize === id) {
            setPackSize('');
            if (setCustomPackCount) setCustomPackCount('');
            return;
        }
        setPackSize(id);
        if (id !== CONTACT_LENS_PACK_SIZE_CUSTOM && setCustomPackCount) {
            setCustomPackCount('');
        }
    };

    if (!isContact && !showLegacyVolume) return null;

    const sub = String(contactLensSubcategory || '').trim();
    const showVolumeForContact = isContact && isSolutionSubcategory(sub);
    const showColorLensOptions = isContact && isColorLensesSubcategory(sub);
    const showCustomPackInput = packSize === CONTACT_LENS_PACK_SIZE_CUSTOM;

    return (
        <>
            {isContact && (
                <div className="contact-lens-options-panel">
                    <div className="contact-lens-subcategory-block">
                        <div className="form-group">
                            <label>Subcategory (optional)</label>
                            <div className="select-wrapper">
                                <select
                                    value={contactLensSubcategory}
                                    onChange={(e) => handleSubcategoryChange(e.target.value)}
                                >
                                    <option value="">Select subcategory (optional)</option>
                                    {subcategoryOptions.map((opt) => (
                                        <option key={opt.id || opt.name} value={opt.name}>
                                            {opt.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="select-icon" size={18} />
                            </div>
                        </div>
                        {!subcategoryOptions.length && (
                            <p className="contact-lens-help">
                                No subcategories yet. Add them under Categories (e.g. Solutions, Color Lenses).
                            </p>
                        )}
                    </div>

                    {showColorLensOptions && (
                        <>
                            <div className="form-group contact-lens-type-section">
                                <label>Contact lens type (optional)</label>
                                <p className="contact-lens-help">
                                    Choose Spherical, Toric, or Multifocal. You can leave this blank.
                                </p>
                                <div className="cl-type-grid" role="group" aria-label="Contact lens type">
                                    {CONTACT_LENS_TYPES.map((t) => {
                                        const selected = contactLensType === t.id;
                                        const imgSrc = LENS_TYPE_IMAGES[t.id];
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                className={`cl-type-card${selected ? ' is-selected' : ''}`}
                                                onClick={() => toggleLensType(t.id)}
                                                aria-pressed={selected}
                                            >
                                                <span className="cl-type-card-media" aria-hidden>
                                                    <img src={imgSrc} alt="" className="cl-type-card-img" />
                                                </span>
                                                <span className="cl-type-card-text">
                                                    <span className="cl-type-card-label">{t.label}</span>
                                                    <span className="cl-type-card-desc">{t.description}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="form-group contact-lens-schedule-section">
                                <label>Replacement schedule (optional)</label>
                                <p className="contact-lens-help">
                                    How often the lenses are replaced. Optional — leave blank if not needed.
                                </p>
                                <div className="cl-schedule-row" role="group" aria-label="Replacement schedule">
                                    {CONTACT_LENS_REPLACEMENT_SCHEDULES.map((s) => {
                                        const selected = replacementSchedule === s.id;
                                        return (
                                            <button
                                                key={s.id}
                                                type="button"
                                                className={`cl-schedule-chip${selected ? ' is-selected' : ''}`}
                                                onClick={() => toggleSchedule(s.id)}
                                                aria-pressed={selected}
                                            >
                                                <Calendar size={16} aria-hidden />
                                                {s.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="form-group contact-lens-pack-section">
                                <label>Pack size (optional)</label>
                                <p className="contact-lens-help">
                                    Select a pack size, or choose Custom to enter your own count.
                                </p>
                                <div className="cl-pack-row" role="group" aria-label="Pack size">
                                    {CONTACT_LENS_PACK_SIZES.map((p) => {
                                        const selected = packSize === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                className={`cl-pack-chip${selected ? ' is-selected' : ''}`}
                                                onClick={() => selectPackSize(p.id)}
                                                aria-pressed={selected}
                                            >
                                                <Package size={16} aria-hidden />
                                                {p.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {showCustomPackInput && (
                                    <div className="cl-custom-pack">
                                        <label htmlFor="cl-custom-pack-count">Custom pack count</label>
                                        <input
                                            id="cl-custom-pack-count"
                                            type="number"
                                            min="1"
                                            step="1"
                                            placeholder="e.g. 12"
                                            value={customPackCount}
                                            onChange={(e) =>
                                                setCustomPackCount && setCustomPackCount(e.target.value)
                                            }
                                        />
                                        <span className="cl-custom-pack-hint">Number of lenses in the pack</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {showVolumeForContact && (
                <ContactLensVariantFields rows={contactLensRows} setRows={setContactLensRows} />
            )}

            {showLegacyVolume && (
                <ContactLensVariantFields rows={contactLensRows} setRows={setContactLensRows} />
            )}
        </>
    );
}
