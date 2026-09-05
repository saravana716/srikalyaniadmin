import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'installments';
const LEDGER = 'customerLedger';

/**
 * Subscribe to installments list (real-time). Returns unsubscribe function.
 * @param {(data: Array<{ id: string, ... }>) => void} setData
 * @returns {() => void} unsubscribe
 */
export function subscribeInstallments(setData) {
  if (typeof setData !== 'function') return () => {};
  try {
    const plain = collection(db, COLLECTION);

    const apply = (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || Date.parse(a.createdAt || a.paidDate || 0) || 0;
        const tb = b.createdAt?.toMillis?.() || Date.parse(b.createdAt || b.paidDate || 0) || 0;
        return tb - ta;
      });
      setData(list);
    };

    const unsub = onSnapshot(
      plain,
      apply,
      (err) => {
        console.warn('subscribeInstallments error, falling back to getDocs:', err);
        getDocs(plain)
          .then(apply)
          .catch(() => setData([]));
      }
    );

    return () => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        console.warn('subscribeInstallments unsub ignored:', e);
      }
    };
  } catch (err) {
    console.warn('subscribeInstallments query init failed:', err);
    setData([]);
    return () => {};
  }
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

function mapLedgerToInstallmentRow(entry) {
  const paidDate = paidDateFromTs(entry.createdAt);
  return {
    id: `ledger_${entry.id}`,
    installmentNo: entry.installmentNo || `CASH-${String(entry.id).slice(-6).toUpperCase()}`,
    dueDate: paidDate,
    paidDate,
    amount: entry.amount != null ? String(entry.amount) : '',
    weight: entry.weight ?? 0,
    ratePerGram: entry.ratePerGram ?? 0,
    quality: entry.quality ?? '',
    mode: entry.paymentMode || entry.mode || 'Cash',
    status: 'Paid',
    customerId: entry.customerId || '',
    cusId: entry.cusId || '',
    customerName: entry.customerName || '',
    planId: entry.planPurchaseId || '',
    planName: entry.planName || '',
    note: entry.note || '',
    ledgerId: entry.id,
    source: 'customer_cash',
    createdAt: entry.createdAt,
    _fromLedger: true,
  };
}

/**
 * Live merge: installments collection + customer Add Cash ledger history.
 * Dedupes when an installment already stores ledgerId.
 */
export function subscribeInstallmentHistory(setData) {
  if (typeof setData !== 'function') return () => {};
  let installmentRows = [];
  let ledgerRows = [];

  const publish = () => {
    const linkedLedgerIds = new Set(
      installmentRows.map((r) => String(r.ledgerId || '').trim()).filter(Boolean)
    );
    const fromLedger = ledgerRows.filter((r) => !linkedLedgerIds.has(String(r.ledgerId || '').trim()));
    const merged = [...installmentRows, ...fromLedger];
    merged.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || Date.parse(a.createdAt || a.paidDate || 0) || 0;
      const tb = b.createdAt?.toMillis?.() || Date.parse(b.createdAt || b.paidDate || 0) || 0;
      return tb - ta;
    });
    setData(merged);
  };

  const unsubInstallments = subscribeInstallments((list) => {
    installmentRows = list;
    publish();
  });

  const ledgerRef = collection(db, LEDGER);
  const applyLedger = (snapshot) => {
    ledgerRows = snapshot.docs.map((d) => mapLedgerToInstallmentRow({ id: d.id, ...d.data() }));
    publish();
  };

  let unsubLedger = null;
  try {
    unsubLedger = onSnapshot(
      ledgerRef,
      applyLedger,
      (err) => {
        console.warn('subscribeInstallmentHistory ledger error, falling back to getDocs:', err);
        getDocs(ledgerRef)
          .then(applyLedger)
          .catch(() => {
            ledgerRows = [];
            publish();
          });
      }
    );
  } catch (e) {
    console.warn('subscribeInstallmentHistory init failed:', e);
  }

  return () => {
    try {
      if (typeof unsubInstallments === 'function') unsubInstallments();
    } catch (e) {}
    try {
      if (typeof unsubLedger === 'function') unsubLedger();
    } catch (e) {}
  };
}

/**
 * Add an installment.
 */
export async function addInstallment(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    installmentNo: data.installmentNo ?? '',
    dueDate: data.dueDate ?? '',
    paidDate: data.paidDate ?? '',
    amount: data.amount ?? '',
    weight: data.weight ?? 0,
    ratePerGram: data.ratePerGram ?? 0,
    quality: data.quality ?? '',
    mode: data.mode ?? 'Cash',
    status: data.status ?? 'Pending',
    customerId: data.customerId ?? '',
    cusId: data.cusId ?? '',
    customerName: data.customerName ?? '',
    planId: data.planId ?? '',
    planName: data.planName ?? '',
    ledgerId: data.ledgerId ?? '',
    note: data.note ?? '',
    source: data.source ?? 'manual',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/**
 * Create a Paid installment row from Customer Add Cash / account credit.
 */
export async function addInstallmentFromCustomerCredit(credit) {
  const paidDate = paidDateFromTs(credit.paidAt || Date.now());
  const installmentNo = `PAY-${Date.now().toString().slice(-8)}`;
  return addInstallment({
    installmentNo,
    dueDate: paidDate,
    paidDate,
    amount: String(credit.amount ?? ''),
    weight: credit.weight ?? 0,
    ratePerGram: credit.ratePerGram ?? 0,
    quality: credit.quality ?? '',
    mode: credit.paymentMode || credit.mode || 'Cash',
    status: 'Paid',
    customerId: credit.customerId || '',
    cusId: credit.cusId || '',
    customerName: credit.customerName || '',
    planId: credit.planPurchaseId || '',
    planName: credit.planName || '',
    ledgerId: credit.ledgerId || '',
    note: credit.note || '',
    source: 'customer_cash',
  });
}

/**
 * Update an installment by id.
 */
export async function updateInstallment(id, data) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an installment by id.
 */
export async function deleteInstallment(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
