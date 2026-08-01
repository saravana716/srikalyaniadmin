import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const MIGRATION_KEY = 'vk_products_stock100_migrated_v1';
let running = false;

/** One-time: set every product document stock to 100 (localStorage prevents repeat). */
export async function runDefaultProductStockMigration() {
    if (typeof localStorage === 'undefined' || localStorage.getItem(MIGRATION_KEY)) return;
    if (running) return;
    running = true;
    try {
        const snap = await getDocs(collection(db, 'products'));
        if (snap.empty) {
            localStorage.setItem(MIGRATION_KEY, '1');
            return;
        }
        for (let i = 0; i < snap.docs.length; i += 500) {
            const batch = writeBatch(db);
            const end = Math.min(i + 500, snap.docs.length);
            for (let j = i; j < end; j++) {
                batch.update(snap.docs[j].ref, { stock: 100 });
            }
            await batch.commit();
        }
        localStorage.setItem(MIGRATION_KEY, '1');
    } catch (e) {
        console.error('Default product stock migration:', e);
    } finally {
        running = false;
    }
}
