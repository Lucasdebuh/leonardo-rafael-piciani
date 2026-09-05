import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7q0-vkrYVJJeO2tjBxA_trInc9b-j2-E",
  authDomain: "leonardo-rafael-piciani.firebaseapp.com",
  projectId: "leonardo-rafael-piciani",
  storageBucket: "leonardo-rafael-piciani.firebasestorage.app",
  messagingSenderId: "121501059168",
  appId: "1:121501059168:web:4455842ecfd0872d57db05",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
