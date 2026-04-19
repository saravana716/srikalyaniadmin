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

const COLLECTION = 'plans';

/**
 * Subscribe to plans list (real-time). Returns unsubscribe function.
 * @param {(data: Array<{ id: string, ... }>) => void} setData
 * @returns {() => void} unsubscribe
 */
export function subscribePlans(setData) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setData(list);
  }, (err) => {
    console.error('plans subscribe error', err);
    setData([]);
  });
}

/**
 * Add a plan.
 * @param {{ planName: string, monthlyAmount: string, durationMonths: string, totalValue: string, bonus: string, status: string }} data
 * @returns {Promise<{ id: string }>}
 */
export async function addPlan(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    planName: data.planName,
    monthlyAmount: data.monthlyAmount,
    durationMonths: data.durationMonths,
    totalValue: data.totalValue,
    bonus: data.bonus,
    status: data.status || 'Active',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/**
 * Update a plan by id.
 * @param {string} id
 * @param {Partial<{ planName, monthlyAmount, durationMonths, totalValue, bonus, status }>} data
 */
export async function updatePlan(id, data) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a plan by id.
 * @param {string} id
 */
export async function deletePlan(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
