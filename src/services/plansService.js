import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocsFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'plans';

function tsMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

/** Map Firestore doc — primary fields: name, type, description (mobile app schema). */
function normalizePlan(docSnap) {
  const d = docSnap.data();
  const name = d.name ?? d.Name ?? d.planName ?? d.PlanName ?? '';
  const type = d.type ?? d.Type ?? d.plan ?? d.Plan ?? '';
  const description = d.description ?? d.Description ?? '';
  return {
    id: docSnap.id,
    name,
    type,
    description,
    planName: name,
    plan: type,
    status: d.status ?? d.Status ?? 'Active',
    createdAt: d.createdAt ?? null,
    updatedAt: d.updatedAt ?? null,
  };
}

function sortPlans(list) {
  return [...list].sort((a, b) => {
    const at = tsMillis(a.updatedAt) || tsMillis(a.createdAt);
    const bt = tsMillis(b.updatedAt) || tsMillis(b.createdAt);
    if (bt !== at) return bt - at;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function mapSnapshot(snapshot) {
  return sortPlans(snapshot.docs.map(normalizePlan));
}

/**
 * Subscribe to plans (real-time). Fetches from server first to avoid stale empty cache.
 */
export function subscribePlans(setData, onError) {
  getDocsFromServer(collection(db, COLLECTION))
    .then((snap) => setData(mapSnapshot(snap)))
    .catch((err) => {
      console.error('plans initial fetch error', err);
      onError?.(err);
    });

  return onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => {
      setData(mapSnapshot(snapshot));
    },
    (err) => {
      console.error('plans subscribe error', err);
      onError?.(err);
      setData([]);
    }
  );
}

export async function addPlan(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    name: data.name,
    type: data.type,
    description: data.description || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updatePlan(id, data) {
  await updateDoc(doc(db, COLLECTION, id), {
    name: data.name,
    type: data.type,
    description: data.description || '',
    updatedAt: serverTimestamp(),
  });
}

export async function deletePlan(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
