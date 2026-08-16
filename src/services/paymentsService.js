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
    dueAmount: amount,
    paidAmount: amount,
    dueDate: paid,
    paidDate: paid,
    mode: entry.paymentMode || entry.mode || 'Cash',
    status: 'Completed',
    note: entry.note || '',
    ledgerId: entry.id,
    createdAt: entry.createdAt,
    _canEdit: false,
    _canDelete: false,
    _fromLedger: true,
    _collection: LEDGER,
    raw: entry,
  };
}

function subscribeCollection(colName, setRows) {
  const plain = collection(db, colName);
  const apply = (snapshot) => {
    setRows(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  const ordered = query(plain, orderBy('createdAt', 'desc'));
  let unsub = onSnapshot(ordered, apply, () => {
    unsub = onSnapshot(plain, apply, () => setRows([]));
  });
  return () => {
    if (typeof unsub === 'function') unsub();
  };
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
    unsubPayments();
    unsubInstallments();
    unsubLedger();
  };
}

/**
 * Add a payment (e.g. from mobile or web).
 */
export async function addPayment(data) {
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
 * Delete from whichever collection the unified row came from.
 */
export async function deleteUnifiedPayment(row) {
  if (!row?.id) throw new Error('Missing payment id');
  if (row._fromLedger || String(row.id).startsWith('ledger_')) {
    throw new Error('Add Cash history cannot be deleted from Payment. Manage it from Customers.');
  }
  const col = row._collection || COLLECTION;
  if (col === INSTALLMENTS) {
    await deleteDoc(doc(db, INSTALLMENTS, row.id));
    return;
  }
  await deleteDoc(doc(db, COLLECTION, row.id));
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
