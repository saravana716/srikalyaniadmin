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

/** Map Firestore doc — primary fields: name, type, duration, description (mobile app schema). */
function normalizePlan(docSnap) {
  const d = docSnap.data();
  const name = d.name ?? d.Name ?? d.planName ?? d.PlanName ?? '';
  const type = d.type ?? d.Type ?? d.plan ?? d.Plan ?? 'Monthly';
  const description = d.description ?? d.Description ?? '';
  const isDaily = String(type).toLowerCase().includes('daily');
  const isWeekly = String(type).toLowerCase().includes('weekly');
  const defaultDuration = isDaily ? 330 : (isWeekly ? 52 : 11);
  const rawDuration = d.duration ?? d.Duration ?? (isDaily ? d.durationDays : d.durationMonths);
  const duration = rawDuration != null && !isNaN(Number(rawDuration)) && Number(rawDuration) > 0
    ? Number(rawDuration)
    : defaultDuration;
  const durationUnit = d.durationUnit || (isDaily ? 'Days' : (isWeekly ? 'Weeks' : 'Months'));

  return {
    id: docSnap.id,
    name,
    type,
    description,
    duration,
    durationUnit,
    durationDays: isDaily ? duration : (Number(d.durationDays) || duration * 30),
    durationMonths: (!isDaily && !isWeekly) ? duration : (Number(d.durationMonths) || Math.round(duration / 30) || 11),
    durationWeeks: isWeekly ? duration : (Number(d.durationWeeks) || Math.round(duration / 7)),
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
  if (typeof setData !== 'function') return () => {};

  getDocsFromServer(collection(db, COLLECTION))
    .then((snap) => setData(mapSnapshot(snap)))
    .catch((err) => {
      console.warn('plans initial fetch error:', err);
      onError?.(err);
    });

  try {
    const unsub = onSnapshot(
      collection(db, COLLECTION),
      (snapshot) => {
        setData(mapSnapshot(snapshot));
      },
      (err) => {
        console.warn('plans subscribe error:', err);
        onError?.(err);
      }
    );

    return () => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        console.warn('subscribePlans unsub error ignored:', e);
      }
    };
  } catch (err) {
    console.warn('subscribePlans failed:', err);
    return () => {};
  }
}

export async function addPlan(data) {
  const isDaily = String(data.type).toLowerCase().includes('daily');
  const isWeekly = String(data.type).toLowerCase().includes('weekly');
  const defaultDuration = isDaily ? 330 : (isWeekly ? 52 : 11);
  const duration = Number(data.duration) || defaultDuration;
  const durationUnit = isDaily ? 'Days' : (isWeekly ? 'Weeks' : 'Months');

  const ref = await addDoc(collection(db, COLLECTION), {
    name: data.name,
    type: data.type,
    description: data.description || '',
    duration: duration,
    durationUnit: durationUnit,
    durationDays: isDaily ? duration : duration * 30,
    durationMonths: (!isDaily && !isWeekly) ? duration : Math.round(duration / 30) || 11,
    durationWeeks: isWeekly ? duration : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updatePlan(id, data) {
  const isDaily = String(data.type).toLowerCase().includes('daily');
  const isWeekly = String(data.type).toLowerCase().includes('weekly');
  const defaultDuration = isDaily ? 330 : (isWeekly ? 52 : 11);
  const duration = Number(data.duration) || defaultDuration;
  const durationUnit = isDaily ? 'Days' : (isWeekly ? 'Weeks' : 'Months');

  await updateDoc(doc(db, COLLECTION, id), {
    name: data.name,
    type: data.type,
    description: data.description || '',
    duration: duration,
    durationUnit: durationUnit,
    durationDays: isDaily ? duration : duration * 30,
    durationMonths: (!isDaily && !isWeekly) ? duration : Math.round(duration / 30) || 11,
    durationWeeks: isWeekly ? duration : null,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePlan(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
