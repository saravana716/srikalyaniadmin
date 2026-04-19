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

/**
 * Subscribe to installments list (real-time). Returns unsubscribe function.
 * @param {(data: Array<{ id: string, ... }>) => void} setData
 * @returns {() => void} unsubscribe
 */
export function subscribeInstallments(setData) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setData(list);
  }, (err) => {
    console.error('installments subscribe error', err);
    setData([]);
  });
}

/**
 * Add an installment.
 * @param {{ installmentNo: string, dueDate: string, paidDate: string, amount: string, mode: string, status: string, customerId?: string, planId?: string }} data
 * @returns {Promise<{ id: string }>}
 */
export async function addInstallment(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    installmentNo: data.installmentNo ?? '',
    dueDate: data.dueDate ?? '',
    paidDate: data.paidDate ?? '',
    amount: data.amount ?? '',
    mode: data.mode ?? 'Cash',
    status: data.status ?? 'Pending',
    customerId: data.customerId ?? '',
    planId: data.planId ?? '',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
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
