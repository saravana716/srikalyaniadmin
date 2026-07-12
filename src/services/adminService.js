import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'admin';

export function subscribeAdmins(setData) {
  return onSnapshot(collection(db, COLLECTION), (snapshot) => {
    setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error('admin subscribe error', err);
    setData([]);
  });
}

export async function emailExists(email, excludeId) {
  const normalized = (email || '').trim().toLowerCase();
  const q = query(collection(db, COLLECTION), where('Email', '==', normalized));
  const snap = await getDocs(q);
  if (snap.empty) return false;
  if (excludeId) return snap.docs.some((d) => d.id !== excludeId);
  return true;
}

export async function addAdmin({ email, password, name }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const trimmedPassword = (password || '').trim();
  if (!normalizedEmail || !trimmedPassword) {
    throw new Error('Email and password are required');
  }
  if (await emailExists(normalizedEmail)) {
    throw new Error('An admin with this email already exists');
  }
  const ref = await addDoc(collection(db, COLLECTION), {
    Email: normalizedEmail,
    Password: trimmedPassword,
    Name: (name || '').trim() || normalizedEmail,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateAdmin(id, { email, password, name }) {
  const updates = {};
  if (email != null) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await emailExists(normalizedEmail, id)) {
      throw new Error('An admin with this email already exists');
    }
    updates.Email = normalizedEmail;
  }
  if (password != null && password.trim()) {
    updates.Password = password.trim();
  }
  if (name != null) {
    updates.Name = name.trim() || updates.Email;
  }
  updates.updatedAt = serverTimestamp();
  await updateDoc(doc(db, COLLECTION, id), updates);
}

export async function deleteAdmin(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
