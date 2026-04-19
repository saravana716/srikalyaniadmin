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

const COLLECTION = 'planPurchases';

/**
 * Subscribe to plan purchases (enrollments) list (real-time). Returns unsubscribe function.
 * @param {(data: Array<{ id: string, ... }>) => void} setData
 * @returns {() => void} unsubscribe
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
    setData([]);
  });
}

/**
 * Add a plan purchase (customer enrolled in a plan).
 * @param {{ customerId: string, customerName: string, planId: string, planName: string, startDate: string, status?: string }} data
 * @returns {Promise<{ id: string }>}
 */
export async function addPlanPurchase(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    customerId: data.customerId ?? '',
    customerName: data.customerName ?? '',
    planId: data.planId ?? '',
    planName: data.planName ?? '',
    startDate: data.startDate ?? '',
    status: data.status ?? 'Active',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/**
 * Update a plan purchase by id.
 */
export async function updatePlanPurchase(id, data) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a plan purchase by id.
 */
export async function deletePlanPurchase(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
