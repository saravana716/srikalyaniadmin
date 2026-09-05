import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  getDoc,
  getDocs,
  getDocsFromServer,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { findPlanPurchasesForCustomer, creditPlanPurchaseAmount, pickBestPlanPurchase, subscribePlanPurchases } from './planPurchasesService';
import { subscribeAllPayments } from './paymentsService';

const COLLECTION = 'customers';
const LEDGER = 'customerLedger';

export function generateCustomerCusId() {
  // Generate 8 digits, e.g. 62868055 -> kalyani62868055
  const r = Math.floor(10000000 + Math.random() * 90000000);
  return `kalyani${r}`;
}

export async function generateUniqueCusId() {
  for (let i = 0; i < 10; i++) {
    const candidate = generateCustomerCusId();
    try {
      const q = query(collection(db, COLLECTION), where('cusId', '==', candidate));
      const snap = await getDocsFromServer(q);
      if (snap.empty) {
        return candidate;
      }
    } catch {
      return candidate;
    }
  }
  return generateCustomerCusId();
}

export function subscribeCustomers(setData) {
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
      console.warn('customers subscribe error, falling back to getDocs:', err);
      getDocs(collection(db, COLLECTION)).then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || Date.parse(a.createdAt || 0) || 0;
          const tb = b.createdAt?.toMillis?.() || Date.parse(b.createdAt || 0) || 0;
          return tb - ta;
        });
        setData(list);
      }).catch(() => setData([]));
    });

    return () => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        console.warn('subscribeCustomers unsub error ignored:', e);
      }
    };
  } catch (err) {
    console.warn('subscribeCustomers query failed:', err);
    getDocs(collection(db, COLLECTION)).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setData(list);
    }).catch(() => setData([]));
    return () => {};
  }
}

/**
 * Live cash / UPI / Card credit history for one customer.
 */
export function subscribeCustomerLedger(customerId, setData) {
  if (!customerId || typeof setData !== 'function') {
    if (typeof setData === 'function') setData([]);
    return () => {};
  }

  try {
    const plain = query(collection(db, LEDGER), where('customerId', '==', customerId));

    const apply = (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || Date.parse(a.createdAt || 0) || 0;
        const tb = b.createdAt?.toMillis?.() || Date.parse(b.createdAt || 0) || 0;
        return tb - ta;
      });
      setData(list);
    };

    const unsub = onSnapshot(
      plain,
      apply,
      (err) => {
        console.warn('subscribeCustomerLedger error, falling back to getDocs:', err);
        getDocs(plain)
          .then(apply)
          .catch(() => setData([]));
      }
    );

    return () => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        console.warn('subscribeCustomerLedger unsub error ignored:', e);
      }
    };
  } catch (err) {
    console.warn('subscribeCustomerLedger query init failed:', err);
    setData([]);
    return () => {};
  }
}

function ledgerTime(entry) {
  return entry?.createdAt?.toMillis?.() || Date.parse(entry?.createdAt || 0) || 0;
}

/**
 * Payment history for a plan purchase detail view.
 * Includes all payment types: Installments, Direct Payments, and Add Cash ledger.
 */
export function subscribePlanPaymentHistory(planRow, setData) {
  if (!planRow) {
    setData([]);
    return () => {};
  }

  const rowId = String(planRow.id || '').trim().toLowerCase();
  const cusId = String(planRow.cusId || planRow.customerId || '').trim().toLowerCase();
  const customerId = String(planRow.customerId || '').trim().toLowerCase();
  const linkedUserId = String(planRow.linked_user_id || planRow.linkedUserId || '').trim().toLowerCase();
  const planName = String(planRow.planName || planRow.name || planRow.plan || '').trim().toLowerCase();

  return subscribeAllPayments((allPayments) => {
    const matched = allPayments.filter((row) => {
      const rawPlanId = String(
        row.raw?.planPurchaseId ||
        row.raw?.planPurchaseDocId ||
        row.raw?.planId ||
        row.planPurchaseId ||
        row.planId ||
        ''
      ).trim().toLowerCase();

      // 1. Direct plan purchase doc ID link:
      // If payment has a plan ID, it must match this plan ID strictly.
      if (rawPlanId) {
        return rowId ? rawPlanId === rowId : false;
      }

      // 2. Customer identifier match (must match cusId or customerId)
      const rowCusId = String(row.cusId || row.raw?.cusId || '').trim().toLowerCase();
      const rowCustId = String(row.customerId || row.raw?.customerId || '').trim().toLowerCase();
      const rowPlanName = String(row.chitPlan || row.raw?.planName || row.raw?.plan || row.planName || '').trim().toLowerCase();

      // If the payment row has a cusId, it MUST match this plan's cusId!
      if (rowCusId) {
        if (!cusId || rowCusId !== cusId) return false;
      } else if (rowCustId) {
        const matchesId =
          (customerId && rowCustId === customerId) ||
          (linkedUserId && rowCustId === linkedUserId) ||
          (rowId && rowCustId === rowId);
        if (!matchesId) return false;
      } else {
        // No customer or plan IDs on row
        return false;
      }

      // 3. Check plan name match
      if (planName && rowPlanName) {
        const p1 = planName.replace(/[\s-_]+/g, '');
        const p2 = rowPlanName.replace(/[\s-_]+/g, '');
        return p1 === p2 || p1.includes(p2) || p2.includes(p1);
      }

      return !planName && !rowPlanName;
    });

    const normalized = matched.map((entry) => ({
      ...entry,
      amount: Number(entry.paidAmount ?? entry.amount ?? entry.dueAmount ?? 0),
      paidAmount: entry.paidAmount ?? entry.amount ?? 0,
      paymentMode: entry.mode || entry.paymentMode || 'Cash',
      mode: entry.mode || entry.paymentMode || 'Cash',
      planName: entry.chitPlan || entry.planName || '',
      chitPlan: entry.chitPlan || entry.planName || '',
    }));

    setData(normalized);
  });
}

export async function addCustomer(data) {
  const joinedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const cusId = (data.cusId && String(data.cusId).trim()) || (await generateUniqueCusId());
  const opening = Number(data.amount) || 0;

  const ref = await addDoc(collection(db, COLLECTION), {
    cusId,
    joinedDate,
    name: data.name,
    password: data.password,
    amount: opening,
    accountBalance: opening,
    plan: data.plan || 'Daily',
    mobile: data.mobile,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateCustomer(id, data) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (data.amount != null && data.accountBalance == null) {
    payload.accountBalance = Number(data.amount) || 0;
  }
  await updateDoc(doc(db, COLLECTION, id), payload);
}

/**
 * Credit Cash / UPI / Card to customer account AND linked plan purchase amount.
 * @param {string} customerId Firestore customers doc id
 * @param {{ amount: number, paymentMode: string, note?: string, planPurchaseId?: string }} credit
 */
export async function creditCustomerAccount(customerId, credit) {
  const amount = Number(credit.amount) || 0;
  if (amount <= 0) throw new Error('Amount must be greater than 0');
  const mode = credit.paymentMode || 'Cash';

  const ref = doc(db, COLLECTION, customerId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Customer not found');
  const data = snap.data();
  const current = Number(data.accountBalance ?? data.amount ?? 0) || 0;
  const next = current + amount;

  // Options for rate and quality
  const creditOptions = {
    quality: credit.quality || credit.purity || '',
    ratePerGram: credit.ratePerGram || null,
  };

  // Sync to plan purchases so Plan Purchases page stays dynamic
  const plans = await findPlanPurchasesForCustomer({
    id: customerId,
    cusId: data.cusId,
    mobile: data.mobile,
    name: data.name,
  });

  let targetPlanId = credit.planPurchaseId || null;
  let planAmountAfter = null;
  let planName = '';
  let addedWeight = 0;
  let ratePerGram = creditOptions.ratePerGram || null;
  let quality = creditOptions.quality || '22K (916)';

  if (!targetPlanId && plans.length) {
    const best = pickBestPlanPurchase(plans);
    if (best && (best._matchScore || 0) >= 40) {
      targetPlanId = best.id;
    }
  }

  if (targetPlanId) {
    if (plans.length > 0 && !plans.some((p) => p.id === targetPlanId)) {
      throw new Error('Selected plan does not belong to this customer. Pick the correct plan (same Customer ID).');
    }
    const updated = await creditPlanPurchaseAmount(targetPlanId, amount, mode, creditOptions);
    planAmountAfter = updated.amountAfter;
    planName = updated.planName || '';
    addedWeight = updated.addedWeight || 0;
    ratePerGram = updated.ratePerGram || null;
    quality = updated.quality || quality;
  } else {
    // If no plan linked, calculate added weight directly from metal rates
    try {
      const { getLatestMetalRates } = await import('./goldRatesService');
      const { pickRateForPlan, calcIncrementalWeight } = await import('../utils/weightUtils');
      const latestRates = await getLatestMetalRates();
      const picked = pickRateForPlan({ plan: data.plan }, latestRates, quality);
      ratePerGram = ratePerGram || picked.ratePerGram;
      quality = quality || picked.quality;
      if (ratePerGram && ratePerGram > 0) {
        addedWeight = Number((amount / ratePerGram).toFixed(4));
      }
    } catch (e) {
      console.warn('Could not compute fallback weight', e);
    }
  }

  // Sum previous customer weight + newly purchased weight
  const previousCustWeight = Number(data.savedWeight ?? data.goldWeight ?? 0) || 0;
  const nextCustWeight = Number((previousCustWeight + addedWeight).toFixed(4));

  // Update customer account balance and accumulated gold weight
  await updateDoc(ref, {
    accountBalance: next,
    savedWeight: nextCustWeight,
    goldWeight: nextCustWeight,
    lastRatePerGram: ratePerGram,
    lastQuality: quality,
    lastCreditAt: serverTimestamp(),
    lastPaymentMode: mode,
    updatedAt: serverTimestamp(),
  });

  // Persist history with gold weight metrics
  const ledgerRef = await addDoc(collection(db, LEDGER), {
    customerId,
    cusId: data.cusId || '',
    customerName: data.name || '',
    mobile: data.mobile || '',
    type: 'credit',
    amount,
    weight: addedWeight,
    savedWeightAfter: nextCustWeight,
    ratePerGram: ratePerGram,
    quality: quality,
    paymentMode: mode,
    note: credit.note || '',
    balanceAfter: next,
    planPurchaseId: targetPlanId || '',
    planName: planName || '',
    planAmountAfter: planAmountAfter,
    createdAt: serverTimestamp(),
  });

  // Also push into installments so Payment page unified history stays complete
  try {
    const { addInstallmentFromCustomerCredit } = await import('./installmentsService');
    await addInstallmentFromCustomerCredit({
      customerId,
      cusId: data.cusId || '',
      customerName: data.name || '',
      amount,
      weight: addedWeight,
      ratePerGram: ratePerGram,
      paymentMode: mode,
      planPurchaseId: targetPlanId || '',
      planName: planName || '',
      ledgerId: ledgerRef.id,
      note: credit.note || '',
    });
  } catch (e) {
    console.error('Failed to sync installment history from customer cash', e);
  }

  return {
    balance: next,
    savedWeight: nextCustWeight,
    addedWeight,
    planPurchaseId: targetPlanId,
    planAmountAfter,
  };
}

export async function deleteCustomer(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Subscribe to all payments (Installments, Direct Payments, Add Cash) for a specific customer.
 * Uses strict customer matching (cusId, customerId, or enrolled plan purchase IDs)
 * so customers with identical names or phone numbers never leak data into each other.
 */
export function subscribeCustomerAllPayments(customer, setData) {
  if (!customer) {
    setData([]);
    return () => {};
  }

  const cid = String(customer.id || '').trim().toLowerCase();
  const cusId = String(customer.cusId || '').trim().toLowerCase();
  const mobile = String(customer.mobile || '').replace(/\D/g, '');

  return subscribeAllPayments((allPayments) => {
    const customerPayments = allPayments.filter((row) => {
      const rowCusId = String(row.cusId || row.raw?.cusId || '').trim().toLowerCase();
      const rowCustId = String(row.customerId || row.raw?.customerId || '').trim().toLowerCase();
      const rowPlanId = String(
        row.planId ||
        row.planPurchaseId ||
        row.raw?.planId ||
        row.raw?.planPurchaseId ||
        row.raw?.planPurchaseDocId ||
        ''
      ).trim().toLowerCase();

      // 1. Authoritative cusId check:
      // If the payment record has a cusId, it MUST match the customer's cusId.
      // If it has a different cusId, it strictly belongs to another customer.
      if (rowCusId) {
        return cusId ? rowCusId === cusId : false;
      }

      // 2. Customer doc ID match:
      if (rowCustId) {
        if (cid && rowCustId === cid) return true;
        if (cusId && rowCustId === cusId) return true;
        return false;
      }

      // 3. Plan purchase ID link to customer doc id:
      if (cid && rowPlanId && rowPlanId === cid) {
        return true;
      }

      // 4. Legacy payments collection (where neither cusId nor customerId is present):
      if (!rowCusId && !rowCustId && !rowPlanId) {
        const rowMobile = String(row.mobile || row.raw?.mobile || '').replace(/\D/g, '');
        if (mobile && rowMobile && mobile === rowMobile) {
          return true;
        }
        const rowName = String(row.customerName || row.name || '').trim().toLowerCase();
        const custName = String(customer.name || '').trim().toLowerCase();
        if (custName && rowName === custName && custName !== 'test') {
          return true;
        }
      }

      return false;
    });

    setData(customerPayments);
  });
}

/**
 * Real-time subscription to plan purchases enrolled for a customer.
 */
export function subscribeCustomerPlans(customer, setData) {
  if (!customer) {
    setData([]);
    return () => {};
  }

  const cusId = String(customer.cusId || '').trim().toLowerCase();
  const cid = String(customer.id || '').trim().toLowerCase();

  return subscribePlanPurchases((allPlans) => {
    const plans = allPlans.filter((p) => {
      const pCusId = String(p.cusId || p.customerId || '').trim().toLowerCase();
      const pCustId = String(p.customerId || '').trim().toLowerCase();
      const pLinked = String(p.linked_user_id || p.linkedUserId || '').trim().toLowerCase();
      const pId = String(p.id || '').trim().toLowerCase();

      if (cusId && pCusId === cusId) return true;
      if (cid && pCustId === cid) return true;
      if (cid && pLinked === cid) return true;
      if (cid && pId === cid) return true;
      return false;
    });

    setData(plans);
  });
}

