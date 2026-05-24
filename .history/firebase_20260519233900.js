import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";

import { getAuth }
from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCBhQ748gc2XvPYem8OB3vttbnpjfd2Eco",
  authDomain: "dating-project-49ad9.firebaseapp.com",
  projectId: "dating-project-49ad9",
  storageBucket: "dating-project-49ad9.appspot.com",
  messagingSenderId: "867274463010",
  appId: "1:867274463010:web:f8a60c5a7d1595fb46f77b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);