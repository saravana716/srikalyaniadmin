import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  getDocsFromServer,
  getDocsFromCache,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getLatestMetalRates } from './goldRatesService';
import { calcSavedWeightGrams, pickRateForPlan } from '../utils/weightUtils';

const COLLECTION = 'planPurchases';

function parseMoney(val) {
  if (val == null || val === '') return 0;
  const n = parseFloat(String(val).replace(/[₹,\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

function digits(v) {
  return String(v || '').replace(/\D/g, '');
}

/**
 * Score how well a plan purchase matches a customer.
 * Prefer exact cusId / linked user over shared mobile (mobile can collide).
 */
export function scorePlanPurchaseMatch(plan, customer) {
  if (!plan || !customer) return 0;
  let score = 0;
  const cusId = String(customer.cusId || '').trim();
  const docId = String(customer.id || '').trim();
  const name = String(customer.name || '').trim().toLowerCase();
  const mobile = digits(customer.mobile);

  const planCusId = String(plan.cusId || '').trim();
  const planCustomerId = String(plan.customerId || '').trim();
  const planLinked = String(plan.linked_user_id || plan.linkedUserId || plan.userId || plan.UserId || '').trim();
  const planName = String(plan.name || plan.customerName || '').trim().toLowerCase();
  const planMobile = digits(plan.mobile || plan.Mobile || plan.parent_mobile);

  // Strictly enforce Customer ID boundary: if customer has cusId or docId, reject plans with conflicting non-empty cusId or customerId
  if (cusId && planCusId && planCusId !== cusId && planCusId !== docId) {
    return 0;
  }
  if (docId && planCustomerId && planCustomerId !== docId && planCustomerId !== cusId && planCustomerId.length > 5) {
    // Only reject if planCustomerId is a full doc ID/cusId and differs
    if (planCusId && planCusId !== cusId && planCusId !== docId) {
      return 0;
    }
  }

  if (cusId && planCusId && planCusId === cusId) score += 100;
  if (docId && planLinked && planLinked === docId) score += 80;
  if (docId && (planCustomerId === docId || planCusId === docId || String(plan.id) === docId)) score += 70;
  if (cusId && (planCustomerId === cusId || planLinked === cusId)) score += 70;
  if (name && planName && planName === name) score += 40;
  if (mobile && planMobile && planMobile === mobile) score += 15;
  if (String(plan.status || '').toLowerCase() === 'active') score += 5;
  return score;
}

/**
 * Subscribe to plan purchases (enrollments) list (real-time).
 */
export function subscribePlanPurchases(setData) {
  if (typeof setData !== 'function') return () => {};
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setData(list);
    }, (err) => {
      console.warn('planPurchases subscribe error, falling back to getDocs:', err);
      getDocs(collection(db, COLLECTION)).then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setData(list);
      }).catch(() => setData([]));
    });

    return () => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        console.warn('subscribePlanPurchases unsub error ignored:', e);
      }
    };
  } catch (err) {
    console.warn('subscribePlanPurchases failed:', err);
    getDocs(collection(db, COLLECTION)).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setData(list);
    }).catch(() => setData([]));
    return () => {};
  }
}

async function fetchAllPlanPurchasesDocs() {
  try {
    return await getDocsFromServer(collection(db, COLLECTION));
  } catch (err) {
    console.warn('getDocsFromServer failed, trying cache/default getDocs', err);
    try {
      return await getDocsFromCache(collection(db, COLLECTION));
    } catch {
      return await getDocs(collection(db, COLLECTION));
    }
  }
}

/**
 * Find plan purchases for a customer (client-side match).
 * Mobile apps often use cusId / linked_user_id / mobile — not customerId.
 */
export async function findPlanPurchasesForCustomer(customer) {
  if (!customer) return [];
  try {
    const snap = await fetchAllPlanPurchasesDocs();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const matched = all
      .map((plan) => ({ plan, score: scorePlanPurchaseMatch(plan, customer) }))
      .filter(({ score }) => score >= 40) // at least name or cusId-level confidence
      .sort((a, b) => b.score - a.score)
      .map(({ plan, score }) => ({ ...plan, _matchScore: score }));

    // Fallback: if nothing scored high, allow mobile-only matches so UI can still list options
    if (matched.length === 0) {
      return all
        .map((plan) => ({ plan, score: scorePlanPurchaseMatch(plan, customer) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ plan, score }) => ({ ...plan, _matchScore: score }));
    }

    return matched;
  } catch (err) {
    console.error('findPlanPurchasesForCustomer error', err);
    return [];
  }
}

/**
 * Best plan to credit by default (highest match score).
 */
export function pickBestPlanPurchase(plans = []) {
  if (!plans.length) return null;
  return [...plans].sort((a, b) => (b._matchScore || 0) - (a._matchScore || 0))[0];
}

/**
 * Add cash amount onto a plan purchase's amount (and savedAmount),
 * calculating incremental gold weight from today's rate and quality,
 * and summing with the previous saved weight value.
 */
export async function creditPlanPurchaseAmount(planPurchaseId, creditAmount, paymentMode = 'Cash', options = {}) {
  const ref = doc(db, COLLECTION, planPurchaseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Plan purchase not found');
  const data = snap.data();
  const planStatus = String(data.status || '').trim().toLowerCase();
  if (['closed', 'cancelled', 'closed account', 'cancelled chit'].includes(planStatus)) {
    throw new Error(`Cannot add cash to plan "${data.planName || data.name || 'Scheme'}" because its status is ${data.status || 'Closed'}`);
  }

  const current = parseMoney(data.amount ?? data.Amount);
  const saved = parseMoney(data.savedAmount ?? data.SavedAmount);
  const add = Number(creditAmount) || 0;
  const amountAfter = current; // Keep Base Amount unchanged!
  const savedAfter = saved + add;

  // Previous saved gold weight
  const prevWeight = Number(data.savedWeight ?? data.SavedWeight ?? data.weight ?? 0) || 0;

  // Determine rate based on metal and quality/purity
  let ratePerGram = options.ratePerGram ? Number(options.ratePerGram) : null;
  let metal = 'Gold';
  let quality = options.quality || data.quality || data.purity || '';
  try {
    const latestRates = await getLatestMetalRates();
    const picked = pickRateForPlan(data, latestRates, quality);
    if (!ratePerGram) {
      ratePerGram = picked.ratePerGram;
    }
    metal = picked.metal;
    quality = quality || picked.quality;
  } catch (e) {
    console.warn('Could not compute metal rate', e);
  }

  // Calculate new gold weight bought by THIS payment
  let addedWeight = 0;
  if (ratePerGram && ratePerGram > 0 && add > 0) {
    addedWeight = Number((add / ratePerGram).toFixed(4));
  }

  // Sum previous value + newly bought weight
  let totalSavedWeight = prevWeight + addedWeight;
  if (prevWeight === 0 && current > 0 && ratePerGram > 0) {
    // If this is the very first time weight is calculated, maybe use savedAfter
    totalSavedWeight = Number((savedAfter / ratePerGram).toFixed(4));
    addedWeight = Number((add / ratePerGram).toFixed(4));
  } else {
    totalSavedWeight = Number(totalSavedWeight.toFixed(4));
  }

  const currentPaid = Number(data.paidInstallments ?? data.PaidInstallments ?? 0) || 0;
  const nextPaidInstallments = currentPaid + 1;
  const targetDuration = Number(data.durationMonths || data.totalInstallments || 11);

  const payload = {
    // DO NOT OVERWRITE amount/Amount as it stores the Base Installment Amount
    savedAmount: savedAfter,
    paidInstallments: nextPaidInstallments,
    savedWeight: totalSavedWeight,
    lastAddedWeight: addedWeight,
    lastRatePerGram: ratePerGram || null,
    quality: quality || '22K (916)',
    metal: metal,
    lastPaymentMode: paymentMode,
    lastCreditAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (nextPaidInstallments >= targetDuration && String(data.status || '').toLowerCase() === 'active') {
    payload.status = 'Completed';
  }

  await updateDoc(ref, payload);

  return {
    amountAfter,
    savedAfter,
    paidInstallments: nextPaidInstallments,
    savedWeight: totalSavedWeight,
    addedWeight,
    ratePerGram,
    quality,
    planName: data.planName || data.name || '',
    previousAmount: current,
    previousWeight: prevWeight,
  };
}

/**
 * Set plan purchase amount to an absolute value (used to sync from customer account).
 */
export async function setPlanPurchaseAmount(planPurchaseId, absoluteAmount, paymentMode = 'Cash') {
  const ref = doc(db, COLLECTION, planPurchaseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Plan purchase not found');
  const data = snap.data();
  const next = Number(absoluteAmount) || 0;

  await updateDoc(ref, {
    amount: next,
    Amount: next,
    lastPaymentMode: paymentMode,
    lastCreditAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    amountAfter: next,
    planName: data.planName || data.name || '',
  };
}

export async function addPlanPurchase(data) {
  const startDate = data.startDate || new Date().toISOString().slice(0, 10);
  const ref = await addDoc(collection(db, COLLECTION), {
    customerId: data.customerId ?? '',
    cusId: data.cusId ?? '',
    customerName: data.customerName ?? '',
    name: data.customerName ?? data.name ?? '',
    mobile: data.mobile ?? '',
    parent_mobile: data.mobile ?? '',
    planId: data.planId ?? '',
    planName: data.planName ?? '',
    plan: data.plan || data.planType || 'Monthly',
    type: 'scheme_enrollment',
    startDate: startDate,
    joinedDate: startDate,
    status: data.status ?? 'Active',
    amount: Number(data.amount) || 0,
    savedAmount: Number(data.savedAmount) || 0,
    savedWeight: Number(data.savedWeight) || 0,
    paidInstallments: Number(data.paidInstallments) || 0,
    durationMonths: Number(data.durationMonths) || 11,
    nomineeName: data.nomineeName || '',
    nomineeRelation: data.nomineeRelation || '',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updatePlanPurchase(id, data) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function closePlanPurchase(id, closeData = {}) {
  if (!id) throw new Error('Plan ID is required to close account');
  const name = String(closeData.closeName || closeData.cancelName || '').trim();
  const location = String(closeData.closeLocation || closeData.cancelLocation || '').trim();
  const address = String(closeData.closeAddress || closeData.cancelAddress || '').trim();
  const details = String(closeData.closeDetails || closeData.cancelReason || '').trim();
  const monthsPaid = closeData.monthsPaid !== '' && closeData.monthsPaid != null
    ? Number(closeData.monthsPaid)
    : null;

  const payload = {
    status: 'Closed',
    closeName: name,
    closeLocation: location,
    closeAddress: address,
    closeDetails: details,
    monthsPaid,
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // 1. Update/Upsert in planPurchases collection
  const planRef = doc(db, COLLECTION, id);
  await setDoc(planRef, payload, { merge: true });

  // 2. Also sync to customer document if ID matches
  try {
    const custRef = doc(db, 'customers', id);
    const snap = await getDoc(custRef);
    if (snap.exists()) {
      await updateDoc(custRef, {
        planStatus: 'Closed',
        schemeStatus: 'Closed',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn('Sync customer status on close warning:', e);
  }
}

export async function cancelPlanPurchase(id, cancelData = {}) {
  if (!id) throw new Error('Plan ID is required to cancel chit');
  const payload = {
    status: 'Cancelled',
    cancelName: cancelData.cancelName || '',
    cancelLocation: cancelData.cancelLocation || '',
    cancelAddress: cancelData.cancelAddress || '',
    cancelReason: cancelData.cancelReason || '',
    monthsPaid: cancelData.monthsPaid != null && cancelData.monthsPaid !== '' ? Number(cancelData.monthsPaid) : null,
    penaltyAmount: Number(cancelData.penaltyAmount) || 0,
    signedCancelFormUrl: cancelData.signedCancelFormUrl || '',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // 1. Update/Upsert in planPurchases collection
  const planRef = doc(db, COLLECTION, id);
  await setDoc(planRef, payload, { merge: true });

  // 2. Also sync to customer document if ID matches
  try {
    const custRef = doc(db, 'customers', id);
    const snap = await getDoc(custRef);
    if (snap.exists()) {
      await updateDoc(custRef, {
        planStatus: 'Cancelled',
        schemeStatus: 'Cancelled',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn('Sync customer status on cancel warning:', e);
  }
}

export async function deletePlanPurchase(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
