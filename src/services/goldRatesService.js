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
 * Shared singleton state for latest metal rates to avoid duplicate watch stream targets
 * and prevent Firestore internal assertion failure (ca9 / b815).
 */
let cachedLatestRates = null;
const latestRatesListeners = new Set();
let latestRatesUnsubscribe = null;
let latestRatesCleanupTimeout = null;

function notifyLatestListeners(data) {
  cachedLatestRates = data;
  latestRatesListeners.forEach((listener) => {
    try {
      listener(data);
    } catch (e) {
      console.warn('Error in metal rate listener:', e);
    }
  });
}

function startSharedLatestRatesSubscription() {
  if (latestRatesUnsubscribe) return;
  if (latestRatesCleanupTimeout) {
    clearTimeout(latestRatesCleanupTimeout);
    latestRatesCleanupTimeout = null;
  }

  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    latestRatesUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docSnap = snapshot.docs[0];
        const data = docSnap ? { id: docSnap.id, ...docSnap.data() } : null;
        notifyLatestListeners(data);
      },
      (err) => {
        console.warn('latest metal rates onSnapshot error, falling back to getDocs:', err);
        getLatestMetalRates().then((data) => {
          if (data) notifyLatestListeners(data);
        }).catch(() => {});
      }
    );
  } catch (err) {
    console.warn('Failed to start onSnapshot for latest metal rates, using fallback:', err);
    getLatestMetalRates().then((data) => {
      if (data) notifyLatestListeners(data);
    }).catch(() => {});
  }
}

function stopSharedLatestRatesSubscription() {
  if (latestRatesCleanupTimeout) {
    clearTimeout(latestRatesCleanupTimeout);
  }
  // Delay cleanup by 15s so opening/closing modals or navigation doesn't tear down and recreate watch stream
  latestRatesCleanupTimeout = setTimeout(() => {
    if (latestRatesListeners.size === 0 && latestRatesUnsubscribe) {
      try {
        latestRatesUnsubscribe();
      } catch (e) {
        // ignore
      }
      latestRatesUnsubscribe = null;
    }
    latestRatesCleanupTimeout = null;
  }, 15000);
}

/**
 * Live latest gold/silver rate entry (shared singleton stream).
 */
export function subscribeLatestMetalRates(setLatest) {
  if (typeof setLatest !== 'function') return () => {};

  // If already cached, immediately return current value
  if (cachedLatestRates !== null) {
    try {
      setLatest(cachedLatestRates);
    } catch (e) {}
  } else {
    // Initial fetch while waiting for stream
    getLatestMetalRates().then((val) => {
      if (val && cachedLatestRates === null) {
        notifyLatestListeners(val);
      }
    }).catch(() => {});
  }

  latestRatesListeners.add(setLatest);
  startSharedLatestRatesSubscription();

  return () => {
    latestRatesListeners.delete(setLatest);
    if (latestRatesListeners.size === 0) {
      stopSharedLatestRatesSubscription();
    }
  };
}

/**
 * One-shot fetch of latest rates (for writes / weight sync).
 */
export async function getLatestMetalRates() {
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    }
  } catch (err) {
    console.warn('getLatestMetalRates orderBy query failed, attempting in-memory sort fallback:', err);
  }

  // Fallback: fetch without order constraint and sort in memory
  try {
    const allSnap = await getDocs(collection(db, COLLECTION));
    if (allSnap.empty) return null;
    const sorted = allSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const tA = a.createdAt?.toMillis?.() || (a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0));
        const tB = b.createdAt?.toMillis?.() || (b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0));
        return tB - tA;
      });
    return sorted[0] || null;
  } catch (e2) {
    console.error('getLatestMetalRates fallback failed:', e2);
    return null;
  }
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

/**
 * Update an existing gold/silver rate entry.
 */
export async function updateGoldRate(id, data) {
  await updateDoc(doc(db, COLLECTION, id), {
    date: data.date,
    goldRate: String(data.goldRate ?? ''),
    silverRate: String(data.silverRate ?? ''),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a gold/silver rate entry.
 */
export async function deleteGoldRate(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

