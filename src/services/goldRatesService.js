import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'goldRates';

/**
 * Subscribe to gold rates list (real-time). Returns unsubscribe function.
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
 * Live latest gold/silver rate entry.
 */
export function subscribeLatestMetalRates(setLatest) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  return onSnapshot(q, (snapshot) => {
    const docSnap = snapshot.docs[0];
    setLatest(docSnap ? { id: docSnap.id, ...docSnap.data() } : null);
  }, (err) => {
    console.error('latest metal rates subscribe error', err);
    setLatest(null);
  });
}

/**
 * One-shot fetch of latest rates (for writes / weight sync).
 */
export async function getLatestMetalRates() {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Add a gold/silver rate entry.
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
