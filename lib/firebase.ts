import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// 🔥 CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCUm9Bawr6Gnr-QAbwDhmdJ2TVVrMNA3Uc",
  authDomain: "private-rides-52e08.firebaseapp.com",
  databaseURL: "https://private-rides-52e08-default-rtdb.firebaseio.com",
  projectId: "private-rides-52e08",
  storageBucket: "private-rides-52e08.firebasestorage.app",
  messagingSenderId: "768368448310",
  appId: "1:768368448310:web:9e5fc8c3e92aac5e719997"
};

// 🔥 INIT
const app = initializeApp(firebaseConfig);

// 🔥 LO IMPORTANTE (TRACKING)
export const db = getDatabase(app);
export const auth = getAuth(app);