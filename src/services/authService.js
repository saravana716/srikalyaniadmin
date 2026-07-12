import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'admin';
const SESSION_KEY = 'jewellery_admin_user';

/**
 * Login with email + password against admin collection.
 * Firestore fields: Email, Password (capitalized as in your DB).
 */
export async function loginWithEmailPassword(email, password) {
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedPassword = (password || '').trim();
  if (!trimmedEmail || !trimmedPassword) {
    throw new Error('Email and password are required');
  }

  const q = query(
    collection(db, COLLECTION),
    where('Email', '==', trimmedEmail)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error('Invalid email or password');
  }

  const docSnap = snapshot.docs[0];
  const data = docSnap.data();
  if (data.Password !== trimmedPassword) {
    throw new Error('Invalid email or password');
  }

  const user = {
    id: docSnap.id,
    email: data.Email,
    name: data.Name || data.Email,
    role: 'admin',
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn() {
  return !!getStoredUser();
}
