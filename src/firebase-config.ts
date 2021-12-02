import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCCOIXBE_hECvx_E9qGy6CwJADtJuSUui8",
    authDomain: "tetris-fc499.firebaseapp.com",
    databaseURL: "https://tetris-fc499-default-rtdb.firebaseio.com",
    projectId: "tetris-fc499",
    storageBucket: "tetris-fc499.appspot.com",
    messagingSenderId: "74944565482",
    appId: "1:74944565482:web:ad09a4c5f4a9648bb58793"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore();