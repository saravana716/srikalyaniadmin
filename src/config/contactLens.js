/** Legacy frame-type value; product view still checks this for old documents. */
export const CONTACT_LENS_FRAME_TYPE = 'Contact Lens';

/**
 * True when Product Category is a contact-lens category (Firestore category name).
 * Matches "Contact Lenses", "Contact Lens", or any name containing both "contact" and "lens".
 */
export function isContactLensesCategory(category) {
    if (category == null || typeof category !== 'string') return false;
    const n = category.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!n) return false;
    if (n === 'contact lenses' || n === 'contact lens') return true;
    return n.includes('contact') && n.includes('lens');
}

export const CONTACT_LENS_VOLUME_PRESETS = [
    { label: '90 ml', value: '90' },
    { label: '100 ml', value: '100' },
    { label: '120 ml', value: '120' },
    { label: '180 ml', value: '180' },
    { label: '240 ml', value: '240' },
    { label: '360 ml', value: '360' },
    { label: '500 ml', value: '500' },
    { label: 'Other (enter ml)', value: 'custom' },
];

const PRESET_ML = new Set(
    CONTACT_LENS_VOLUME_PRESETS.filter((p) => p.value !== 'custom').map((p) => p.value)
);

export function emptyContactLensRow() {
    return { preset: '', customMl: '', price: '' };
}

/** Matches subcategory names like "Solution", "Solutions", "Lens Solution", etc. */
export function isSolutionSubcategory(name) {
    const n = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!n) return false;
    if (n === 'solution' || n === 'solutions') return true;
    return /\bsolutions?\b/.test(n);
}

/** Matches "Color Lenses", "Colour Lens", "color contact lenses", etc. */
export function isColorLensesSubcategory(name) {
    const n = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!n) return false;
    if (n === 'color lenses' || n === 'colour lenses' || n === 'color lens' || n === 'colour lens') {
        return true;
    }
    const hasColor = n.includes('color') || n.includes('colour');
    const hasLens = n.includes('lens');
    return hasColor && hasLens;
}

/** Prefer the real Firestore subcategory label when inferring legacy products. */
export function findSolutionSubcategoryName(subcategories) {
    const match = (subcategories || []).find((s) => isSolutionSubcategory(s?.name));
    return match?.name || 'Solutions';
}

/** Contact lens type cards (Spherical / Toric / Multifocal) — optional, Color Lenses only. */
export const CONTACT_LENS_TYPES = [
    {
        id: 'spherical',
        label: 'Spherical',
        description: 'For near and far sightedness.',
    },
    {
        id: 'toric',
        label: 'Toric',
        description: 'For astigmatism.',
    },
    {
        id: 'multifocal',
        label: 'Multifocal',
        description: 'For presbyopia.',
    },
];

/** Replacement schedule chips — optional, Color Lenses only. */
export const CONTACT_LENS_REPLACEMENT_SCHEDULES = [
    { id: 'daily', label: 'Daily Disposable' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
];

/** Pack size chips — optional, Color Lenses only. Last option is Custom. */
export const CONTACT_LENS_PACK_SIZE_CUSTOM = 'custom';

export const CONTACT_LENS_PACK_SIZES = [
    { id: '1', label: '1 Lens' },
    { id: '3', label: '3 Pack' },
    { id: '5', label: '5 Pack' },
    { id: '6', label: '6 Pack' },
    { id: '10', label: '10 Pack' },
    { id: '30', label: '30 Pack' },
    { id: '90', label: '90 Pack' },
    { id: CONTACT_LENS_PACK_SIZE_CUSTOM, label: 'Custom' },
];

const PRESET_PACK_SIZE_IDS = new Set(
    CONTACT_LENS_PACK_SIZES.filter((p) => p.id !== CONTACT_LENS_PACK_SIZE_CUSTOM).map((p) => p.id)
);

/** Map stored Firestore pack size → form chip + optional custom count. */
export function packSizeToFormState(stored) {
    const raw = stored == null || stored === '' ? '' : String(stored).trim();
    if (!raw) return { packSize: '', customPackCount: '' };
    if (PRESET_PACK_SIZE_IDS.has(raw)) return { packSize: raw, customPackCount: '' };
    if (raw.toLowerCase() === CONTACT_LENS_PACK_SIZE_CUSTOM) {
        return { packSize: CONTACT_LENS_PACK_SIZE_CUSTOM, customPackCount: '' };
    }
    // Legacy / custom numeric count
    return { packSize: CONTACT_LENS_PACK_SIZE_CUSTOM, customPackCount: raw };
}

/** Resolve form pack chip + custom count → value to save (empty if none). */
export function resolvePackSizeForSave(packSize, customPackCount) {
    const chip = String(packSize || '').trim();
    if (!chip) return '';
    if (chip === CONTACT_LENS_PACK_SIZE_CUSTOM) {
        const n = String(customPackCount ?? '').trim();
        return n || '';
    }
    return chip;
}

/** Reset contact-lens form fields when leaving the contact-lens category. */
export function resetContactLensFormState({
    setSubcategory,
    setVolumeRows,
    setLensType,
    setReplacementSchedule,
    setPackSize,
    setCustomPackCount,
} = {}) {
    if (typeof setSubcategory === 'function') setSubcategory('');
    if (typeof setVolumeRows === 'function') setVolumeRows([emptyContactLensRow()]);
    if (typeof setLensType === 'function') setLensType('');
    if (typeof setReplacementSchedule === 'function') setReplacementSchedule('');
    if (typeof setPackSize === 'function') setPackSize('');
    if (typeof setCustomPackCount === 'function') setCustomPackCount('');
}

/**
 * Attach optional contact-lens fields to a product payload.
 * @param {object} [opts.deleteField] — Firestore deleteField() for EditProduct clears
 */
export function applyContactLensProductPayload(payload, opts) {
    const {
        category,
        frameType,
        subcategory,
        volumeRows,
        lensType,
        replacementSchedule,
        packSize,
        customPackCount,
        deleteField,
    } = opts;
    const isContact = isContactLensesCategory(category);
    const legacyVolume = !isContact && frameType === CONTACT_LENS_FRAME_TYPE;

    if (!isContact && !legacyVolume) {
        if (deleteField) {
            payload.contactLensSubcategory = deleteField();
            payload.contactLensVariants = deleteField();
            payload.contactLensPacks = deleteField();
            payload.contactLensType = deleteField();
            payload.contactLensReplacementSchedule = deleteField();
            payload.contactLensPackSize = deleteField();
        }
        return;
    }

    if (isContact) {
        const sub = String(subcategory || '').trim();
        const variants = buildValidContactLensVariants(volumeRows);

        if (sub) payload.contactLensSubcategory = sub;
        else if (deleteField) payload.contactLensSubcategory = deleteField();

        if (sub && isSolutionSubcategory(sub)) {
            if (variants.length) payload.contactLensVariants = variants;
            else if (deleteField) payload.contactLensVariants = deleteField();
            if (deleteField) {
                payload.contactLensType = deleteField();
                payload.contactLensReplacementSchedule = deleteField();
                payload.contactLensPackSize = deleteField();
                payload.contactLensPacks = deleteField();
            }
        } else if (sub && isColorLensesSubcategory(sub)) {
            const type = String(lensType || '').trim();
            const schedule = String(replacementSchedule || '').trim();
            const size = resolvePackSizeForSave(packSize, customPackCount);

            if (type) payload.contactLensType = type;
            else if (deleteField) payload.contactLensType = deleteField();

            if (schedule) payload.contactLensReplacementSchedule = schedule;
            else if (deleteField) payload.contactLensReplacementSchedule = deleteField();

            if (size) payload.contactLensPackSize = size;
            else if (deleteField) payload.contactLensPackSize = deleteField();

            if (deleteField) {
                payload.contactLensVariants = deleteField();
                payload.contactLensPacks = deleteField();
            }
        } else if (deleteField) {
            payload.contactLensVariants = deleteField();
            payload.contactLensPacks = deleteField();
            payload.contactLensType = deleteField();
            payload.contactLensReplacementSchedule = deleteField();
            payload.contactLensPackSize = deleteField();
        }
        return;
    }

    if (legacyVolume) {
        const variants = buildValidContactLensVariants(volumeRows);
        if (variants.length) payload.contactLensVariants = variants;
        else if (deleteField) payload.contactLensVariants = deleteField();
    }
}

/** Build volume/price options; skips fully empty rows. Volume or price may be filled alone. */
export function buildValidContactLensVariants(rows) {
    const out = [];
    for (const r of rows) {
        const preset = String(r.preset ?? '').trim();
        const ml =
            preset === 'custom'
                ? parseInt(String(r.customMl ?? '').trim(), 10)
                : preset
                  ? parseInt(preset, 10)
                  : NaN;
        const priceRaw = String(r.price ?? '').trim();
        const price = priceRaw === '' ? null : parseFloat(priceRaw);
        const hasMl = Number.isFinite(ml) && ml > 0;
        const hasPrice = Number.isFinite(price) && price >= 0;
        if (!hasMl && !hasPrice) continue;
        const item = {};
        if (hasMl) item.volumeMl = ml;
        if (hasPrice) item.price = price;
        out.push(item);
    }
    return out;
}

/** Firestore variants → form rows for edit. */
export function variantsToRows(variants) {
    if (!variants?.length) return [emptyContactLensRow()];
    return variants.map((v) => {
        const ml = Number(v.volumeMl);
        if (!Number.isFinite(ml) || ml <= 0) {
            return {
                preset: '',
                customMl: '',
                price: v.price != null && v.price !== '' ? String(v.price) : '',
            };
        }
        const key = String(ml);
        const preset = PRESET_ML.has(key) ? key : 'custom';
        return {
            preset,
            customMl: preset === 'custom' ? String(ml) : '',
            price: v.price != null && v.price !== '' ? String(v.price) : '',
        };
    });
}

/** Human-readable label for stored contactLensType id. */
export function formatContactLensTypeLabel(typeId) {
    const id = String(typeId || '').trim().toLowerCase();
    if (!id) return '';
    const match = CONTACT_LENS_TYPES.find((t) => t.id === id);
    return match?.label || String(typeId);
}

/** Human-readable label for stored replacement schedule id. */
export function formatReplacementScheduleLabel(scheduleId) {
    const id = String(scheduleId || '').trim().toLowerCase();
    if (!id) return '';
    const match = CONTACT_LENS_REPLACEMENT_SCHEDULES.find((s) => s.id === id);
    return match?.label || String(scheduleId);
}

/** Human-readable pack size (preset chip or custom count). */
export function formatPackSizeLabel(stored) {
    const raw = stored == null || stored === '' ? '' : String(stored).trim();
    if (!raw) return '';
    const preset = CONTACT_LENS_PACK_SIZES.find((p) => p.id === raw && p.id !== CONTACT_LENS_PACK_SIZE_CUSTOM);
    if (preset) return preset.label;
    return `${raw} Pack`;
}

/** True when product has any contact-lens-specific Firestore fields. */
export function hasContactLensDetails(product) {
    if (!product || typeof product !== 'object') return false;
    if (product.contactLensSubcategory) return true;
    if (product.contactLensType) return true;
    if (product.contactLensReplacementSchedule) return true;
    if (product.contactLensPackSize != null && product.contactLensPackSize !== '') return true;
    if (Array.isArray(product.contactLensVariants) && product.contactLensVariants.length > 0) return true;
    if (Array.isArray(product.contactLensPacks) && product.contactLensPacks.length > 0) return true;
    return false;
}

/** Short line for product table under category. */
export function getContactLensTableHint(product) {
    if (!product) return '';
    const parts = [];
    if (product.contactLensSubcategory) parts.push(product.contactLensSubcategory);
    const type = formatContactLensTypeLabel(product.contactLensType);
    if (type) parts.push(type);
    const pack = formatPackSizeLabel(product.contactLensPackSize);
    if (pack) parts.push(pack);
    return parts.join(' · ');
}

/** Search blob for contact-lens fields (used by Products search). */
export function getContactLensSearchText(product) {
    if (!product) return '';
    return [
        product.contactLensSubcategory,
        formatContactLensTypeLabel(product.contactLensType),
        product.contactLensType,
        formatReplacementScheduleLabel(product.contactLensReplacementSchedule),
        product.contactLensReplacementSchedule,
        formatPackSizeLabel(product.contactLensPackSize),
        product.contactLensPackSize,
        ...(Array.isArray(product.contactLensVariants)
            ? product.contactLensVariants.flatMap((v) => [v.volumeMl, v.price])
            : []),
    ]
        .filter((x) => x != null && String(x).trim() !== '')
        .join(' ')
        .toLowerCase();
}
