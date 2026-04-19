import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'goldRates';

/**
 * Subscribe to gold rates list (real-time). Returns unsubscribe function.
 * @param {(data: Array<{ id: string, ... }>) => void} setData
 * @returns {() => void} unsubscribe
 */
export function subscribeGoldRates(setData) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setData(list);
  }, (err) => {
    console.error('goldRates subscribe error', err);
    setData([]);
  });
}

/**
 * Add a gold/silver rate entry.
 * @param {{ date: string, goldRate: string|number, silverRate: string|number }} data
 * @returns {Promise<{ id: string }>}
 */
export async function addGoldRate(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    date: data.date,
    goldRate: String(data.goldRate ?? ''),
    silverRate: String(data.silverRate ?? ''),
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}
