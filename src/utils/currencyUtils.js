/**
 * Parse amount string like "₹ 10,000" or "10000" to number.
 */
export function parseAmount(val) {
  if (val == null || val === '') return 0;
  const n = parseFloat(String(val).replace(/[₹,\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

export function formatINR(amount) {
  const n = typeof amount === 'number' ? amount : parseAmount(amount);
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN')}`;
}
