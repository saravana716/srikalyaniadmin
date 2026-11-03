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
import { generateInstallmentSchedule } from '../utils/dateUtils';

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
  const amountAfter = current + add;
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
    totalSavedWeight = Number(((current + add) / ratePerGram).toFixed(4));
    addedWeight = Number((add / ratePerGram).toFixed(4));
  } else {
    totalSavedWeight = Number(totalSavedWeight.toFixed(4));
  }

  const currentPaid = Number(data.paidInstallments ?? data.PaidInstallments ?? 0) || 0;
  const nextPaidInstallments = currentPaid + 1;
  const isDaily = String(data.plan || data.planType || data.planName || data.name || '').toLowerCase().includes('daily');
  const isWeekly = String(data.plan || data.planType || data.planName || data.name || '').toLowerCase().includes('weekly');
  const durMonths = Number(data.durationMonths) || 11;
  const targetDuration = isDaily
    ? Number(data.durationDays || (durMonths * 30))
    : isWeekly
      ? Number(data.durationWeeks || Math.round(durMonths * 4.33) || 48)
      : Number(data.durationMonths || data.totalInstallments || 11);

  const payload = {
    amount: amountAfter,
    Amount: amountAfter,
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
    duration: Number(data.duration) || (String(data.plan || data.planType || '').toLowerCase().includes('daily') ? 330 : 11),
    durationDays: String(data.plan || data.planType || '').toLowerCase().includes('daily')
      ? (Number(data.durationDays || data.duration) || 330)
      : (Number(data.durationDays) || (Number(data.durationMonths || 11) * 30)),
    durationMonths: String(data.plan || data.planType || '').toLowerCase().includes('daily')
      ? (Number(data.durationMonths) || Math.round((Number(data.durationDays || data.duration) || 330) / 30) || 11)
      : (Number(data.durationMonths || data.duration) || 11),
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

export async function deletePlanPurchase(target) {
  if (!target) return;
  const planId = typeof target === 'string' ? target : target?.id;
  const cusId = typeof target === 'object' ? target?.cusId : null;
  const customerId = typeof target === 'object' ? target?.customerId : null;
  const isSynthesized = typeof target === 'object' ? target?._synthesizedFromCustomer : false;

  const pIdLower = String(planId || '').trim().toLowerCase();
  const cusIdLower = String(cusId || '').trim().toLowerCase();
  const custIdLower = String(customerId || '').trim().toLowerCase();

  // 1. Delete from planPurchases collection if doc exists
  if (planId) {
    try {
      await deleteDoc(doc(db, COLLECTION, planId));
    } catch (e) {
      console.warn('Delete planPurchase doc error:', e);
    }
  }

  // 2. Clear or reset scheme info on matching customer doc in customers collection
  const targetCustDocId = customerId || (isSynthesized ? planId : null);
  if (targetCustDocId) {
    try {
      const custRef = doc(db, 'customers', targetCustDocId);
      const custSnap = await getDoc(custRef);
      if (custSnap.exists()) {
        await updateDoc(custRef, {
          plan: '',
          planName: '',
          planStatus: 'Deleted',
          schemeStatus: 'Deleted',
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('Update customer scheme on delete plan error:', e);
    }
  }

  // 3. Delete from payments, installments, customerLedger
  try {
    const ids = new Set([pIdLower, cusIdLower, custIdLower].filter(Boolean));

    // Payments
    const paySnap = await getDocs(collection(db, 'payments'));
    const payDeletes = paySnap.docs
      .filter((d) => {
        const data = d.data();
        const pid = String(
          data.planId || data.planPurchaseId || data.raw?.planId || data.raw?.planPurchaseId || ''
        ).trim().toLowerCase();
        const cid = String(data.cusId || data.customerId || '').trim().toLowerCase();
        return (pid && ids.has(pid)) || (cid && ids.has(cid));
      })
      .map((d) => deleteDoc(d.ref));

    // Installments
    const instSnap = await getDocs(collection(db, 'installments'));
    const instDeletes = instSnap.docs
      .filter((d) => {
        const data = d.data();
        const pid = String(data.planId || data.planPurchaseId || '').trim().toLowerCase();
        const cid = String(data.cusId || data.customerId || '').trim().toLowerCase();
        return (pid && ids.has(pid)) || (cid && ids.has(cid));
      })
      .map((d) => deleteDoc(d.ref));

    // CustomerLedger
    const ledgerSnap = await getDocs(collection(db, 'customerLedger'));
    const ledgerDeletes = ledgerSnap.docs
      .filter((d) => {
        const data = d.data();
        const pid = String(data.planPurchaseId || data.planId || '').trim().toLowerCase();
        const cid = String(data.cusId || data.customerId || '').trim().toLowerCase();
        return (pid && ids.has(pid)) || (cid && ids.has(cid));
      })
      .map((d) => deleteDoc(d.ref));

    await Promise.all([...payDeletes, ...instDeletes, ...ledgerDeletes]);
  } catch (e) {
    console.warn('Cascade delete linked plan purchase payments warning:', e);
  }
}

/**
 * Split a plan purchase's paid amount into consecutive daily or monthly installment records in Firestore.
 * Supports:
 * - Daily plan: splits paid amount into daily installments (e.g. ₹2000 / ₹200 = 10 days, or ₹2000 / ₹100 = 20 days).
 * - Monthly plan: splits paid amount into monthly installments (e.g. ₹2000 / ₹1000 = 2 months).
 * - Changing plan type between Daily and Monthly (and vice versa).
 * - Storing clean, fully working records in 'installments' collection.
 * - Updating 'planPurchases' doc and syncing customer account.
 */
export async function splitPlanInstallments(params) {
  const {
    planPurchaseId,
    customerId,
    cusId,
    customerName,
    mobile,
    planId,
    planName,
    planType = 'Daily',
    totalPaidAmount,
    installmentAmount,
    startDate = new Date().toISOString().slice(0, 10),
    paymentMode = 'Cash',
    status = 'Active',
    durationMonths,
    nomineeName,
    targetPaymentId,
    targetPaymentSource,
    isPartialPaymentSplit,
  } = params || {};

  if (!planPurchaseId) throw new Error('Plan purchase ID is required');
  const numPaid = Number(totalPaidAmount) || 0;
  const numInst = Number(installmentAmount) || 0;

  if (numPaid < 0) throw new Error('Paid amount cannot be negative');
  if (numInst <= 0) throw new Error('Installment amount must be greater than ₹0');

  // 1. Generate the installment schedule
  const schedule = generateInstallmentSchedule({
    totalAmount: numPaid,
    installmentAmount: numInst,
    frequency: planType,
    startDate,
    mode: paymentMode,
  });

  const batchId = `SPLIT-${Date.now()}`;
  const pIdLower = String(planPurchaseId).trim().toLowerCase();
  const cusIdLower = String(cusId || '').trim().toLowerCase();
  const custIdLower = String(customerId || '').trim().toLowerCase();
  const isTargeted = Boolean(targetPaymentId && targetPaymentId !== 'all');

  // 2. Remove previous split or targeted payment records to prevent duplicates
  try {
    if (isTargeted) {
      const rawTargetId = String(targetPaymentId || '').trim();
      const cleanTargetId = rawTargetId.replace(/^ledger_/, '');
      const idsToDelete = Array.from(new Set([rawTargetId, cleanTargetId].filter(Boolean)));

      // A. Delete from installments & find any linked ledgerId
      for (const id of idsToDelete) {
        try {
          const instRef = doc(db, 'installments', id);
          const instSnap = await getDoc(instRef);
          if (instSnap.exists()) {
            const data = instSnap.data();
            if (data.ledgerId) {
              try { await deleteDoc(doc(db, 'customerLedger', String(data.ledgerId))); } catch (e) {}
            }
            await deleteDoc(instRef);
          }
        } catch (e) {}
      }

      // B. Delete from customerLedger & find any linked installment
      for (const id of idsToDelete) {
        try {
          const ledgerRef = doc(db, 'customerLedger', id);
          const ledgerSnap = await getDoc(ledgerRef);
          if (ledgerSnap.exists()) {
            await deleteDoc(ledgerRef);
          }
        } catch (e) {}
      }

      // C. Delete from payments collection
      for (const id of idsToDelete) {
        try {
          await deleteDoc(doc(db, 'payments', id));
        } catch (e) {}
      }

      // D. Also delete any linked installment matching ledgerId == cleanTargetId
      try {
        const instQuerySnap = await getDocs(
          query(collection(db, 'installments'), where('ledgerId', '==', cleanTargetId))
        );
        instQuerySnap.docs.forEach((d) => deleteDoc(d.ref).catch(() => {}));
      } catch (e) {}

      // E. Clean any previous split installments created for this specific target payment if re-splitting
      const instSnap = await getDocs(collection(db, 'installments'));
      const oldTargetDeletes = instSnap.docs
        .filter((d) => {
          const data = d.data();
          const pid = String(data.planId || data.planPurchaseId || '').trim().toLowerCase();
          const origId = String(data.originalPaymentId || '').trim();
          return pid === pIdLower && (origId === cleanTargetId || origId === rawTargetId);
        })
        .map((d) => deleteDoc(d.ref));
      if (oldTargetDeletes.length > 0) {
        await Promise.all(oldTargetDeletes);
      }
    } else {
      // If splitting all payments / full balance, remove previous split records for this plan
      const instSnap = await getDocs(collection(db, 'installments'));
      const oldDeletes = instSnap.docs
        .filter((d) => {
          const data = d.data();
          const pid = String(data.planId || data.planPurchaseId || '').trim().toLowerCase();
          // Strict boundary: If record has a planId, only delete if it matches THIS plan purchase
          if (pid) {
            return pid === pIdLower;
          }
          // Fallback for legacy records without planId: only delete if cusId and planName match and was split
          const cid = String(data.cusId || data.customerId || '').trim().toLowerCase();
          const pName = String(data.planName || data.chitPlan || '').trim().toLowerCase();
          const thisPlan = String(planName || '').trim().toLowerCase();
          if (cid && (cid === cusIdLower || cid === custIdLower) && pName && pName === thisPlan) {
            if (data.source === 'daily_split' || data.source === 'monthly_split' || data.splitBatchId) {
              return true;
            }
          }
          return false;
        })
        .map((d) => deleteDoc(d.ref));

      if (oldDeletes.length > 0) {
        await Promise.all(oldDeletes);
      }
    }
  } catch (err) {
    console.warn('Could not clean previous installments before split:', err);
  }

  // 3. Write each installment in the schedule to Firestore 'installments' collection
  const createdInstallments = [];
  for (const item of schedule) {
    const instDoc = {
      installmentNo: item.installmentNo,
      installmentIndex: item.index,
      totalInstallments: schedule.length,
      dueDate: item.dueDate,
      paidDate: item.paidDate,
      amount: String(item.amount),
      paidAmount: String(item.amount),
      dueAmount: String(item.amount),
      mode: item.mode || paymentMode || 'Cash',
      paymentMode: item.mode || paymentMode || 'Cash',
      status: 'Paid',
      customerId: String(customerId || ''),
      cusId: String(cusId || ''),
      customerName: String(customerName || ''),
      mobile: String(mobile || ''),
      planId: String(planPurchaseId),
      planPurchaseId: String(planPurchaseId),
      planName: String(planName || ''),
      chitPlan: String(planName || ''),
      planType: planType,
      plan: planType,
      source: planType === 'Daily' ? 'daily_split' : 'monthly_split',
      note: `${planType} installment (${item.installmentNo} of ${schedule.length}) - ${planName || 'Chit Scheme'}`,
      splitBatchId: batchId,
      originalPaymentId: isTargeted ? String(targetPaymentId) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'installments'), instDoc);
    createdInstallments.push({ id: ref.id, ...instDoc });
  }

  // 4. Update the planPurchases document
  const planRef = doc(db, COLLECTION, planPurchaseId);
  const planSnap = await getDoc(planRef);
  const currentPlan = planSnap.exists() ? planSnap.data() : {};

  const totalSplitCount = schedule.length;
  const existingSaved = Number(currentPlan.savedAmount ?? currentPlan.amount ?? 0) || 0;
  // If splitting a specific payment, preserve the rest of the plan's saved balance (e.g. ₹2,192 remains ₹2,192)
  const nextSavedAmount = isTargeted || isPartialPaymentSplit
    ? Math.max(existingSaved, numPaid)
    : numPaid;

  const existingPaidCount = Number(currentPlan.paidInstallments ?? 0) || 0;
  const nextPaidInstallments = isTargeted || isPartialPaymentSplit
    ? Math.max(0, existingPaidCount - 1) + totalSplitCount
    : totalSplitCount;

  const planUpdatePayload = {
    plan: planType,
    planType: planType,
    amount: numInst, // Installment amount (daily or monthly)
    installmentAmount: numInst,
    dailyAmount: planType === 'Daily' ? numInst : null,
    monthlyAmount: planType === 'Monthly' ? numInst : null,
    savedAmount: nextSavedAmount,
    paidInstallments: nextPaidInstallments,
    duration: Number(data.duration) || (planType === 'Daily' ? (Number(data.durationDays) || currentPlan.durationDays || 330) : (Number(data.durationMonths) || currentPlan.durationMonths || 11)),
    durationDays: planType === 'Daily' ? (Number(data.durationDays || data.duration) || currentPlan.durationDays || 330) : null,
    durationMonths: planType === 'Monthly' ? (Number(data.durationMonths || data.duration) || currentPlan.durationMonths || 11) : (currentPlan.durationMonths || Math.round((Number(data.durationDays || data.duration) || 330) / 30) || 11),
    status: status || currentPlan.status || 'Active',
    lastSplitAt: serverTimestamp(),
    lastSplitBatchId: batchId,
    lastSplitCount: totalSplitCount,
    lastSplitPaymentId: isTargeted ? String(targetPaymentId) : null,
    updatedAt: serverTimestamp(),
  };

  if (customerName) {
    planUpdatePayload.customerName = customerName;
    planUpdatePayload.name = customerName;
  }
  if (mobile) planUpdatePayload.mobile = mobile;
  if (cusId) planUpdatePayload.cusId = cusId;
  if (planName) planUpdatePayload.planName = planName;
  if (planId) planUpdatePayload.planId = planId;
  if (nomineeName !== undefined) planUpdatePayload.nomineeName = nomineeName;

  if (planSnap.exists()) {
    await updateDoc(planRef, planUpdatePayload);
  } else {
    await setDoc(planRef, {
      ...planUpdatePayload,
      customerId: customerId || '',
      type: 'scheme_enrollment',
      startDate: startDate || new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
    }, { merge: true });
  }

  // 5. Sync to customer document in 'customers' collection:
  const targetCustId = customerId || (currentPlan.customerId) || (planPurchaseId);
  if (targetCustId) {
    try {
      const custRef = doc(db, 'customers', targetCustId);
      const custSnap = await getDoc(custRef);
      if (custSnap.exists()) {
        const allPlansSnap = await getDocs(collection(db, COLLECTION));
        let totalCustomerBalance = 0;
        allPlansSnap.docs.forEach((docSnap) => {
          const d = docSnap.data();
          const matchesCustomer =
            (d.customerId && (d.customerId === customerId || d.customerId === targetCustId)) ||
            (d.cusId && cusId && d.cusId === cusId);
          if (matchesCustomer) {
            if (docSnap.id === planPurchaseId) {
              totalCustomerBalance += nextSavedAmount;
            } else {
              totalCustomerBalance += Number(d.savedAmount ?? d.amount ?? 0) || 0;
            }
          }
        });
        if (totalCustomerBalance <= 0) totalCustomerBalance = nextSavedAmount;

        await updateDoc(custRef, {
          accountBalance: totalCustomerBalance,
          amount: totalCustomerBalance,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('Sync customer on split warning:', e);
    }
  }

  return {
    success: true,
    batchId,
    totalPaidAmount: numPaid,
    installmentAmount: numInst,
    planType,
    totalInstallments: totalSplitCount,
    schedule,
    createdInstallments,
  };
}
