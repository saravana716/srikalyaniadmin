import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'offers';

export function subscribeOffers(setData) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error('offers subscribe error', err);
    setData([]);
  });
}

export async function addOffer(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    title: data.title,
    discount: data.discount || '',
    validFrom: data.validFrom || '',
    validTo: data.validTo || '',
    description: data.description || '',
    status: data.status || 'Active',
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateOffer(id, data) {
  await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteOffer(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
