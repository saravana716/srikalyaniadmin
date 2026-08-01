/**
 * Delhivery Express / Delhivery One — create forward shipment via CMU order creation API.
 * @see https://delhivery-express-api-doc.readme.io/reference/order-creation-api
 * Production: POST https://track.delhivery.com/api/cmu/create.json
 * Body must be application/x-www-form-urlencoded with literal keys format=json and data=<json>.
 *
 * Browser calls use a same-origin proxy (Vite in dev, Vercel `/api/delhivery-shipment` in production).
 */

import { getOrderLineItems, getOrderTotalValue, coerceFirestoreDate } from './firestoreDisplay';

const DEFAULT_REMOTE_API_ROOT = 'https://track.delhivery.com/api';

/** Dev-only Vite proxy path (see vite.config.js) */
export const DELHIVERY_DEV_PROXY_PREFIX = '/__delhivery';

/** Production Vercel serverless proxy (see api/delhivery-shipment.js) */
export const DELHIVERY_SHIPMENT_API = '/api/delhivery-shipment';

/**
 * URL for CMU create shipment — dev uses Vite proxy path; production uses Vercel function.
 */
export function getDelhiveryCreateUrl() {
    if (typeof window !== 'undefined' && !import.meta.env.DEV) {
        return DELHIVERY_SHIPMENT_API;
    }
    return `${DELHIVERY_DEV_PROXY_PREFIX}/cmu/create.json`;
}

function normalizePhone10(phone) {
    if (phone == null) return '';
    const d = String(phone).replace(/\D/g, '');
    if (d.length >= 10) return d.slice(-10);
    return d;
}

function normalizePin6(pin) {
    if (pin == null) return '';
    const d = String(pin).replace(/\D/g, '');
    return d.slice(0, 6);
}

/**
 * Build shipping fields from a VisionKart order document.
 * @returns {{ ok: boolean, error?: string, name: string, phone: string, pin: string, city: string, state: string, country: string, add: string }}
 */
export function extractShippingForDelhivery(order) {
    if (!order || typeof order !== 'object') {
        return { ok: false, error: 'Invalid order', name: '', phone: '', pin: '', city: '', state: '', country: 'India', add: '' };
    }
    const a = order.shippingAddress || order.deliveryAddress || order.address || {};
    const pin = normalizePin6(a.zip ?? a.pincode ?? a.pin ?? a.postalCode ?? order.pincode);
    const phone = normalizePhone10(
        order.phone ?? order.phoneNumber ?? a.phone ?? a.mobile ?? order.customerPhone
    );
    const city = String(a.city || '').trim();
    const state = String(a.state || '').trim();
    const country = String(a.country || 'India').trim() || 'India';
    const name = String(a.fullName || order.customerName || 'Customer').trim() || 'Customer';
    const addrParts = [
        a.address || a.line1 || a.addressLine1,
        a.line2 || a.addressLine2,
        a.landmark,
    ].filter(Boolean);
    let add = addrParts.join(', ').trim();
    if (!add) add = String(a.address || '').trim();
    if (!add && typeof a === 'string') add = a;

    if (pin.length !== 6) {
        return { ok: false, error: 'Shipping address needs a valid 6-digit PIN code.', name, phone, pin, city, state, country, add };
    }
    if (phone.length !== 10) {
        return { ok: false, error: 'Need a valid 10-digit Indian mobile number on the order or shipping address.', name, phone, pin, city, state, country, add };
    }
    if (!add || add.length < 5) {
        return { ok: false, error: 'Shipping address line is missing or too short.', name, phone, pin, city, state, country, add };
    }
    return { ok: true, name, phone, pin, city, state, country, add };
}

function orderDateStr(order) {
    const d = coerceFirestoreDate(order.createdAt);
    if (d) return d.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
}

function isCodOrder(order) {
    const pm = `${order.paymentMethod || ''} ${order.paymentMode || ''}`.toLowerCase();
    if (pm.includes('cod') || pm.includes('cash on delivery')) return true;
    const mode = order.paymentMode || order.paymentMethod;
    if (mode && String(mode).toLowerCase() === 'cod') return true;
    return false;
}

/** Delhivery rejects raw &, #, %, ;, \\ in payload when not JSON-encoded — keep descriptions simple */
function sanitizeDelhiveryText(s) {
    return String(s || '')
        .replace(/[&%#;\\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function productsDesc(order) {
    const lines = getOrderLineItems(order);
    if (lines.length === 0) {
        return sanitizeDelhiveryText(order.productName || order.title || 'Products');
    }
    return sanitizeDelhiveryText(
        lines
            .map((l) => `${l.name} x${l.qty}`)
            .join(', ')
            .slice(0, 450)
    );
}

/**
 * Build Delhivery `data` JSON for CMU push (forward shipment).
 * @param {string} warehouseName — must match a pickup location / warehouse name in Delhivery dashboard
 * @param {string} [orderRefSuffix] — optional suffix if resubmitting
 */
export function buildDelhiveryCmuPayload(order, warehouseName, orderRefSuffix = '') {
    const ship = extractShippingForDelhivery(order);
    if (!ship.ok) {
        return { error: ship.error };
    }
    const total = parseFloat(getOrderTotalValue(order)) || 0;
    const cod = isCodOrder(order);
    const totalStr = String(Math.round(total * 100) / 100);
    const codStr = cod ? totalStr : '';
    const paymentMode = cod ? 'COD' : 'Pre-paid';
    const orderRef = `${order.id}${orderRefSuffix}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);

    const shipment = {
        name: sanitizeDelhiveryText(ship.name),
        add: sanitizeDelhiveryText(ship.add),
        pin: ship.pin,
        city: sanitizeDelhiveryText(ship.city || 'NA') || 'NA',
        state: sanitizeDelhiveryText(ship.state || 'NA') || 'NA',
        country: sanitizeDelhiveryText(ship.country) || 'India',
        phone: ship.phone,
        order: orderRef,
        order_date: orderDateStr(order),
        payment_mode: paymentMode,
        cod_amount: codStr,
        total_amount: totalStr,
        weight: String(order.packageWeightKg != null ? Number(order.packageWeightKg) : 0.5),
        products_desc: productsDesc(order),
        quantity: '1',
    };

    return {
        payload: {
            shipments: [shipment],
            pickup_location: { name: warehouseName.trim() },
        },
    };
}

/**
 * POST /cmu/create.json — official order manifestation API.
 * Delhivery requires the raw POST body to include the keys `format` and `data` (not JSON-only body).
 */
export async function createDelhiveryShipment({ apiToken, apiBaseRoot, warehouseName, order, orderRefSuffix = '' }) {
    if (!apiToken || !String(apiToken).trim()) {
        throw new Error('Delhivery API token is not configured (Settings → Delhivery).');
    }
    if (!warehouseName || !String(warehouseName).trim()) {
        throw new Error('Delhivery warehouse / pickup name is not configured.');
    }
    const built = buildDelhiveryCmuPayload(order, warehouseName, orderRefSuffix);
    if (built.error) {
        throw new Error(built.error);
    }
    const url = getDelhiveryCreateUrl();

    const dataJson = JSON.stringify(built.payload);
    const bodyStr = `format=json&data=${encodeURIComponent(dataJson)}`;

    const useVercelProxy = url === DELHIVERY_SHIPMENT_API;

    const res = await fetch(url, {
        method: 'POST',
        headers: useVercelProxy
            ? {
                  Authorization: `Token ${apiToken.trim()}`,
                  'Content-Type': 'application/json',
              }
            : {
                  Authorization: `Token ${apiToken.trim()}`,
                  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              },
        body: useVercelProxy
            ? JSON.stringify({
                  formBody: bodyStr,
                  upstreamBase: (apiBaseRoot || DEFAULT_REMOTE_API_ROOT).replace(/\/$/, ''),
              })
            : bodyStr,
    });

    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(text.slice(0, 400) || `HTTP ${res.status}`);
    }

    return parseDelhiveryCreateResponse(json, res.ok);
}

/**
 * @returns {{ success: boolean, waybill?: string, message?: string, raw: object }}
 */
export function parseDelhiveryCreateResponse(json, httpOk = true) {
    const raw = json && typeof json === 'object' ? json : {};
    if (typeof raw.error === 'string' && raw.error.trim()) {
        return { success: false, message: raw.error.trim(), raw };
    }
    const packages = raw.packages;
    if (Array.isArray(packages) && packages.length > 0) {
        const first = packages[0];
        const waybill = first.waybill || first.Waybill || first.wbn || first.lrnum || first.refnum;
        const err =
            first.error ||
            first.Error ||
            (first.remarks && first.remarks[0]) ||
            first.rmk;
        if (waybill && !err) {
            return { success: true, waybill: String(waybill), raw };
        }
        if (err) {
            return { success: false, message: String(err), raw };
        }
    }
    if (raw.success === true && raw.upload_wbn) {
        const w = Array.isArray(raw.upload_wbn) ? raw.upload_wbn[0] : raw.upload_wbn;
        if (w) return { success: true, waybill: String(w), raw };
    }
    if (raw.rmk && String(raw.rmk).toLowerCase().includes('success')) {
        return { success: true, message: String(raw.rmk), raw };
    }
    const msg =
        raw.rmk ||
        raw.message ||
        (typeof raw.error === 'object' && raw.error != null ? JSON.stringify(raw.error) : '') ||
        (!httpOk ? `HTTP error` : 'Unexpected response from Delhivery');
    return { success: false, message: String(msg), raw };
}

/**
 * Turn Delhivery API errors into clear admin-facing text (billing, balance, etc.).
 * "Insufficient balance" is a Delhivery wallet issue, not an app bug.
 */
export function formatDelhiveryUserMessage(apiMessage) {
    const raw = String(apiMessage || '').trim();
    const lower = raw.toLowerCase();

    if (
        lower.includes('insufficient balance') ||
        lower.includes('manifest charge') ||
        lower.includes('prepaid client manifest')
    ) {
        return [
            'Delhivery blocked this shipment: your prepaid Delhivery account does not have enough wallet balance to charge the manifest fee.',
            '',
            'What to do: open Delhivery One → Wallet / Billing / Recharge and add funds, then try "Send to Delhivery" again.',
            '',
            'Your order in VisionKart is unchanged unless you already saw a success message with a waybill.',
        ].join('\n');
    }

    if (lower.includes('pickup') && (lower.includes('warehouse') || lower.includes('location'))) {
        return `${raw}\n\nCheck Settings → Delhivery: warehouse name must match Delhivery exactly (case-sensitive).`;
    }

    return raw || 'Delhivery request failed.';
}
