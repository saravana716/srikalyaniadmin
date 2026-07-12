import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// If you see "The database (default) does not exist": In Firebase Console go to
// Build → Firestore Database → click "Create database" / "Add database", pick a location, then Enable.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCIQTnZkvfiQEW1SsMygTqnGaN3Yj4lrFM',
  authDomain: 'srikalyanijewellery-chitfund.firebaseapp.com',
  projectId: 'srikalyanijewellery-chitfund',
  storageBucket: 'srikalyanijewellery-chitfund.firebasestorage.app',
  messagingSenderId: '966692060880',
  appId: '1:966692060880:web:284f7db94cb86ca475a8d5',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
