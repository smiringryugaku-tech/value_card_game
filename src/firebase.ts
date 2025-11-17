// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCphi0a3aXcpHF_xtMQbzMWX3UBV-2CtaM",
  authDomain: "value-card-game.firebaseapp.com",
  projectId: "value-card-game",
  storageBucket: "value-card-game.firebasestorage.app",
  messagingSenderId: "784598650776",
  appId: "1:784598650776:web:e1562f84fb8924033ae5ed",
  measurementId: "G-919FPQJXSH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const functions = getFunctions(app);