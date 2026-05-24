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

const authToaster = (message, duration = 4000) => {
  if (typeof window.showToast === "function") {
    window.showToast(message, duration);
  } else if (typeof window.alert === "function") {
    window.alert(message);
  }
};

const authErrorMessage = (err) => {
  if (!err || !err.code) return err?.message || "An unexpected error occurred.";

  switch (err.code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
      return "No account found with that email.";
    case "auth/wrong-password":
      return "Wrong email or password. Please try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network issue detected. Check your connection and try again.";
    default:
      return err.message || "An unexpected error occurred.";
  }
};

const safeRedirect = (url) => {
  window.location.href = url;
};

const saveUserProfileDocument = async (uid, profileData) => {
  if (!uid) return;
  await setDoc(doc(db, "users", uid), profileData, { merge: true });
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

window.registerUser = async function () {
  try {
    const name = document.getElementById("regName")?.value.trim();
    const email = document.getElementById("regEmail")?.value.trim();
    const pw = document.getElementById("regPassword")?.value || "";

    if (!name) {
      authToaster("Name is required.");
      return;
    }

    if (!isValidEmail(email)) {
      authToaster("Please enter a valid email.");
      return;
    }

    if (pw.length < 8) {
      authToaster("Password must be at least 8 characters.");
      return;
    }

    const userCred = await createUserWithEmailAndPassword(auth, email, pw);

    await saveUserProfileDocument(userCred.user.uid, {
      name,
      email,
      photo: "",
      status: "active",
      deleted: false,
      role: "user",
      createdAt: new Date()
    });

    await sendEmailVerification(userCred.user);

    authToaster("Account created! Please verify your email before logging in.");
    setTimeout(() => safeRedirect("login.html"), 1400);
  } catch (err) {
    console.error(err);
    authToaster(authErrorMessage(err));
  }
};

window.loginUser = async function () {
  try {
    const email = document.getElementById("loginEmail")?.value.trim();
    const pw = document.getElementById("loginPassword")?.value || "";

    if (!isValidEmail(email)) {
      authToaster("Please enter a valid email.");
      return;
    }

    if (pw.length < 8) {
      authToaster("Password must be at least 8 characters.");
      return;
    }

    const userCred = await signInWithEmailAndPassword(auth, email, pw);
    await userCred.user.reload();

    if (!userCred.user.emailVerified) {
      authToaster("Please verify your email before signing in. Check your inbox or spam folder.");
      return;
    }

    let isAdmin = false;
    
    // Check if user is admin
    try {
      console.log("🔍 Checking admin status for:", email);
      const adminSnapshot = await getDocs(collection(db, "admins"));
      
      adminSnapshot.forEach((docItem) => {
        const adminData = docItem.data();
        console.log("📋 Admin doc email:", adminData.email);
        if (adminData.email && adminData.email.toLowerCase() === email.toLowerCase()) {
          isAdmin = true;
          console.log("✅ Admin match found!");
        }
      });
      
      if (adminSnapshot.empty) {
        console.warn("⚠️ Admins collection is empty");
      }
    } catch (err) {
      console.error("❌ Admin check error:", err.code, err.message);
      // If we get permission error, check the user's profile role field as fallback
      try {
        const userDoc = await getDocs(collection(db, "users"));
        let foundUser = null;
        userDoc.forEach((doc) => {
          if (doc.data().email === email) {
            foundUser = doc.data();
          }
        });
        if (foundUser && foundUser.role === "admin") {
          isAdmin = true;
          console.log("✅ Admin found via user role field");
        }
      } catch (fallbackErr) {
        console.warn("Fallback admin check also failed:", fallbackErr.message);
      }
    }

    console.log("🎯 Final admin status:", isAdmin);
    
    if (isAdmin) {
      authToaster("Admin login successful.");
      setTimeout(() => safeRedirect("admin.html"), 800);
    } else {
      authToaster("Welcome back!");
      setTimeout(() => safeRedirect("swipe.html"), 800);
    }
  } catch (err) {
    console.error("❌ Login error:", err);
    authToaster(authErrorMessage(err));
  }
};

window.resendVerificationEmail = async function () {
  try {
    const user = auth.currentUser;
    if (!user) {
      authToaster("Please sign in first to resend verification email.");
      return;
    }

    await user.reload();
    if (user.emailVerified) {
      authToaster("Your email is already verified.");
      return;
    }

    await sendEmailVerification(user);
    authToaster("Verification email sent. Check your inbox or spam folder.");
  } catch (err) {
    console.error(err);
    if (err.code === "auth/too-many-requests") {
      authToaster("Too many requests. Wait a few minutes and try again.");
    } else {
      authToaster(authErrorMessage(err));
    }
  }
};

window.resetPassword = async function () {
  try {
    const email = document.getElementById("loginEmail")?.value.trim() || "";
    if (!email) {
      authToaster("Please enter your email address first.");
      return;
    }

    if (!isValidEmail(email)) {
      authToaster("Please enter a valid email address.");
      return;
    }

    await sendPasswordResetEmail(auth, email);
    authToaster("Password reset email sent. Check your inbox or spam folder.");
  } catch (err) {
    console.error(err);
    if (err.code === "auth/user-not-found") {
      authToaster("No account found with that email.");
    } else {
      authToaster(authErrorMessage(err));
    }
  }
};

window.googleLogin = async function () {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (!user || !user.uid) {
      throw new Error("Google sign-in failed.");
    }

    await saveUserProfileDocument(user.uid, {
      name: user.displayName || "User",
      email: user.email || "",
      photo: user.photoURL || "",
      status: "active",
      deleted: false,
      role: "user",
      createdAt: new Date()
    });

    authToaster("Signed in with Google.");
    safeRedirect("swipe.html");
  } catch (err) {
    console.error(err);
    authToaster(authErrorMessage(err));
  }
};