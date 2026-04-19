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

const COLLECTION = 'customers';

/**
 * Generate a unique customer ID: CUS-<timestamp>-<random 4 digits>
 * Ensures each new customer gets a different cusId even with concurrent adds.
 */
function generateUniqueCusId() {
  const t = Date.now();
  const r = Math.floor(1000 + Math.random() * 9000);
  return `CUS-${t}-${r}`;
}

/**
 * Subscribe to customers list (real-time). Returns unsubscribe function.
 * @param {(data: Array<{ id: string, ... }>) => void} setData
 * @returns {() => void} unsubscribe
 */
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
 * Add a customer with a unique cusId.
 * @param {{ name: string, password: string, amount: number, plan: string, mobile: string }} data
 * @returns {Promise<{ id: string }>}
 */
export async function addCustomer(data) {
  const joinedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const cusId = generateUniqueCusId();

  const ref = await addDoc(collection(db, COLLECTION), {
    cusId,
    joinedDate,
    name: data.name,
    password: data.password,
    amount: Number(data.amount) || 0,
    plan: data.plan || 'Daily',
    mobile: data.mobile,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/**
 * Update a customer by id.
 * @param {string} id
 * @param {Partial<{ name, password, amount, plan, mobile }>} data
 */
export async function updateCustomer(id, data) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a customer by id.
 * @param {string} id
 */
export async function deleteCustomer(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
