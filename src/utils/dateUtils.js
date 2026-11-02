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
 * Convert any date input (ISO string, "DD MMM YYYY, hh:mm A", "DD-MM-YYYY", Timestamp, Date)
 * to a standard "YYYY-MM-DD" string for HTML <input type="date" />.
 * @param {any} input
 * @returns {string} "YYYY-MM-DD"
 */
export function toISODateString(input) {
  if (!input) return new Date().toISOString().slice(0, 10);
  if (typeof input?.toDate === 'function') {
    const d = input.toDate();
    if (!Number.isNaN(d.getTime())) return formatDateToISTDateOnly(d);
  }
  if (input?.seconds != null && typeof input.seconds === 'number') {
    const d = new Date(input.seconds * 1000);
    if (!Number.isNaN(d.getTime())) return formatDateToISTDateOnly(d);
  }
  if (input instanceof Date) {
    if (!Number.isNaN(input.getTime())) return formatDateToISTDateOnly(input);
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s || s === '—') return new Date().toISOString().slice(0, 10);

    // 1. YYYY-MM-DD (with optional time)
    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
      return `${ymd[1]}-${String(ymd[2]).padStart(2, '0')}-${String(ymd[3]).padStart(2, '0')}`;
    }

    // 2. DD-MM-YYYY or DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) {
      return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
    }

    // 3. DD MMM YYYY (e.g. "12 Sep 2026" or "13 Sep 2026, 07:42 PM")
    const ddMmmYyyy = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
    if (ddMmmYyyy) {
      const day = String(ddMmmYyyy[1]).padStart(2, '0');
      const mIdx = MONTH_NAMES.findIndex(
        (m) => m.toLowerCase() === ddMmmYyyy[2].toLowerCase()
      );
      if (mIdx !== -1) {
        const month = String(mIdx + 1).padStart(2, '0');
        return `${ddMmmYyyy[3]}-${month}-${day}`;
      }
    }

    // 4. Fallback Date parse
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateToISTDateOnly(parsed);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function formatDateToISTDateOnly(d) {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
    // Always prioritize the actual paid date or due date over database insert timestamp (createdAt)
    if (rawPaid && String(rawPaid).trim() && String(rawPaid).trim() !== '—') {
      value = rawPaid;
    } else if (input.dueDate && String(input.dueDate).trim() && String(input.dueDate).trim() !== '—') {
      value = input.dueDate;
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

/**
 * Add N days to a YYYY-MM-DD or ISO date string and return YYYY-MM-DD.
 * @param {string|Date} dateInput
 * @param {number} days
 * @returns {string} YYYY-MM-DD
 */
export function addDaysToDate(dateInput, days) {
  let d;
  if (!dateInput) {
    d = new Date();
  } else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const parts = dateInput.trim().split('-');
    d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  } else {
    d = new Date(dateInput);
  }
  if (Number.isNaN(d.getTime())) d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Add N months to a YYYY-MM-DD or ISO date string and return YYYY-MM-DD.
 * @param {string|Date} dateInput
 * @param {number} months
 * @returns {string} YYYY-MM-DD
 */
export function addMonthsToDate(dateInput, months) {
  let d;
  if (!dateInput) {
    d = new Date();
  } else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const parts = dateInput.trim().split('-');
    d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  } else {
    d = new Date(dateInput);
  }
  if (Number.isNaN(d.getTime())) d = new Date();
  d.setMonth(d.getMonth() + Number(months || 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Generate installment schedule breakdown from a paid lump sum amount.
 * @param {object} params
 * @param {number} params.totalAmount - Total amount paid (e.g. 2000)
 * @param {number} params.installmentAmount - Daily or monthly installment amount (e.g. 200 or 100)
 * @param {'Daily'|'Monthly'|'Weekly'} [params.frequency='Daily']
 * @param {string} [params.startDate] - Payment start date "YYYY-MM-DD"
 * @param {string} [params.mode='Cash'] - Payment mode
 * @returns {Array<{ installmentNo: string, index: number, dueDate: string, paidDate: string, amount: number, mode: string, status: string }>}
 */
export function generateInstallmentSchedule({
  totalAmount,
  installmentAmount,
  frequency = 'Daily',
  startDate = new Date().toISOString().slice(0, 10),
  mode = 'Cash',
}) {
  const total = Number(totalAmount) || 0;
  const instAmt = Number(installmentAmount) || 0;
  if (total <= 0 || instAmt <= 0) return [];

  const count = Math.floor(total / instAmt);
  const remainder = Number((total - count * instAmt).toFixed(2));
  const prefix = frequency === 'Daily' ? 'DAY' : frequency === 'Weekly' ? 'WK' : 'MO';

  const schedule = [];
  for (let i = 0; i < count; i++) {
    const dateStr =
      frequency === 'Daily'
        ? addDaysToDate(startDate, i)
        : frequency === 'Weekly'
          ? addDaysToDate(startDate, i * 7)
          : addMonthsToDate(startDate, i);

    schedule.push({
      installmentNo: `${prefix}-${String(i + 1).padStart(2, '0')}`,
      index: i + 1,
      dueDate: dateStr,
      paidDate: dateStr,
      amount: instAmt,
      mode: mode || 'Cash',
      status: 'Paid',
    });
  }

  if (remainder > 0) {
    const nextIndex = count + 1;
    const dateStr =
      frequency === 'Daily'
        ? addDaysToDate(startDate, count)
        : frequency === 'Weekly'
          ? addDaysToDate(startDate, count * 7)
          : addMonthsToDate(startDate, count);

    schedule.push({
      installmentNo: `${prefix}-${String(nextIndex).padStart(2, '0')}`,
      index: nextIndex,
      dueDate: dateStr,
      paidDate: dateStr,
      amount: remainder,
      mode: mode || 'Cash',
      status: 'Paid',
      isRemainder: true,
    });
  }

  return schedule;
}

