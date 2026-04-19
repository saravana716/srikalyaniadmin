# Mobile & Backend Integration Guide

This document describes how to integrate the **Sri Kalyani Jewellery Chit Fund** web app with mobile apps and external systems. Data is stored in **Firebase Firestore**. The web dashboard reads and writes the same collections, so any data added from mobile (or API) appears in the dashboard in real time.

---

## 1. Firebase Configuration

Use this config in your mobile app (Android/iOS/Flutter/React Native) to connect to the same project:

```json
{
  "apiKey": "AIzaSyCIQTnZkvfiQEW1SsMygTqnGaN3Yj4lrFM",
  "authDomain": "srikalyanijewellery-chitfund.firebaseapp.com",
  "projectId": "srikalyanijewellery-chitfund",
  "storageBucket": "srikalyanijewellery-chitfund.firebasestorage.app",
  "messagingSenderId": "966692060880",
  "appId": "1:966692060880:web:284f7db94cb86ca475a8d5"
}
```

- **Web**: Config is in `src/firebase/config.js`. For production, prefer env vars: set `VITE_FIREBASE_API_KEY` (and others if needed) in `.env`.
- **Mobile**: Add the same config in your Firebase initialization (e.g. `GoogleService-Info.plist` / `google-services.json` from Firebase Console, or copy the object above).

**If you get "The database (default) does not exist":** In Firebase Console go to **Build → Firestore Database**. If you see **Create database** or **Add database**, click it, choose a location (e.g. nam5 / us-central), and create the database. The app uses the **(default)** Firestore database; it must exist before any read/write.

---

## 2. Firestore Collections & Schemas

All collections use **auto-generated document IDs** unless noted. Timestamps are Firestore `Timestamp` (server-side) when using the SDK.

---

### 2.1 `customers`

| Field        | Type   | Required | Description                          |
|-------------|--------|----------|--------------------------------------|
| cusId       | string | Yes      | Unique customer ID (e.g. "CUS-1707123456789-4521"). Web app generates this; mobile can generate similarly (timestamp + random) or use Firestore doc id. |
| joinedDate  | string | Yes      | ISO-style date/time e.g. "2025-03-12 05:20:30" |
| name        | string | Yes      | Full name                            |
| password    | string | Yes      | Password (store hashed in production)|
| amount      | number | Yes      | Amount (₹)                           |
| plan        | string | Yes      | "Daily" \| "Monthly" \| "Weekly"     |
| mobile      | string | Yes      | Mobile number                        |
| address     | string | No       | Optional address (used on Installments page) |
| createdAt   | timestamp | Auto  | Set on create (serverTimestamp)      |

**Example (mobile/add customer):**

```javascript
// JavaScript/React Native example
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

async function addCustomer(data) {
  const joinedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await addDoc(collection(db, 'customers'), {
    cusId: data.cusId,        // e.g. generate from count or backend
    joinedDate,
    name: data.name,
    password: data.password,
    amount: Number(data.amount),
    plan: data.plan || 'Daily',
    mobile: data.mobile,
    createdAt: serverTimestamp(),
  });
}
```

---

### 2.2 `plans`

| Field          | Type   | Required | Description                |
|----------------|--------|----------|----------------------------|
| planName       | string | Yes      | e.g. "Silver", "Gold"      |
| monthlyAmount  | string | Yes      | e.g. "₹2000"               |
| durationMonths | string | Yes      | e.g. "12 Month"            |
| totalValue     | string | Yes      | e.g. "₹ 10,000"            |
| bonus          | string | Yes      | e.g. "₹ 5,000"             |
| status         | string | Yes      | "Active" \| "Inactive"      |
| createdAt      | timestamp | Auto  | Set on create              |
| updatedAt      | timestamp | Auto  | Set on update              |

**Example (add plan from mobile):**

```javascript
await addDoc(collection(db, 'plans'), {
  planName: 'Silver',
  monthlyAmount: '₹2000',
  durationMonths: '12 Month',
  totalValue: '₹ 10,000',
  bonus: '₹ 5,000',
  status: 'Active',
  createdAt: serverTimestamp(),
});
```

---

### 2.3 `payments`

| Field        | Type   | Required | Description                    |
|-------------|--------|----------|--------------------------------|
| customerName| string | Yes      | Customer name                  |
| chitPlan    | string | Yes      | Plan name                      |
| dueAmount   | string | Yes      | e.g. "₹ 10,000"               |
| paidAmount  | string | Yes      | e.g. "₹ 10,000"               |
| dueDate     | string | Yes      | e.g. "2025-03-12"             |
| status      | string | Yes      | "Pending" \| "Completed" etc.  |
| createdAt   | timestamp | Auto  | Set on create                |

**Example (mobile records a payment):**

```javascript
await addDoc(collection(db, 'payments'), {
  customerName: 'Mari',
  chitPlan: 'Basic',
  dueAmount: '₹ 10,000',
  paidAmount: '₹ 10,000',
  dueDate: '2025-03-12',
  status: 'Completed',
  createdAt: serverTimestamp(),
});
```

---

### 2.4 `goldRates`

| Field      | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| date      | string | Yes      | Date e.g. "2025-12-25"   |
| goldRate  | string | Yes      | e.g. "10000"             |
| silverRate| string | Yes      | e.g. "10000"             |
| createdAt | timestamp | Auto  | Set on create          |

**Example (mobile submits today’s rates):**

```javascript
await addDoc(collection(db, 'goldRates'), {
  date: new Date().toISOString().slice(0, 10),
  goldRate: '10000',
  silverRate: '8000',
  createdAt: serverTimestamp(),
});
```

---

### 2.5 `installments`

| Field         | Type   | Required | Description                          |
|---------------|--------|----------|--------------------------------------|
| installmentNo | string | Yes      | e.g. "123456"                        |
| dueDate       | string | Yes      | e.g. "05-Jan-2025"                   |
| paidDate      | string | Yes      | e.g. "05-Jan-2025"                   |
| amount        | string | Yes      | e.g. "₹ 100"                         |
| mode          | string | Yes      | "Cash" \| "UPI" \| "Card" \| "Bank"  |
| status        | string | Yes      | "Pending" \| "Paid" \| "Completed" \| "Due Soon" |
| customerId    | string | No       | Optional link to customer            |
| planId        | string | No       | Optional link to plan                |
| createdAt     | timestamp | Auto  | Set on create                      |
| updatedAt     | timestamp | Auto  | Set on update                      |

**Example (add installment from mobile):**

```javascript
await addDoc(collection(db, 'installments'), {
  installmentNo: '123456',
  dueDate: '05-Jan-2025',
  paidDate: '05-Jan-2025',
  amount: '₹ 100',
  mode: 'UPI',
  status: 'Paid',
  customerId: '',
  planId: '',
  createdAt: serverTimestamp(),
});
```

---

### 2.6 `planPurchases`

Plan purchases (enrollments): which customer bought which plan.

| Field        | Type   | Required | Description                    |
|-------------|--------|----------|--------------------------------|
| customerId  | string | Yes      | Customer ID (e.g. "1234")      |
| customerName| string | Yes      | Customer name                  |
| planId      | string | No       | Plan document ID or code      |
| planName    | string | Yes      | e.g. "Silver", "Gold"          |
| startDate   | string | Yes      | e.g. "2025-01-01"              |
| status      | string | Yes      | "Active" \| "Inactive" \| "Completed" |
| createdAt   | timestamp | Auto  | Set on create                |
| updatedAt   | timestamp | Auto  | Set on update                |

**Example (add plan purchase from mobile):**

```javascript
await addDoc(collection(db, 'planPurchases'), {
  customerId: '1234',
  customerName: 'Sunil',
  planId: 'plan-doc-id',
  planName: 'Silver',
  startDate: '2025-01-01',
  status: 'Active',
  createdAt: serverTimestamp(),
});
```

---

## 3. How Data Flows

1. **Mobile app** (or any client) writes to Firestore using the same collection names and field schemas above.
2. **Web dashboard** subscribes to these collections with `onSnapshot`. Any new or updated document (from mobile or web) appears in the UI in real time.
3. **No separate backend** is required for CRUD; Firebase handles persistence and real-time sync.

---

## 4. Firestore Indexes (First Run)

The web app uses `orderBy('createdAt', 'desc')` on:

- `customers`
- `plans`
- `payments`
- `goldRates`
- `installments`
- `planPurchases`

On first run, if an index is missing, Firestore will log an error with a **link to create the index** in the Firebase Console. Open that link and create the index once per collection (and composite indexes if you add more `where` + `orderBy` later).

Alternatively, in Firebase Console → Firestore → Indexes, add:

- Collection: `customers`      → Field: `createdAt` → Descending
- Collection: `plans`          → Field: `createdAt` → Descending
- Collection: `payments`       → Field: `createdAt` → Descending
- Collection: `goldRates`      → Field: `createdAt` → Descending
- Collection: `installments`   → Field: `createdAt` → Descending
- Collection: `planPurchases`  → Field: `createdAt` → Descending

---

## 5. Security Rules & PERMISSION_DENIED Fix

**If you get `403 PERMISSION_DENIED` / "Missing or insufficient permissions":**  
Your rules use `request.auth != null`, so only **signed-in** users can access Firestore. The web app does not sign in with Firebase Auth yet, so `request.auth` is null and every request is denied.

**Option A – Development (no login):** Use these rules so the app works without authentication. In Firebase Console → Firestore Database → **Rules**, paste and **Publish**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /customers/{docId} {
      allow read, write: if true;
    }
    match /plans/{docId} {
      allow read, write: if true;
    }
    match /payments/{docId} {
      allow read, write: if true;
    }
    match /goldRates/{docId} {
      allow read, write: if true;
    }
    match /installments/{docId} {
      allow read, write: if true;
    }
    match /planPurchases/{docId} {
      allow read, write: if true;
    }
  }
}
```

**Option B – Production (with login):** After you connect your Login page to Firebase Auth (e.g. `signInWithEmailAndPassword`), switch back to authenticated-only rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /customers/{docId} {
      allow read, write: if request.auth != null;
    }
    match /plans/{docId} {
      allow read, write: if request.auth != null;
    }
    match /payments/{docId} {
      allow read, write: if request.auth != null;
    }
    match /goldRates/{docId} {
      allow read, write: if request.auth != null;
    }
    match /installments/{docId} {
      allow read, write: if request.auth != null;
    }
    match /planPurchases/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Use **Option A** until login is wired to Firebase Auth; then use **Option B** and publish.

---

## 6. Web App Service Reference (Full CRUD)

| Page / Feature   | Service file                   | Collection     | Create | View | Edit | Delete |
|------------------|--------------------------------|----------------|--------|------|------|--------|
| Customers        | `services/customersService.js` | `customers`    | ✓ Add  | ✓ List / View | ✓ (TODO) | ✓ |
| Chit Fund Plans  | `services/plansService.js`     | `plans`        | ✓ Add  | ✓ List / View more | ✓ Edit | ✓ |
| Plan Purchases   | `services/planPurchasesService.js` | `planPurchases` | ✓ Add | ✓ View | ✓ Edit | ✓ |
| Payment          | `services/paymentsService.js` | `payments`     | ✓ Add  | ✓ View more | ✓ Edit | ✓ |
| Installments     | `services/installmentsService.js` | `installments` | ✓ Add | ✓ View more | ✓ Edit | ✓ |
| Gold Rate Manage | `services/goldRatesService.js` | `goldRates`    | ✓ Add  | ✓ List / Display card | — | — |

- **Create**: Add modal or form; writes to Firestore via `addDoc` (or service `add*`).
- **View**: List from real-time `onSnapshot`; “View more” / View modal shows one document.
- **Edit**: Edit modal; updates via `updateDoc` (or service `update*`).
- **Delete**: Action menu “Delete”; removes via `deleteDoc` (or service `delete*`).

Mobile apps should use the **same collection names and field names** so that data written from mobile is displayed correctly on the web dashboard.

---

## 7. Optional: REST API (Firebase REST)

If the mobile app cannot use the Firebase SDK, you can use the **Firestore REST API** with an API key or a bearer token (e.g. from Firebase Auth). Base URL:

`https://firestore.googleapis.com/v1/projects/srikalyanijewellery-chitfund/databases/(default)/documents/`

- Create document: `POST .../documents/customers`
- List: `GET .../documents/customers`

Request/response formats are documented in [Firestore REST API](https://firebase.google.com/docs/firestore/reference/rest).

---

## 8. Summary

- Use the **same Firebase config** in web and mobile.
- Write to **customers**, **plans**, **planPurchases**, **payments**, **installments**, **goldRates** with the **field schemas** above.
- Web dashboard: all pages support **Create, View, Edit, Delete** (except Gold Rate: Create + View only).
- Web stays in sync via **onSnapshot**; mobile data appears in real time.
- Create **indexes** when prompted (or from Firestore Console) for each collection.
- Add **security rules** and (recommended) **Firebase Auth** before production.

For questions or changes to schemas, update this doc and the web `services/*.js` and Firestore rules together.
