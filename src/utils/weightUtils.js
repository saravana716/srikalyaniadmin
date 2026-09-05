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

/** Prefer silver rate when plan/metal looks like silver; otherwise gold with quality adjustment. */
export function pickRateForPlan(planLike, rates, explicitQuality = '') {
  const text = [
    explicitQuality,
    planLike?.quality,
    planLike?.purity,
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
      quality: 'Silver',
      ratePerGram: parseRate(rates?.silverRate),
    };
  }

  const baseGoldRate = parseRate(rates?.goldRate);

  if (text.includes('24k') || text.includes('999') || text.includes('pure')) {
    const rate24k = parseRate(rates?.goldRate24K) || (baseGoldRate ? Math.round(baseGoldRate * (24 / 22)) : null);
    return {
      metal: 'Gold',
      quality: '24K (999)',
      ratePerGram: rate24k,
    };
  }

  if (text.includes('18k') || text.includes('750')) {
    const rate18k = parseRate(rates?.goldRate18K) || (baseGoldRate ? Math.round(baseGoldRate * (18 / 22)) : null);
    return {
      metal: 'Gold',
      quality: '18K (750)',
      ratePerGram: rate18k,
    };
  }

  // Default: 22K (916) Hallmark jewellery gold
  return {
    metal: 'Gold',
    quality: '22K (916)',
    ratePerGram: baseGoldRate,
  };
}

/**
 * Calculates incremental gold weight bought by a new cash credit,
 * and sums it to the previous accumulated weight.
 */
export function calcIncrementalWeight(amountRupees, ratePerGram, prevGrams = 0) {
  const addAmt = parseMoneyAmount(amountRupees);
  const rate = parseRate(ratePerGram);
  const prev = Number(prevGrams) || 0;

  if (!rate || addAmt <= 0) {
    return {
      addedGrams: 0,
      newTotalGrams: prev,
      ratePerGram: rate,
    };
  }

  const addedGrams = Number((addAmt / rate).toFixed(4));
  const newTotalGrams = Number((prev + addedGrams).toFixed(4));
  return {
    addedGrams,
    newTotalGrams,
    ratePerGram: rate,
  };
}

export function formatSavedWeightForDisplay(amountRupees, rates, planLike) {
  // 1. If document already has actual accumulated savedWeight, prioritize it!
  const storedWeight = planLike?.savedWeight ?? planLike?.SavedWeight ?? planLike?.goldWeight;
  if (storedWeight != null && !Number.isNaN(Number(storedWeight)) && Number(storedWeight) > 0) {
    return formatWeightGrams(storedWeight);
  }

  // 2. Fallback: calculate from amount and today's rate
  const { metal, ratePerGram } = pickRateForPlan(planLike, rates);
  const grams = calcSavedWeightGrams(amountRupees, ratePerGram);
  if (grams == null) {
    return ratePerGram ? '—' : 'Set gold rate';
  }
  return formatWeightGrams(grams);
}

export function savedWeightMeta(amountRupees, rates, planLike, explicitQuality = '') {
  const { metal, quality, ratePerGram } = pickRateForPlan(planLike, rates, explicitQuality);
  
  // If stored weight exists, use it as total grams
  const storedWeight = planLike?.savedWeight ?? planLike?.SavedWeight ?? planLike?.goldWeight;
  const grams = (storedWeight != null && Number(storedWeight) > 0)
    ? Number(storedWeight)
    : calcSavedWeightGrams(amountRupees, ratePerGram);

  return {
    metal,
    quality,
    ratePerGram,
    grams,
    label: formatWeightGrams(grams),
    hint: ratePerGram
      ? `at ₹${ratePerGram.toLocaleString('en-IN')}/${quality || metal} g`
      : 'Add today\'s rate in Gold Rate Manage',
  };
}
