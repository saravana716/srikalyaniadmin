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

const COLLECTION = 'app_users';

export function subscribeAppUsers(setData) {
  if (typeof setData !== 'function') return () => {};
  try {
    const plain = collection(db, COLLECTION);

    const apply = (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || Date.parse(a.createdAt || a.joinedDate || 0) || 0;
        const tb = b.createdAt?.toMillis?.() || Date.parse(b.createdAt || b.joinedDate || 0) || 0;
        return tb - ta;
      });
      setData(list);
    };

    const unsub = onSnapshot(
      plain,
      apply,
      (err) => {
        console.warn('app_users subscribe error, falling back to getDocs:', err);
        getDocs(plain)
          .then(apply)
          .catch(() => setData([]));
      }
    );

    return () => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        console.warn('subscribeAppUsers unsub ignored:', e);
      }
    };
  } catch (err) {
    console.warn('subscribeAppUsers query init failed:', err);
    setData([]);
    return () => {};
  }
}

export async function addAppUser(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    role: data.role || 'app_user',
    type: data.type || 'app_user',
    joinedDate: data.joinedDate || new Date().toISOString().slice(0, 19).replace('T', ' '),
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateAppUser(id, data) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAppUser(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
