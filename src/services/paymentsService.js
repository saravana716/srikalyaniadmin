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

/**
 * Subscribe to payments list (real-time). Returns unsubscribe function.
 * @param {(data: Array<{ id: string, ... }>) => void} setData
 * @returns {() => void} unsubscribe
 */
export function subscribePayments(setData) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setData(list);
  }, (err) => {
    console.error('payments subscribe error', err);
    setData([]);
  });
}

/**
 * Add a payment (e.g. from mobile or web).
 * @param {{ customerName: string, chitPlan: string, dueAmount: string, paidAmount: string, dueDate: string, status: string }} data
 * @returns {Promise<{ id: string }>}
 */
export async function addPayment(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    customerName: data.customerName,
    chitPlan: data.chitPlan,
    dueAmount: data.dueAmount,
    paidAmount: data.paidAmount,
    dueDate: data.dueDate,
    status: data.status || 'Pending',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/**
 * Update a payment by id.
 * @param {string} id
 * @param {Partial<{ customerName, chitPlan, dueAmount, paidAmount, dueDate, status }>} data
 */
export async function updatePayment(id, data) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a payment by id.
 * @param {string} id
 */
export async function deletePayment(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
