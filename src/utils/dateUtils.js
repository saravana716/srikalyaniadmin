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
