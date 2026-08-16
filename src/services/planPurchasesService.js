import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
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

  const planCusId = String(plan.cusId || plan.customerId || '').trim();
  const planLinked = String(plan.linked_user_id || plan.linkedUserId || plan.userId || plan.UserId || '').trim();
  const planName = String(plan.name || plan.customerName || '').trim().toLowerCase();
  const planMobile = digits(plan.mobile || plan.Mobile || plan.parent_mobile);

  if (cusId && planCusId && planCusId === cusId) score += 100;
  if (docId && planLinked && planLinked === docId) score += 80;
  if (docId && (planCusId === docId || String(plan.id) === docId)) score += 70;
  if (name && planName && planName === name) score += 40;
  if (mobile && planMobile && planMobile === mobile) score += 15;
  if (String(plan.status || '').toLowerCase() === 'active') score += 5;
  return score;
}

/**
 * Subscribe to plan purchases (enrollments) list (real-time).
 */
export function subscribePlanPurchases(setData) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setData(list);
  }, (err) => {
    console.error('planPurchases subscribe error', err);
    return onSnapshot(collection(db, COLLECTION), (snapshot) => {
      setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setData([]));
  });
}

/**
 * Find plan purchases for a customer (client-side match).
 * Mobile apps often use cusId / linked_user_id / mobile — not customerId.
 */
export async function findPlanPurchasesForCustomer(customer) {
  const snap = await getDocs(collection(db, COLLECTION));
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
}

/**
 * Best plan to credit by default (highest match score).
 */
export function pickBestPlanPurchase(plans = []) {
  if (!plans.length) return null;
  return [...plans].sort((a, b) => (b._matchScore || 0) - (a._matchScore || 0))[0];
}

/**
 * Add cash amount onto a plan purchase's amount (and savedAmount).
 */
export async function creditPlanPurchaseAmount(planPurchaseId, creditAmount, paymentMode = 'Cash') {
  const ref = doc(db, COLLECTION, planPurchaseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Plan purchase not found');
  const data = snap.data();
  const current = parseMoney(data.amount ?? data.Amount);
  const saved = parseMoney(data.savedAmount ?? data.SavedAmount);
  const add = Number(creditAmount) || 0;
  const amountAfter = current + add;
  const savedAfter = saved + add;

  let savedWeight = null;
  try {
    const latestRates = await getLatestMetalRates();
    const { ratePerGram } = pickRateForPlan(data, latestRates);
    savedWeight = calcSavedWeightGrams(savedAfter || amountAfter, ratePerGram);
  } catch (e) {
    console.warn('Could not compute savedWeight from gold rate', e);
  }

  const payload = {
    amount: amountAfter,
    Amount: amountAfter,
    savedAmount: savedAfter,
    lastPaymentMode: paymentMode,
    lastCreditAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (savedWeight != null) {
    payload.savedWeight = Number(savedWeight.toFixed(4));
  }

  await updateDoc(ref, payload);

  return {
    amountAfter,
    savedAfter,
    savedWeight: payload.savedWeight ?? null,
    planName: data.planName || data.name || '',
    previousAmount: current,
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
  const ref = await addDoc(collection(db, COLLECTION), {
    customerId: data.customerId ?? '',
    customerName: data.customerName ?? '',
    planId: data.planId ?? '',
    planName: data.planName ?? '',
    startDate: data.startDate ?? '',
    status: data.status ?? 'Active',
    amount: Number(data.amount) || 0,
    savedAmount: Number(data.savedAmount) || 0,
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

export async function cancelPlanPurchase(id, cancelData) {
  await updateDoc(doc(db, COLLECTION, id), {
    status: 'Cancelled',
    cancelName: cancelData.cancelName || '',
    cancelLocation: cancelData.cancelLocation || '',
    cancelAddress: cancelData.cancelAddress || '',
    cancelReason: cancelData.cancelReason || '',
    monthsPaid: cancelData.monthsPaid,
    penaltyAmount: Number(cancelData.penaltyAmount) || 0,
    signedCancelFormUrl: cancelData.signedCancelFormUrl || '',
    // Keep empty legacy signature fields for older cancelled records
    authoritySignature: cancelData.authoritySignature || '',
    customerSignature: cancelData.customerSignature || '',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePlanPurchase(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
