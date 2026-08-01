import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Default configuration provided by the user
const defaultFirebaseConfig = {
    apiKey: "AIzaSyDc3zvHoU9jvR1KkB1xpLLZExm4Xq3tdNs",
    authDomain: "visionkart---e-commerce.firebaseapp.com",
    projectId: "visionkart---e-commerce",
    storageBucket: "visionkart---e-commerce.firebasestorage.app",
    messagingSenderId: "284466667171",
    appId: "1:284466667171:web:1fd940de4c2cf7e5632916"
};

// Function to get config (can be made dynamic via localStorage or API)
const getDynamicConfig = () => {
    const savedConfig = localStorage.getItem('firebase_config');
    if (savedConfig) {
        try {
            return JSON.parse(savedConfig);
        } catch (e) {
            console.error("Error parsing saved firebase config", e);
        }
    }
    return defaultFirebaseConfig;
};

const app = initializeApp(getDynamicConfig());
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage, defaultFirebaseConfig };
