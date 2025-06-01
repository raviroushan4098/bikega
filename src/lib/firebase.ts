
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
// Import getAnalytics and isSupported for conditional initialization
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyB34-w680xXMyGTduUsi1bri2pB9_ulcUg",
  authDomain: "insight-stream-606ef.firebaseapp.com",
  projectId: "insight-stream-606ef",
  storageBucket: "insight-stream-606ef.firebasestorage.app",
  messagingSenderId: "452534653844",
  appId: "1:452534653844:web:ffc99f34ddc4dad35d3581",
  measurementId: "G-GC8F1ZF0V0"
};

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db: Firestore = getFirestore(app);

// Conditionally initialize analytics only on the client side and if supported
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      getAnalytics(app); // Initialize analytics for its side effects
    } else {
      // console.log("Firebase Analytics is not supported in this environment (checked via isSupported()).");
    }
  }).catch(err => {
    // Catch errors during the support check or initialization
    // console.error("Error during Firebase Analytics support check or initialization:", err);
  });
}

export { app, db };
// Note: analytics is initialized (conditionally for client-side) but not exported or used directly by other modules.
