import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  signOut,
  deleteUser,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import {
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";



/* ============================================================
   AmorWa Dating App – script.js
   Vanilla JS | No frameworks | Works in Replit
   ============================================================ */

'use strict';

/* ============================================================
   1. TRANSLATIONS (i18n system)
   ============================================================ */

   function initPwToggle() {
  document.querySelectorAll('.pw-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;

      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });
}
const TRANSLATIONS = {
  en: {
    badge:         "Rwanda's #1 Dating App",
    hero1:         "Find Love,",
    hero2:         "Find Connection",
    heroSub:       "Join thousands of Rwandans finding meaningful relationships every day.",
    getStarted:    "Get Started",
    login:         "Log In",
    heroFoot:      "Free to join • Trusted • Private",
    back:          "Back",
    createAccount: "Create Account",
    continueWithGoogle: "Continue with Google",
    joinUs:        "Join AmorWa and start your journey ✨",
    yourName:      "Your Name",
    email:         "Email",
    password:      "Password",
    haveAccount:   "Already have an account?",
    signIn:        "Sign In",
    welcomeBack:   "Welcome Back 💖",
    loginSub:      "Sign in to continue your journey",
    forgotPassword:"Forgot password?",
    noAccount:     "Don't have an account?",
    joinNow:       "Join Now",
    setupProfile:  "Set Up Your Profile",
    setupSub:      "Let others know who you are 🌟",
    uploadPhoto:   "Upload Photo",
    displayName:   "Display Name",
    age:           "Age",
    location:      "Location",
    bio:           "Short Bio",
    interests:     "Interests (pick up to 5)",
    saveProfile:   "Save Profile & Start",
    discover:      "Discover",
    matches:       "Matches",
    profile:       "Profile",
    noMore:        "No more profiles!",
    checkBack:     "Check back later for more matches.",
    refresh:       "Refresh",
    itsAMatch:     "💖 It's a Match!",
    matchSub:      "You and liked each other",
    startChat:     "Start Chat 💬",
    keepSwiping:   "Keep Swiping",
    yourMatches:   "Your Matches",
    online:        "🟢 Online",
    typeMessage:   "Type a message...",
    liked:         "💖 Liked!",
    passed:        "👋 Passed",
    matchFound:    "🎉 It's a Match!",
    profileSaved:  "✅ Profile saved!",
    registered:    "🎉 Account created! Setting up your profile...",
    loggedIn:      "👋 Welcome back!",
    nameRequired:  "Name is required.",
    emailInvalid:  "Please enter a valid email.",
    pwShort:       "Password must be at least 8 characters.",
    logout:        "Logout",
    deleteAccount: "Delete Account",
    reportUser:    "🚨 Report",
    blockUser:     "⛔ Block",
    unmatchUser:   "💔 Unmatch",
  },
  rw: {
    badge:         "App Nziza #1 yo mu Rwanda",
    hero1:         "Shaka Urukundo,",
    hero2:         "Shaka Ituze",
    heroSub:       "Injira hamwe n'ibihumbi by'Abanyarwanda bashaka imishyikirano myiza buri munsi.",
    getStarted:    "Tangira",
    login:         "Injira",
    heroFoot:      "Kwiyandikisha birabure • Ikizerwa • Ibanga",
    back:          "Subira",
    createAccount: "Fungura Konti",
    continueWithGoogle: "Komeza ukoresheje Google",
    joinUs:        "Injira AmorWa utangire urugendo rwawe ✨",
    yourName:      "Izina Ryawe",
    email:         "Imeli",
    password:      "Ijambo Banga",
    haveAccount:   "Usanganywe konti?",
    signIn:        "Injira",
    welcomeBack:   "Murakaza Neza 💖",
    loginSub:      "Injira ukomeze urugendo rwawe",
    forgotPassword:"Wibagiwe ijambo banga?",
    noAccount:     "Nta konti ufite?",
    joinNow:       "Injira None",
    setupProfile:  "Tegura Umwirondoro Wawe",
    setupSub:      "Emeza ko abandi bazi uwo uri we 🌟",
    uploadPhoto:   "Ohereza Ifoto",
    displayName:   "Izina Rigaragara",
    age:           "Imyaka",
    location:      "Aho ubarizwa",
    bio:           "Isobanuro Ngufi",
    interests:     "Ibyo ukunda (hitamo 5 byanze birundu)",
    saveProfile:   "Bika Umwirondoro & Tangira",
    discover:      "Shaka",
    matches:       "Ihuruza",
    profile:       "Umwirondoro",
    noMore:        "Nta bandi bantu!",
    checkBack:     "Garuka nyuma ushake ihuruza.",
    refresh:       "Vonaho",
    itsAMatch:     "💖 Mwahuje!!",
    matchSub:      "Wowe na mukundana",
    startChat:     "Tangira Ikiganiro 💬",
    keepSwiping:   "Komeza Gushaka",
    yourMatches:   "Ihuruza Ryawe",
    online:        "🟢 Kuri interineti",
    typeMessage:   "Andika ubutumwa...",
    liked:         "💖 Wamukunze!",
    passed:        "👋 Waranze",
    matchFound:    "🎉 Mwahuje!",
    profileSaved:  "✅ Umwirondoro wabitswe!",
    registered:    "🎉 Konti yashinzwe! Gutegura umwirondoro...",
    loggedIn:      "👋 Murakaza neza!",
    nameRequired:  "Izina rirakenewe.",
    emailInvalid:  "Injiza imeli yuzuye.",
    pwShort:       "Ijambo banga rigomba kuba nibura inyuguti 8.",
    logout:        "Gusohoka muri konte",
    deleteAccount: "Gusiba konte",
    reportUser:    "🚨 Kurega",
    blockUser:     "⛔ Guhagarika",
    unmatchUser:   "💔 Gukuraho guhuza",
  },
  fr: {
    badge:         "L'App de Rencontres #1 au Rwanda",
    hero1:         "Trouvez l'Amour,",
    hero2:         "Trouvez la Connexion",
    heroSub:       "Rejoignez des milliers de Rwandais trouvant des relations significatives chaque jour.",
    getStarted:    "Commencer",
    login:         "Se connecter",
    heroFoot:      "Inscription gratuite • Fiable • Privé",
    back:          "Retour",
    createAccount: "Créer un compte",
    continueWithGoogle: "Continuer avec Google",
    joinUs:        "Rejoignez AmorWa et commencez votre voyage ✨",
    yourName:      "Votre Nom",
    email:         "Email",
    password:      "Mot de passe",
    haveAccount:   "Vous avez déjà un compte ?",
    signIn:        "Se connecter",
    welcomeBack:   "Bon retour 💖",
    loginSub:      "Connectez-vous pour continuer",
    forgotPassword:"Mot de passe oublié ?",
    noAccount:     "Pas encore de compte ?",
    joinNow:       "Rejoindre",
    setupProfile:  "Configurer votre profil",
    setupSub:      "Laissez les autres vous connaître 🌟",
    uploadPhoto:   "Télécharger une photo",
    displayName:   "Nom affiché",
    age:           "Âge",
    location:      "Lieu",
    bio:           "Courte biographie",
    interests:     "Intérêts (choisir jusqu'à 5)",
    saveProfile:   "Enregistrer & Commencer",
    discover:      "Découvrir",
    matches:       "Correspondances",
    profile:       "Profil",
    noMore:        "Plus de profils !",
    checkBack:     "Revenez plus tard pour plus de correspondances.",
    refresh:       "Rafraîchir",
    itsAMatch:     "💖 C'est un match !",
    matchSub:      "Vous et vous aimez mutuellement",
    startChat:     "Commencer à chatter 💬",
    keepSwiping:   "Continuer à swiper",
    yourMatches:   "Vos correspondances",
    online:        "🟢 En ligne",
    typeMessage:   "Tapez un message...",
    liked:         "💖 Aimé !",
    passed:        "👋 Passé",
    matchFound:    "🎉 C'est un match !",
    profileSaved:  "✅ Profil enregistré !",
    registered:    "🎉 Compte créé ! Configuration du profil...",
    loggedIn:      "👋 Bon retour !",
    nameRequired:  "Le nom est requis.",
    emailInvalid:  "Veuillez saisir un email valide.",
    pwShort:       "Le mot de passe doit comporter au moins 8 caractères.",
    logout:        "Se déconnecter",
    deleteAccount: "Supprimer le compte",
    reportUser:    "🚨 Signaler",
    blockUser:     "⛔ Bloquer",
    unmatchUser:   "💔 Annuler la correspondance",
  }
};

let currentLang = localStorage.getItem('amorwa_lang') || 'en';

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
      || TRANSLATIONS['en'][key]
      || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = translated;
    } else {
      el.textContent = translated;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
}

const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get("matchId");

if (!matchId) {
  console.error("No matchId found in URL");
}

window.sendMessage = async function (event) {
  if (event && event.preventDefault) event.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    window.showToast && window.showToast("Please log in first.") || alert("Please log in first.");
    return;
  }

  const input = document.getElementById("chatInput");
  if (!input) {
    window.showToast && window.showToast("Chat input is missing.") || alert("Chat input is missing.");
    return;
  }

  const text = input.value.trim();
  if (!text) {
    return;
  }

  if (!matchId) {
    window.showToast && window.showToast("Chat is not initialized correctly.") || alert("Chat is not initialized correctly.");
    return;
  }

  try {
    await addDoc(collection(db, "matches", matchId, "messages"), {
      text,
      sender: user.uid,
      createdAt: serverTimestamp()
    });
    input.value = "";
    input.focus();
  } catch (err) {
    console.error("sendMessage failed", err);
    (window.showToast && window.showToast("Unable to send message. Please try again.")) || alert("Unable to send message. Please try again.");
  }
};



let unsubscribeChat = null;

function initChatPage() {
  const chatMessages = document.getElementById("chatMessages");

  if (!chatMessages || !matchId) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("Please log in first");
      window.location.href = "login.html";
      return;
    }

    const chatNameEl = document.getElementById("chatName");
    const chatStatusEl = document.querySelector(".chat-status");
    const chatAvatar = document.getElementById("chatAvatar");

    try {
      const matchDoc = await getDoc(doc(db, "matches", matchId));
      if (matchDoc.exists()) {
        const matchData = matchDoc.data();
        const otherUserId = Array.isArray(matchData.users)
          ? matchData.users.find((uid) => uid !== user.uid) || matchData.users[0]
          : null;

        if (otherUserId) {
          const otherUserDoc = await getDoc(doc(db, "users", otherUserId));
          if (otherUserDoc.exists()) {
            const otherUser = otherUserDoc.data();
            if (chatNameEl) chatNameEl.textContent = otherUser.name || "Match";
            if (chatStatusEl) chatStatusEl.textContent = t("online");
            if (chatAvatar) {
              if (otherUser.avatar) {
                chatAvatar.style.backgroundImage = `url(${otherUser.avatar})`;
                chatAvatar.textContent = "";
                chatAvatar.style.backgroundSize = "cover";
                chatAvatar.style.backgroundPosition = "center";
              } else if (otherUser.name) {
                const initials = otherUser.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                chatAvatar.textContent = initials;
                chatAvatar.style.backgroundImage = "";
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    }

    const q = query(
      collection(db, "matches", matchId, "messages"),
      orderBy("createdAt", "asc")
    );

    if (unsubscribeChat) unsubscribeChat();

    unsubscribeChat = onSnapshot(q, (snapshot) => {
      chatMessages.innerHTML = "";

      snapshot.forEach((doc) => {
        const msg = doc.data();

        const div = document.createElement("div");
        div.className =
          msg.sender === user.uid ? "bubble me" : "bubble them";
        div.textContent = msg.text;

        const time = document.createElement("div");
        time.className = "bubble-time";
        time.textContent = msg.createdAt?.toDate
          ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : "";

        chatMessages.appendChild(div);
        if (time.textContent) chatMessages.appendChild(time);
      });

      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  });
}



/* ============================================================
   2. THEME (Dark / Light)
   ============================================================ */
let currentTheme = localStorage.getItem('amorwa_theme') || 'dark';

function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);

  const btn = document.getElementById('themeToggle');

  if (btn) {
    btn.textContent = currentTheme === 'dark'
      ? '🌙'
      : '☀️';
  }
}

function toggleTheme() {
  currentTheme =
    currentTheme === 'dark'
      ? 'light'
      : 'dark';

  localStorage.setItem('amorwa_theme', currentTheme);

  applyTheme();
}

/* =========================
   THEME BUTTON
========================= */

applyTheme();

const themeBtn = document.getElementById("themeToggle");

if (themeBtn) {
  themeBtn.addEventListener("click", toggleTheme);
}

/* ============================================================
   3. LANGUAGE DROPDOWN
   ============================================================ */
function buildLangDropdown() {
  const btn = document.getElementById('langToggle');
  if (!btn) return;

  // Dropdown element
  let dropdown = document.getElementById('langDropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'langDropdown';
    dropdown.className = 'lang-dropdown';
    dropdown.innerHTML = `
      <div class="lang-option" data-lang="en">🇬🇧 English</div>
      <div class="lang-option" data-lang="rw">🇷🇼 Kinyarwanda</div>
      <div class="lang-option" data-lang="fr">🇫🇷 Français</div>
    `;
    document.body.appendChild(dropdown);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    // Position near button
    const r = btn.getBoundingClientRect();
    dropdown.style.top = (r.bottom + 6) + 'px';
    dropdown.style.right = (window.innerWidth - r.right) + 'px';
    dropdown.style.left = 'auto';
  });

  dropdown.querySelectorAll('.lang-option').forEach(opt => {
    opt.addEventListener('click', () => {
      currentLang = opt.getAttribute('data-lang');
      localStorage.setItem('amorwa_lang', currentLang);
      dropdown.classList.remove('open');
      updateLangLabel();
      applyTranslations();
    });
  });

  document.addEventListener('click', () => dropdown.classList.remove('open'));
  updateLangLabel();
}

function updateLangLabel() {
  const labels = { en: 'EN', rw: 'RW', fr: 'FR' };
  const el = document.getElementById('langLabel');
  if (el) el.textContent = labels[currentLang] || 'EN';
  // Mark active
  document.querySelectorAll('.lang-option').forEach(o => {
    o.classList.toggle('active', o.getAttribute('data-lang') === currentLang);
  });
}

/* ============================================================
   4. TOAST
   ============================================================ */
function showToast(msg, duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
window.showToast = showToast;

/* ============================================================
   5. FORM VALIDATION HELPERS
   ============================================================ */
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}
function clearErrs(...ids) { ids.forEach(id => setErr(id, '')); }

/* ============================================================
   FORMS: Register & Login initializers
   These hook the HTML forms to the auth functions in `auth.js`
   ============================================================ */
function initRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    clearErrs('errName', 'errEmail', 'errPw');

    const name = document.getElementById('regName')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const pw = document.getElementById('regPassword')?.value || '';

    if (!name) { setErr('errName', t('nameRequired')); return; }
    if (!isValidEmail(email)) { setErr('errEmail', t('emailInvalid')); return; }
    if (pw.length < 8) { setErr('errPw', t('pwShort')); return; }

    if (typeof window.registerUser === 'function') {
      window.registerUser();
    } else {
      console.error('registerUser() not available');
    }
  });
}

function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    clearErrs('errLoginEmail', 'errLoginPw');

    const email = document.getElementById('loginEmail')?.value.trim();
    const pw = document.getElementById('loginPassword')?.value || '';

    if (!isValidEmail(email)) { setErr('errLoginEmail', t('emailInvalid')); return; }
    if (pw.length < 8) { setErr('errLoginPw', t('pwShort')); return; }

    if (typeof window.loginUser === 'function') {
      window.loginUser();
    } else {
      console.error('loginUser() not available');
    }
  });
}


const settingsBtn = document.getElementById("settingsBtn");
const settingsMenu = document.getElementById("settingsMenu");

if (settingsBtn && settingsMenu) {
  settingsBtn.addEventListener("click", () => {
    settingsMenu.style.display =
      settingsMenu.style.display === "flex"
        ? "none"
        : "flex";
  });
}

window.logoutUser = async function () {

  try {

    await signOut(auth);

    window.location.href = "login.html";

  } catch (err) {

    console.error(err);
    alert(err.message);
  }
};

window.deleteAccount = async function () {

  const confirmDelete = confirm(
    "Are you sure you want to permanently delete your account?"
  );

  if (!confirmDelete) return;

  try {

    const user = auth.currentUser;

    /* DELETE FIRESTORE USER */
    await deleteDoc(doc(db, "users", user.uid));

    /* DELETE AUTH ACCOUNT */
    await deleteUser(user);

    alert("Account deleted.");

    window.location.href = "index.html";

  } catch (err) {

    console.error(err);

    if (err.code === "auth/requires-recent-login") {

      alert(
        "Please login again before deleting your account."
      );

    } else {

      alert(err.message);
    }
  }
};

/*report js */

let selectedReportedUser = null;


/* OPEN MODAL */
window.openReportModal = function(userId){

  selectedReportedUser = userId;

  document.getElementById("reportModal")
    .style.display = "flex";
};


/* CLOSE MODAL */
window.closeReportModal = function(){

  document.getElementById("reportModal")
    .style.display = "none";
};


/* SUBMIT REPORT */
window.submitReport = async function(){

  try {

    const reason =
      document.getElementById("reportReason").value;

    const details =
      document.getElementById("reportDetails").value;

    if (!reason) {
      alert("Please select a reason.");
      return;
    }

    await addDoc(collection(db, "reports"), {

      reportedUser: selectedReportedUser,

      reportedBy: auth.currentUser.uid,

      reason: reason,

      details: details,

      status: "pending",

      createdAt: serverTimestamp()
    });

    alert("Report submitted successfully.");

    closeReportModal();

  } catch(err){

    console.error(err);
    alert(err.message);
  }
};

window.toggleCardMenu = function(btn){

  const dropdown =
    btn.nextElementSibling;

  dropdown.classList.toggle("show");
};

/*chat window function*/
window.toggleChatMenu = function(){

  const menu =
    document.getElementById("chatDropdown");

  if (menu) menu.classList.toggle("show");
};

/* Navigate back to matches list reliably */
window.goBackToMatches = function() {
  try {
    // If referrer is from match page, use history back to preserve state
    if (document.referrer && document.referrer.includes('match')) {
      history.back();
      return;
    }
  } catch (e) {
    // ignore
  }
  window.location.href = 'match.html';
};

window.reportChatUser = function() {
  alert("Report user from chat will open soon.");
};

window.blockUser = function() {
  alert("Block user feature is not available yet.");
};

window.unmatchUser = function() {
  alert("Unmatch feature is not available yet.");
};


/* ============================================================
   13. AVATAR INITIALS (from saved user)
   ============================================================ */
function loadUserContext() {
  const user = JSON.parse(localStorage.getItem('amorwa_user') || 'null');
  if (!user) return;

  const initials = document.getElementById('avatarInitials');
  if (initials && user.name) {
    const parts = user.name.split(' ');
    initials.textContent = parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  }

  const nameInput = document.getElementById('profileName');
  if (nameInput && user.name) nameInput.value = user.name;
}

/* ============================================================
   14. PAGE DETECT & INIT
   ============================================================ */
function detectPage() {
  const path = window.location.pathname;
  const file = path.split('/').pop() || 'index.html';

  if (file === 'swipe.html') return 'swipe';
  if (file === 'match.html') return 'match';
  if (file === 'chat.html')  return 'chat';
  if (file === 'register.html') return 'register';
  if (file === 'login.html')    return 'login';
  if (file === 'profile.html')  return 'profile';
  return 'home';
}

/* ============================================================
   15. BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  applyTranslations();
  buildLangDropdown();
  initPwToggle();
  loadUserContext();

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const page = detectPage();

  switch (page) {
    case 'register': initRegisterForm(); break;
    case 'login': initLoginForm(); break;
    case 'profile':
      if (typeof window !== 'undefined' && typeof window.initProfileSetup === 'function') {
        window.initProfileSetup();
      } else {
        console.warn('initProfileSetup is not defined.');
      }
      break;
    case 'swipe': initSwipePage(); break;
    case 'match': initMatchPage(); break;
    case 'chat': 
      initChatPage();
      // Reapply translations for chat page elements
      setTimeout(() => applyTranslations(), 100);
      break;
  }
});
