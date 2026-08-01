/** Resolve Firestore Timestamp, { seconds }, or Date to Date or null */
export function coerceFirestoreDate(value) {
    if (value == null) return null;
    if (typeof value.toDate === 'function') {
        try {
            return value.toDate();
        } catch {
            return null;
        }
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000);
    }
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}

/** Locale + options so admin UI always shows 12-hour clock (not 24-hour). */
const DISPLAY_LOCALE = 'en-IN';

const DATE_TIME_TABLE = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
};

const DATE_TIME_FULL = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
};

/** Shorter string for table cells */
export function formatTimestampShort(value) {
    const d = coerceFirestoreDate(value);
    if (d) {
        return d.toLocaleString(DISPLAY_LOCALE, DATE_TIME_TABLE);
    }
    if (value != null && typeof value !== 'object') return formatTimestamp(value);
    return '—';
}

/** Format Firestore Timestamp, Date, ISO string, or number for display */
export function formatTimestamp(value) {
    const d = coerceFirestoreDate(value);
    if (d) return d.toLocaleString(DISPLAY_LOCALE, DATE_TIME_FULL);
    if (value == null) return '—';
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime())
            ? value
            : parsed.toLocaleString(DISPLAY_LOCALE, DATE_TIME_FULL);
    }
    return String(value);
}

export function formatRupee(amount) {
    if (amount == null || amount === '') return '—';
    const n = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) : Number(amount);
    if (Number.isNaN(n)) return String(amount);
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function getOrderLineItems(order) {
    const raw = order.items || order.cartItems || order.lineItems || order.products || order.orderItems;
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item) => {
        if (item == null) return { name: 'Item', qty: 1, price: null };
        if (typeof item === 'string') return { name: item, qty: 1, price: null };
        const name =
            item.name ||
            item.title ||
            item.productName ||
            item.product?.name ||
            (typeof item.product === 'string' ? item.product : null) ||
            'Item';
        const qty = item.quantity ?? item.qty ?? item.count ?? 1;
        // Prefer line total for admin “Amount” column; fall back to unit price
        const price =
            item.totalPrice ??
            item.total ??
            item.price ??
            item.unitPrice ??
            item.amount ??
            item.productPrice;
        return { name, qty, price, sku: item.sku || item.variantId || item.id, raw: item };
    });
}

export function orderItemsSummary(order) {
    const lines = getOrderLineItems(order);
    if (lines.length === 0) {
        const fallback = order.productName || order.title || order.name;
        return { text: fallback || '—', count: order.productName || order.title ? 1 : 0 };
    }
    const count = lines.reduce((a, l) => a + (Number(l.qty) || 1), 0);
    const text = lines.length === 1 ? lines[0].name : `${lines[0].name} +${lines.length - 1} more`;
    return { text, count };
}

export function stringifyAddress(addr) {
    if (addr == null) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr !== 'object') return String(addr);
    const name = addr.fullName;
    const contact = [addr.email, addr.phone].filter(Boolean).join(' · ');
    const street = addr.address || addr.line1 || addr.addressLine1 || addr.street;
    const cityLine = [addr.city, addr.state, addr.zip || addr.pincode || addr.postalCode]
        .filter(Boolean)
        .join(', ');
    const legacy = [
        addr.line2 || addr.addressLine2,
        addr.country,
    ].filter(Boolean);
    const parts = [name, contact, street, cityLine, ...legacy].filter(Boolean);
    return parts.length ? parts.join('\n') : JSON.stringify(addr, null, 2);
}

/** Customer display name from VisionKart order documents */
export function getOrderCustomerName(order) {
    if (!order || typeof order !== 'object') return '—';
    const ship = order.shippingAddress;
    const bill = order.billingAddress;
    return (
        order.customerName ||
        (ship && ship.fullName) ||
        (bill && bill.fullName) ||
        (ship && ship.email) ||
        (bill && bill.email) ||
        '—'
    );
}

/** Total amount number or string for rupee formatting */
export function getOrderTotalValue(order) {
    if (!order || typeof order !== 'object') return null;
    const fromAmounts = order.amounts && typeof order.amounts === 'object' ? order.amounts.total : undefined;
    return fromAmounts ?? order.totalAmount ?? order.total ?? order.price ?? null;
}

/** Flat string for search (id, names, emails, phones) */
export function getOrderSearchBlob(order) {
    if (!order) return '';
    const parts = [
        order.id,
        order.status,
        order.fulfillmentStatus,
        order.userId,
        order.customerName,
        order.customerEmail,
        order.email,
        order.phone,
        order.phoneNumber,
        order.orderNumber,
        order.paymentId,
        order.transactionId,
    ];
    const nest = (o) => {
        if (!o || typeof o !== 'object') return;
        parts.push(o.fullName, o.email, o.phone, o.city, o.state, o.zip, o.address);
    };
    nest(order.shippingAddress);
    nest(order.billingAddress);
    const items = getOrderLineItems(order);
    items.forEach((i) => parts.push(i.name, i.sku));
    return parts.filter(Boolean).join(' ').toLowerCase();
}

/** Display name from a `users` (or profile) document — supports common field shapes */
export function getUserDisplayName(u) {
    if (!u || typeof u !== 'object') return '';
    const joined = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return (
        u.name ||
        u.displayName ||
        u.fullName ||
        joined ||
        u.username ||
        ''
    );
}

export function getUserEmail(u) {
    if (!u || typeof u !== 'object') return '';
    return String(u.email || u.userEmail || '').trim();
}

export function getUserPhone(u) {
    if (!u || typeof u !== 'object') return '';
    return String(u.phone || u.phoneNumber || u.mobile || '').trim();
}

/** Single-line address from string or nested objects on user docs */
export function getUserAddressSummary(u) {
    if (!u || typeof u !== 'object') return '';
    if (typeof u.address === 'string') return u.address;
    if (u.address && typeof u.address === 'object') return stringifyAddress(u.address);
    if (u.defaultAddress && typeof u.defaultAddress === 'object') return stringifyAddress(u.defaultAddress);
    if (u.shippingAddress && typeof u.shippingAddress === 'object') return stringifyAddress(u.shippingAddress);
    if (Array.isArray(u.savedAddresses) && u.savedAddresses[0]) {
        const a = u.savedAddresses[0];
        return typeof a === 'object' ? stringifyAddress(a) : String(a);
    }
    return '';
}

export function getUserCreatedAt(u) {
    if (!u || typeof u !== 'object') return null;
    return u.createdAt ?? u.created_at ?? u.joinedAt ?? u.registeredAt ?? null;
}

export function getUserSearchBlob(u) {
    if (!u) return '';
    const parts = [
        u.id,
        getUserDisplayName(u),
        getUserEmail(u),
        getUserPhone(u),
        u.uid,
        u.username,
        u.role,
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Search text for an order plus linked `users` profile (by order.userId).
 */
export function getOrderSearchBlobWithUser(order, user) {
    const base = getOrderSearchBlob(order);
    if (!user) return base;
    return `${base} ${getUserSearchBlob(user)}`.trim().toLowerCase();
}

/**
 * Normalized lifecycle bucket for filters: pending | shipped | delivered | cancelled
 * Combines `status` and `fulfillmentStatus` (e.g. Ordered + Invoice Generated → pending).
 */
export function getOrderLifecycleBucket(order) {
    if (!order || typeof order !== 'object') return 'pending';
    const s = (order.status || '').toLowerCase().trim();
    const f = (order.fulfillmentStatus || '').toLowerCase().trim();
    const blob = `${s} ${f}`.trim();

    if (/cancel|cancell|return|refund/.test(blob)) return 'cancelled';
    if (/\bdelivered\b|^completed$/.test(blob) || s === 'delivered' || s === 'completed') return 'delivered';
    // In-transit / shipped: status "Shipping" or "Shipped" (regex used to miss "Shipping" when blob was "shipping " or "shipping …")
    if (
        s === 'shipping' ||
        s === 'shipped' ||
        /shipped|dispatch|in transit|out for delivery|packed/.test(blob)
    ) {
        return 'shipped';
    }
    return 'pending';
}

export function collectPrimitiveEntries(obj, excludeKeys = new Set()) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).filter(([k, v]) => {
        if (excludeKeys.has(k)) return false;
        if (v == null) return true;
        const t = typeof v;
        if (t === 'string' || t === 'number' || t === 'boolean') return true;
        if (v?.toDate) return true;
        return false;
    });
}
