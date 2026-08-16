/**
 * Convert saved rupee amount to grams using current metal rate (₹ per gram).
 */

export function parseRate(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseMoneyAmount(value) {
  if (value == null || value === '') return 0;
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {number|string} amountRupees
 * @param {number|string|null} ratePerGram
 * @returns {number|null} grams
 */
export function calcSavedWeightGrams(amountRupees, ratePerGram) {
  const amount = parseMoneyAmount(amountRupees);
  const rate = parseRate(ratePerGram);
  if (!rate || amount <= 0) return null;
  return amount / rate;
}

export function formatWeightGrams(grams, digits = 3) {
  if (grams == null || Number.isNaN(Number(grams))) return '—';
  const n = Number(grams);
  if (n === 0) return '0 g';
  return `${n.toFixed(digits)} g`;
}

/** Prefer silver rate when plan/metal looks like silver; otherwise gold. */
export function pickRateForPlan(planLike, rates) {
  const text = [
    planLike?.planName,
    planLike?.plan,
    planLike?.name,
    planLike?.type,
    planLike?.metal,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('silver')) {
    return {
      metal: 'Silver',
      ratePerGram: parseRate(rates?.silverRate),
    };
  }
  return {
    metal: 'Gold',
    ratePerGram: parseRate(rates?.goldRate),
  };
}

export function formatSavedWeightForDisplay(amountRupees, rates, planLike) {
  const { metal, ratePerGram } = pickRateForPlan(planLike, rates);
  const grams = calcSavedWeightGrams(amountRupees, ratePerGram);
  if (grams == null) {
    return ratePerGram ? '—' : 'Set gold rate';
  }
  return formatWeightGrams(grams);
}

export function savedWeightMeta(amountRupees, rates, planLike) {
  const { metal, ratePerGram } = pickRateForPlan(planLike, rates);
  const grams = calcSavedWeightGrams(amountRupees, ratePerGram);
  return {
    metal,
    ratePerGram,
    grams,
    label: formatWeightGrams(grams),
    hint: ratePerGram
      ? `at ₹${ratePerGram.toLocaleString('en-IN')}/${metal.toLowerCase()} g`
      : 'Add today\'s rate in Gold Rate Manage',
  };
}
