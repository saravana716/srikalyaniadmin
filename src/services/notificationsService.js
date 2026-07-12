import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'app_notifications';

export function subscribeNotifications(setData, max = 50) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, (snapshot) => {
    setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error('notifications subscribe error', err);
    setData([]);
  });
}
