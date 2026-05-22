import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import {
  collection,
  doc,
  getDocs,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
/* =========================
   VALIDATION
========================= */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* =========================
   REGISTER
========================= */
window.registerUser = async function () {
  try {
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const pw = document.getElementById("regPassword").value;

    if (!name) return alert("Name required");
    if (!isValidEmail(email)) return alert("Invalid email");
    if (pw.length < 8) return alert("Password too short");

    const userCred = await createUserWithEmailAndPassword(auth, email, pw);

    await sendEmailVerification(userCred.user);

    localStorage.setItem("amorwa_user", JSON.stringify({ name, email }));

    alert("Check your email for verification");

    setTimeout(() => {
  window.location.href = "login.html";
}, 1500);
  } catch (err) {
    alert(err.message);
    console.error(err);
  }
};

/* =========================
   LOGIN
========================= */
window.loginUser = async function () {
  try {

    const email =
      document.getElementById("loginEmail").value.trim();

    const pw =
      document.getElementById("loginPassword").value;

    if (!isValidEmail(email)) {
      alert("Invalid email");
      return;
    }

    if (pw.length < 8) {
      alert("Password too short");
      return;
    }

    const userCred =
      await signInWithEmailAndPassword(
        auth,
        email,
        pw
      );

    /* VERY IMPORTANT */
    await userCred.user.reload();

    if (!userCred.user.emailVerified) {

      alert(
        "Your email is not verified yet.\n\n" +
        "👉 Check Inbox\n" +
        "👉 Check Spam folder"
      );

      return;
    }

   /* CHECK ADMIN COLLECTION */

  let isAdmin = false;
  try {
    const adminSnapshot = await getDocs(collection(db, "admins"));

    adminSnapshot.forEach((doc) => {
      const adminData = doc.data();

      if (adminData.email === email) {
        isAdmin = true;
      }
    });
  } catch (err) {
    console.warn("Failed to read admins collection:", err);
    // If Firestore denies permission, treat user as non-admin instead of blocking login
    if (err.code === "permission-denied" || /permission|insufficient/i.test(err.message)) {
      isAdmin = false;
    } else {
      // rethrow unexpected errors so they're handled by outer catch
      throw err;
    }
  }

/* REDIRECT */

if (isAdmin) {

  alert("Admin login successful!");

  window.location.href = "admin.html";

} else {

  alert("Login successful!");

  window.location.href = "swipe.html";
}

  } catch (err) {

    console.error(err);
    alert(err.message);
  }
};

window.resendVerificationEmail = async function () {

  try {

    const user = auth.currentUser;

    if (!user) {

      alert(
        "Please login first before resending verification email."
      );

      return;
    }

    await user.reload();

    if (user.emailVerified) {

      alert("Email already verified.");
      return;
    }

    await sendEmailVerification(user);

    alert(
      "Verification email sent.\n\nCheck inbox or spam."
    );

  } catch (err) {

    console.error(err);

    if (err.code === "auth/too-many-requests") {

      alert(
        "Too many requests.\n\nWait 15-30 minutes before trying again."
      );

    } else {

      alert(err.message);
    }
  }
};

/* =========================
   RESEND VERIFICATION
========================= */

window.resendVerificationEmail = async function () {
  try {

    const user = auth.currentUser;

    if (!user) {
      alert("Login first.");
      return;
    }

    await sendEmailVerification(user);

    alert("Verification email sent again.");

  } catch (err) {

    console.error(err);
    alert(err.message);
  }
};

window.resetPassword = async function () {
  try {
    const email = document.getElementById("loginEmail")?.value.trim();

    if (!email) {
      alert("Please enter your email address first.");
      return;
    }

    if (!isValidEmail(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent. Check your inbox or spam folder.");
  } catch (err) {
    console.error(err);
    if (err.code === "auth/user-not-found") {
      alert("No account found with that email.");
    } else {
      alert(err.message);
    }
  }
};

/* =========================
   GOOGLE LOGIN
========================= */

window.googleLogin = async function () {

  try {

    const provider = new GoogleAuthProvider();

    const result = await signInWithPopup(auth, provider);

    const user = result.user;

    await setDoc(
      doc(db, "users", user.uid),
      {
        name: user.displayName || "User",
        email: user.email,
        photo: user.photoURL || "",
        status: "active",
        role: "user",
        createdAt: new Date()
      },
      { merge: true }
    );

    window.location.href = "swipe.html";

  } catch (err) {

    console.error(err);
    alert(err.message);
  }
};