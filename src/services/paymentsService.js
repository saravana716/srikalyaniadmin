import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  where,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'payments';
const INSTALLMENTS = 'installments';
const LEDGER = 'customerLedger';

function tsMillis(value, fallbackStr) {
  return value?.toMillis?.() || Date.parse(value || fallbackStr || 0) || 0;
}

function paidDateFromTs(ts) {
  try {
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts || Date.now());
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function mapPaymentRow(d) {
  return {
    id: d.id,
    source: 'payment',
    sourceLabel: 'Payment',
    customerName: d.customerName || '',
    cusId: d.cusId || d.customerId || '',
    chitPlan: d.chitPlan || d.planName || '',
    planName: d.chitPlan || d.planName || '',
    planId: d.planId || d.planPurchaseId || d.raw?.planId || d.raw?.planPurchaseId || '',
    planPurchaseId: d.planPurchaseId || d.planId || d.raw?.planPurchaseId || d.raw?.planId || '',
    dueAmount: d.dueAmount ?? '',
    paidAmount: d.paidAmount ?? d.amount ?? '',
    dueDate: d.dueDate || '',
    paidDate: d.paidDate || d.dueDate || '',
    mode: d.mode || d.paymentMode || '—',
    status: d.status || 'Pending',
    note: d.note || '',
    createdAt: d.createdAt,
    _canEdit: true,
    _canDelete: true,
    _collection: COLLECTION,
    raw: d,
  };
}

function mapInstallmentRow(d) {
  const paid = d.paidDate || paidDateFromTs(d.createdAt);
  const amount = d.amount ?? d.paidAmount ?? '';
  const statusRaw = d.status || 'Pending';
  const status =
    String(statusRaw).toLowerCase() === 'paid' || String(statusRaw).toLowerCase() === 'completed'
      ? 'Completed'
      : statusRaw === 'Pending'
        ? 'Pending'
        : statusRaw;
  return {
    id: d.id,
    source: d.source === 'customer_cash' ? 'customer_cash' : 'installment',
    sourceLabel: d.source === 'customer_cash' ? 'Add Cash' : 'Installment',
    customerName: d.customerName || '',
    cusId: d.cusId || d.customerId || '',
    chitPlan: d.planName || d.chitPlan || '',
    planName: d.planName || d.chitPlan || '',
    planId: d.planId || d.planPurchaseId || d.raw?.planId || d.raw?.planPurchaseId || '',
    planPurchaseId: d.planPurchaseId || d.planId || d.raw?.planPurchaseId || d.raw?.planId || '',
    dueAmount: d.dueAmount ?? amount,
    paidAmount: amount,
    dueDate: d.dueDate || paid,
    paidDate: paid,
    mode: d.mode || d.paymentMode || 'Cash',
    status,
    note: d.note || '',
    ledgerId: d.ledgerId || '',
    createdAt: d.createdAt,
    _canEdit: true,
    _canDelete: true,
    _collection: INSTALLMENTS,
    raw: d,
  };
}

function mapLedgerRow(entry) {
  const paid = paidDateFromTs(entry.createdAt);
  const amount = entry.amount != null ? String(entry.amount) : '';
  return {
    id: `ledger_${entry.id}`,
    source: 'customer_cash',
    sourceLabel: 'Add Cash',
    customerName: entry.customerName || '',
    cusId: entry.cusId || entry.customerId || '',
    chitPlan: entry.planName || '',
    planName: entry.planName || '',
    planId: entry.planId || entry.planPurchaseId || '',
    planPurchaseId: entry.planPurchaseId || entry.planId || '',
    dueAmount: amount,
    paidAmount: amount,
    dueDate: paid,
    paidDate: paid,
    mode: entry.paymentMode || entry.mode || 'Cash',
    status: 'Completed',
    note: entry.note || '',
    ledgerId: entry.id,
    createdAt: entry.createdAt,
    _canEdit: true,
    _canDelete: true,
    _fromLedger: true,
    _collection: LEDGER,
    raw: entry,
  };
}

function subscribeCollection(colName, setRows) {
  if (typeof setRows !== 'function') return () => { };
  try {
    const plain = collection(db, colName);
    const apply = (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || Date.parse(a.createdAt || a.paidDate || 0) || 0;
        const tb = b.createdAt?.toMillis?.() || Date.parse(b.createdAt || b.paidDate || 0) || 0;
        return tb - ta;
      });
      setRows(list);
    };

    const unsub = onSnapshot(
      plain,
      apply,
      (err) => {
        console.warn(`onSnapshot failed for ${colName}, falling back to getDocs:`, err);
        getDocs(plain)
          .then(apply)
          .catch(() => setRows([]));
      }
    );

    return () => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        console.warn(`Unsubscribe caught error for ${colName}:`, e);
      }
    };
  } catch (err) {
    console.warn(`subscribeCollection failed for ${colName}:`, err);
    setRows([]);
    return () => { };
  }
}

/**
 * Subscribe to payments list (real-time). Returns unsubscribe function.
 */
export function subscribePayments(setData) {
  return subscribeCollection(COLLECTION, setData);
}

/**
 * Live unified payment history:
 * - payments collection
 * - installments collection
 * - customerLedger (Add Cash) — deduped when already linked to an installment
 */
export function subscribeAllPayments(setData) {
  let paymentDocs = [];
  let installmentDocs = [];
  let ledgerDocs = [];

  const publish = () => {
    const paymentRows = paymentDocs.map(mapPaymentRow);
    const installmentRows = installmentDocs.map(mapInstallmentRow);
    const linkedLedgerIds = new Set(
      installmentDocs.map((r) => String(r.ledgerId || '').trim()).filter(Boolean)
    );
    const ledgerRows = ledgerDocs
      .filter((d) => !linkedLedgerIds.has(String(d.id || '').trim()))
      .map(mapLedgerRow);

    const merged = [...paymentRows, ...installmentRows, ...ledgerRows];
    merged.sort((a, b) => {
      const tb = tsMillis(b.createdAt, b.paidDate || b.dueDate);
      const ta = tsMillis(a.createdAt, a.paidDate || a.dueDate);
      return tb - ta;
    });
    setData(merged);
  };

  const unsubPayments = subscribeCollection(COLLECTION, (list) => {
    paymentDocs = list;
    publish();
  });
  const unsubInstallments = subscribeCollection(INSTALLMENTS, (list) => {
    installmentDocs = list;
    publish();
  });
  const unsubLedger = subscribeCollection(LEDGER, (list) => {
    ledgerDocs = list;
    publish();
  });

  return () => {
    try { if (typeof unsubPayments === 'function') unsubPayments(); } catch (e) { }
    try { if (typeof unsubInstallments === 'function') unsubInstallments(); } catch (e) { }
    try { if (typeof unsubLedger === 'function') unsubLedger(); } catch (e) { }
  };
}

/**
 * Record a Chit Fund / Gold Scheme payment or installment with full synchronization:
 * 1. Inserts record into 'installments' collection with cusId, planId, amount, mode, status.
 * 2. If status is Completed, credits the linked planPurchase in 'planPurchases' (savedAmount, paidInstallments, savedWeight).
 * 3. Credits the customer's account in 'customers' (accountBalance).
 * 4. Logs to 'customerLedger'.
 */
export async function recordChitPayment(data) {
  const amount = Number(data.paidAmount ?? data.amount) || 0;
  if (amount <= 0) throw new Error('Payment amount must be greater than 0');

  const mode = data.mode || data.paymentMode || 'Cash';
  const status = data.status === 'Pending' ? 'Pending' : 'Completed';
  const paidDate = data.paidDate || data.dueDate || new Date().toISOString().slice(0, 10);
  const installmentNo = data.installmentNo || `INST-${Date.now().toString().slice(-6)}`;
  const cusId = String(data.cusId || '').trim();
  const customerId = String(data.customerId || '').trim();
  const customerName = String(data.customerName || '').trim();
  const planId = String(data.planId || data.planPurchaseId || '').trim();
  const planName = String(data.planName || data.chitPlan || '').trim();
  const note = String(data.note || '').trim();

  // 1. Create installment record in installments collection
  const instRef = await addDoc(collection(db, INSTALLMENTS), {
    installmentNo,
    dueDate: data.dueDate || paidDate,
    paidDate,
    amount: String(amount),
    mode,
    status: status === 'Completed' ? 'Paid' : 'Pending',
    customerId,
    cusId,
    customerName,
    planId,
    planName,
    note,
    source: data.source || 'chit_installment',
    createdAt: serverTimestamp(),
  });

  // 2. If completed, sync to Plan Purchase, Customer account, and Ledger
  if (status === 'Completed') {
    let updatedPlan = null;
    // Sync to plan purchase if linked
    if (planId) {
      try {
        const { creditPlanPurchaseAmount } = await import('./planPurchasesService');
        updatedPlan = await creditPlanPurchaseAmount(planId, amount, mode, {
          quality: data.quality,
          ratePerGram: data.ratePerGram,
        });
      } catch (err) {
        console.warn('Could not sync to plan purchase', err);
      }
    }

    // Sync to customer account if customerId or cusId exists
    if (customerId || cusId) {
      try {
        let custRef = customerId ? doc(db, 'customers', customerId) : null;
        let custSnap = custRef ? await getDoc(custRef) : null;

        // If not found by direct doc ID, look up by cusId
        if (!custSnap || !custSnap.exists()) {
          const searchCusId = cusId || customerId;
          if (searchCusId) {
            const qCust = query(collection(db, 'customers'), where('cusId', '==', searchCusId));
            const snapCus = await getDocs(qCust);
            if (!snapCus.empty) {
              custRef = snapCus.docs[0].ref;
              custSnap = snapCus.docs[0];
            }
          }
        }

        if (custSnap && custSnap.exists()) {
          const custData = custSnap.data();
          const currentBal = Number(custData.accountBalance ?? custData.amount ?? 0) || 0;
          const nextBal = currentBal + amount;
          const prevCustWeight = Number(custData.savedWeight ?? custData.goldWeight ?? 0) || 0;
          const nextCustWeight = Number((prevCustWeight + (updatedPlan?.addedWeight || 0)).toFixed(4));
          await updateDoc(custRef, {
            accountBalance: nextBal,
            amount: nextBal,
            savedWeight: nextCustWeight,
            goldWeight: nextCustWeight,
            lastCreditAt: serverTimestamp(),
            lastPaymentMode: mode,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Could not sync to customer balance', err);
      }
    }

    // Add to customer ledger with gold weight metrics
    try {
      await addDoc(collection(db, LEDGER), {
        customerId,
        cusId,
        customerName,
        mobile: data.mobile || '',
        type: 'credit',
        amount,
        weight: updatedPlan?.addedWeight || 0,
        savedWeightAfter: updatedPlan?.savedWeight || null,
        ratePerGram: updatedPlan?.ratePerGram || null,
        quality: updatedPlan?.quality || '',
        paymentMode: mode,
        note,
        planPurchaseId: planId,
        planName,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Could not sync to customer ledger', err);
    }
  }

  return { id: instRef.id };
}

/**
 * Add a payment (unified helper for chit payments & manual entries).
 */
export async function addPayment(data) {
  if (data.customerId || data.cusId || data.planId) {
    return recordChitPayment(data);
  }
  const ref = await addDoc(collection(db, COLLECTION), {
    customerName: data.customerName,
    chitPlan: data.chitPlan,
    dueAmount: data.dueAmount,
    paidAmount: data.paidAmount,
    dueDate: data.dueDate,
    status: data.status || 'Pending',
    mode: data.mode || 'Cash',
    cusId: data.cusId || '',
    note: data.note || '',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/**
 * Update a payment by id (payments collection only).
 */
export async function updatePayment(id, data) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a payment by id (payments collection only).
 */
export async function deletePayment(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Delete from whichever collection the unified row came from (payments, installments, or customerLedger).
 */
export async function deleteUnifiedPayment(row) {
  if (!row) throw new Error('Missing payment entry');
  
  const rawId = row.id || row.raw?.id;
  if (!rawId) throw new Error('Missing payment id');

  const cleanId = String(rawId).replace(/^ledger_/, '');
  const ledgerId = row.ledgerId || row.raw?.ledgerId || (String(rawId).startsWith('ledger_') ? cleanId : null);
  const col = row._collection || (String(rawId).startsWith('ledger_') ? LEDGER : COLLECTION);

  const deletePromises = [];

  // 1. Delete from customerLedger if it has a ledgerId or came from customerLedger
  if (ledgerId || col === LEDGER || row._fromLedger || row.source === 'customer_cash') {
    const targetLedgerId = ledgerId || cleanId;
    if (targetLedgerId) {
      deletePromises.push(deleteDoc(doc(db, LEDGER, targetLedgerId)).catch(() => {}));
    }
  }

  // 2. Delete from installments if it came from installments or has a linked ledgerId
  if (col === INSTALLMENTS || row.source === 'installment' || row.source === 'customer_cash' || ledgerId) {
    if (col === INSTALLMENTS || (!String(rawId).startsWith('ledger_') && row.source !== 'payment')) {
      deletePromises.push(deleteDoc(doc(db, INSTALLMENTS, cleanId)).catch(() => {}));
    }
    if (ledgerId) {
      try {
        const instSnap = await getDocs(query(collection(db, INSTALLMENTS), where('ledgerId', '==', ledgerId)));
        instSnap.docs.forEach((d) => {
          deletePromises.push(deleteDoc(d.ref).catch(() => {}));
        });
      } catch (e) {
        console.warn('Find linked installment error:', e);
      }
    }
  }

  // 3. Delete from payments collection if it came from payments
  if (col === COLLECTION || row.source === 'payment') {
    deletePromises.push(deleteDoc(doc(db, COLLECTION, cleanId)).catch(() => {}));
  }

  // Fallback if empty
  if (deletePromises.length === 0) {
    deletePromises.push(deleteDoc(doc(db, col, cleanId)).catch(() => {}));
  }

  await Promise.all(deletePromises);
}

/**
 * Update installment or payment row based on source.
 */
export async function updateUnifiedPayment(row, data) {
  if (!row?.id) throw new Error('Missing payment id');
  if (row._fromLedger || String(row.id).startsWith('ledger_')) {
    throw new Error('Add Cash history cannot be edited from Payment.');
  }
  const col = row._collection || COLLECTION;
  if (col === INSTALLMENTS) {
    await updateDoc(doc(db, INSTALLMENTS, row.id), {
      installmentNo: data.installmentNo,
      customerName: data.customerName,
      planName: data.chitPlan,
      dueDate: data.dueDate,
      paidDate: data.paidDate || data.dueDate,
      amount: data.paidAmount,
      dueAmount: data.dueAmount,
      mode: data.mode || 'Cash',
      status: data.status === 'Completed' ? 'Paid' : data.status,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await updatePayment(row.id, {
    customerName: data.customerName,
    chitPlan: data.chitPlan,
    dueAmount: data.dueAmount,
    paidAmount: data.paidAmount,
    dueDate: data.dueDate,
    status: data.status,
    mode: data.mode,
  });
}
