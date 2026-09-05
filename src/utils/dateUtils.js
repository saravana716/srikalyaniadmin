const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Format a Date to "YYYY-MM-DD HH:mm:ss" in IST (Indian Standard Time, UTC+5:30).
 * @param {Date} date
 * @returns {string}
 */
function formatDateToISTString(date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  const h = String(ist.getUTCHours()).padStart(2, '0');
  const min = String(ist.getUTCMinutes()).padStart(2, '0');
  const s = String(ist.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * Get current date/time as IST string "YYYY-MM-DD HH:mm:ss" (for storing joined date etc.).
 * @returns {string}
 */
export function getCurrentISTString() {
  return formatDateToISTString(new Date());
}

/**
 * Convert a stored date string (UTC or "YYYY-MM-DD HH:mm:ss") to IST display string.
 * Use for displaying joinedDate, dueDate, etc. in Indian Standard Time.
 * @param {string} dateStr - e.g. "2026-02-05 15:25:20" (UTC) or ISO string
 * @returns {string} "YYYY-MM-DD HH:mm:ss" in IST, or "—" if invalid
 */
export function formatToIST(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '—';
  const s = dateStr.trim();
  if (!s) return '—';
  // Treat "YYYY-MM-DD HH:mm:ss" as UTC (no Z)
  const iso = s.includes('T') || s.includes('Z') || s.includes('+') || s.includes('-', 10)
    ? s
    : s.replace(' ', 'T') + 'Z';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return dateStr;
  return formatDateToISTString(date);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Common formatter for Paid Date across all tables, cards, modals, and receipts.
 * Returns "DD MMM YYYY, hh:mm A" if time is available (e.g. "04 Sep 2026, 11:41 AM"),
 * or "DD MMM YYYY" if time is not available (e.g. "04 Sep 2026").
 * 
 * @param {string|Date|object|number} input - Date string, Date instance, Firestore Timestamp, or payment row object
 * @param {object} [options]
 * @param {boolean} [options.dateOnly=false] - If true, force DD MMM YYYY without time
 * @returns {string} Formatted date string, or '—' if invalid/empty
 */
export function formatPaidDate(input, options = {}) {
  if (!input) return '—';

  // If a payment or transaction row object is passed
  let value = input;
  if (
    typeof input === 'object' &&
    !(input instanceof Date) &&
    typeof input.toDate !== 'function' &&
    input.seconds == null
  ) {
    const rawPaid = input.paidDate;
    const rawCreated = input.createdAt;
    if (rawPaid && typeof rawPaid === 'string' && rawPaid.trim().length > 10) {
      value = rawPaid;
    } else if (rawCreated) {
      value = rawCreated;
    } else {
      value = rawPaid || input.dueDate;
    }
    if (!value) return '—';
  }

  // Handle Firestore Timestamp object
  if (typeof value?.toDate === 'function') {
    value = value.toDate();
  } else if (value?.seconds != null && typeof value.seconds === 'number') {
    value = new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1e6);
  }

  // Handle pure JS Date object
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '—';
    return formatDateObject(value, options.dateOnly);
  }

  // Handle numeric milliseconds
  if (typeof value === 'number') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return formatDateObject(d, options.dateOnly);
  }

  // Handle string values
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s || s === '—' || s === 'N/A' || s === 'undefined' || s === 'null') return '—';

    // Check pure date: "YYYY-MM-DD"
    const ymdMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10) - 1;
      const d = parseInt(ymdMatch[3], 10);
      const dStr = String(d).padStart(2, '0');
      const mStr = MONTH_NAMES[m] || '';
      return `${dStr} ${mStr} ${y}`;
    }

    // Check pure date: "DD-MM-YYYY" or "DD/MM/YYYY"
    const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const y = parseInt(dmyMatch[3], 10);
      const dStr = String(d).padStart(2, '0');
      const mStr = MONTH_NAMES[m] || '';
      return `${dStr} ${mStr} ${y}`;
    }

    // Check "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm" (assumed already IST or local)
    const dtMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (dtMatch && !s.includes('Z') && !s.includes('+') && !s.includes('-', 10)) {
      const y = parseInt(dtMatch[1], 10);
      const m = parseInt(dtMatch[2], 10) - 1;
      const d = parseInt(dtMatch[3], 10);
      const rawHour = parseInt(dtMatch[4], 10);
      const min = parseInt(dtMatch[5], 10);

      const dStr = String(d).padStart(2, '0');
      const mStr = MONTH_NAMES[m] || '';
      if (options.dateOnly) {
        return `${dStr} ${mStr} ${y}`;
      }
      const ampm = rawHour >= 12 ? 'PM' : 'AM';
      let hour12 = rawHour % 12;
      if (hour12 === 0) hour12 = 12;
      const hStr = String(hour12).padStart(2, '0');
      const minStr = String(min).padStart(2, '0');
      return `${dStr} ${mStr} ${y}, ${hStr}:${minStr} ${ampm}`;
    }

    // Otherwise parse ISO or other date formats with Date constructor
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateObject(parsed, options.dateOnly);
    }

    return s;
  }

  return '—';
}

function formatDateObject(date, dateOnly = false) {
  // Convert UTC to IST (+5.5 hours)
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const d = String(ist.getUTCDate()).padStart(2, '0');
  const m = MONTH_NAMES[ist.getUTCMonth()] || '';
  const y = ist.getUTCFullYear();

  if (dateOnly) {
    return `${d} ${m} ${y}`;
  }

  let h = ist.getUTCHours();
  const min = String(ist.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const hStr = String(h).padStart(2, '0');

  return `${d} ${m} ${y}, ${hStr}:${min} ${ampm}`;
}

