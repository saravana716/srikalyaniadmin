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
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { findPlanPurchasesForCustomer, creditPlanPurchaseAmount, pickBestPlanPurchase } from './planPurchasesService';
import { subscribeAllPayments } from './paymentsService';

const COLLECTION = 'customers';
const LEDGER = 'customerLedger';

function generateUniqueCusId() {
  const t = Date.now();
  const r = Math.floor(1000 + Math.random() * 9000);
  return `CUS-${t}-${r}`;
}

export function subscribeCustomers(setData) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setData(list);
  }, (err) => {
    console.error('customers subscribe error', err);
    setData([]);
  });
}

/**
 * Live cash / UPI / Card credit history for one customer.
 */
export function subscribeCustomerLedger(customerId, setData) {
  if (!customerId) {
    setData([]);
    return () => {};
  }

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

  const ordered = query(
    collection(db, LEDGER),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  );

  let unsub = onSnapshot(ordered, apply, () => {
    unsub = onSnapshot(plain, apply, () => setData([]));
  });

  return () => {
    if (typeof unsub === 'function') unsub();
  };
}

function ledgerTime(entry) {
  return entry?.createdAt?.toMillis?.() || Date.parse(entry?.createdAt || 0) || 0;
}

/**
 * Payment / add-cash history for a plan purchase detail view.
 * Shows the same Add Cash history as the customer (all credits for that person).
 */
export function subscribePlanPaymentHistory(planRow, setData) {
  if (!planRow) {
    setData([]);
    return () => {};
  }

  const ids = new Set(
    [
      planRow.id,
      planRow.cusId,
      planRow.customerId,
      planRow.linked_user_id,
      planRow.linkedUserId,
    ]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
  );

  if (ids.size === 0) {
    setData([]);
    return () => {};
  }

  const unsubs = [];
  const bucket = new Map();

  const matchesCustomer = (entry) => {
    const entryKeys = [
      entry.customerId,
      entry.cusId,
      entry.linked_user_id,
      entry.linkedUserId,
    ].map((v) => String(v || '').trim()).filter(Boolean);
    return entryKeys.some((k) => ids.has(k));
  };

  const publish = () => {
    const list = Array.from(bucket.values()).filter(matchesCustomer);
    list.sort((a, b) => ledgerTime(b) - ledgerTime(a));
    setData(list);
  };

  const watch = (field, value) => {
    const unsub = onSnapshot(
      query(collection(db, LEDGER), where(field, '==', value)),
      (snap) => {
        snap.docs.forEach((d) => bucket.set(d.id, { id: d.id, ...d.data() }));
        publish();
      },
      () => publish()
    );
    unsubs.push(unsub);
  };

  ids.forEach((id) => {
    watch('customerId', id);
    watch('cusId', id);
  });

  return () => unsubs.forEach((u) => u?.());
}

export async function addCustomer(data) {
  const joinedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const cusId = generateUniqueCusId();
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
  let current = 0;
  if (data.savedAmount !== undefined || data.SavedAmount !== undefined) {
    current = Math.max(Number(data.accountBalance || 0), Number(data.savedAmount ?? data.SavedAmount ?? 0));
  } else {
    current = Number(data.accountBalance ?? data.amount ?? 0);
  }
  const next = current + amount;

  const payload = {
    accountBalance: next,
    amount: next,
    lastCreditAt: serverTimestamp(),
    lastPaymentMode: mode,
    updatedAt: serverTimestamp(),
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

  if (!targetPlanId && plans.length) {
    const best = pickBestPlanPurchase(plans);
    // Only auto-pick when match is clear (cusId / linked user / exact name+)
    if (best && (best._matchScore || 0) >= 40) {
      targetPlanId = best.id;
    }
  }

  if (targetPlanId) {
    if (plans.length > 0 && !plans.some((p) => p.id === targetPlanId)) {
      throw new Error('Selected plan does not belong to this customer. Pick the correct plan (same Customer ID).');
    }
    const updated = await creditPlanPurchaseAmount(targetPlanId, amount, mode);
    planAmountAfter = updated.amountAfter;
    planName = updated.planName || '';
    addedWeight = updated.addedWeight || 0;
  } else {
    throw new Error(
      'No matching Plan Purchase found for this customer. Open Plan Purchases and confirm the customer ID (cusId) matches.'
    );
  }

  payload.savedAmount = planAmountAfter;
  // Update customer account
  await updateDoc(ref, payload);

  // Persist history
  const ledgerRef = await addDoc(collection(db, LEDGER), {
    customerId,
    cusId: data.cusId || '',
    customerName: data.name || '',
    mobile: data.mobile || '',
    type: 'credit',
    amount,
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
      paymentMode: mode,
      planPurchaseId: targetPlanId || '',
      planName: planName || '',
      ledgerId: ledgerRef.id,
      note: credit.note || '',
      weight: addedWeight ? `${addedWeight} g` : '0.000 g',
    });
  } catch (e) {
    console.error('Failed to sync installment history from customer cash', e);
  }

  return { balance: next, planPurchaseId: targetPlanId, planAmountAfter };
}

export async function deleteCustomer(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Subscribe to all payments (Installments, Direct Payments, Add Cash) for a specific customer.
 */
export function subscribeCustomerAllPayments(customer, setData) {
  if (!customer) {
    setData([]);
    return () => {};
  }

  const cid = String(customer.id || '').trim().toLowerCase();
  const cusId = String(customer.cusId || '').trim().toLowerCase();
  const mobile = String(customer.mobile || '').trim().toLowerCase();
  const name = String(customer.name || '').trim().toLowerCase();

  return subscribeAllPayments((allPayments) => {
    const customerPayments = allPayments.filter((row) => {
      const rowCusId = String(row.cusId || row.customerId || '').trim().toLowerCase();
      const rowName = String(row.customerName || row.name || '').trim().toLowerCase();
      const rowMobile = String(row.mobile || '').trim().toLowerCase();

      if (cusId && rowCusId === cusId) return true;
      if (cid && rowCusId === cid) return true;
      if (mobile && rowMobile && rowMobile === mobile) return true;
      if (name && rowName && rowName === name) return true;

      return false;
    });

    setData(customerPayments);
  });
}

