import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
/* ============================================================
   PROFILE SETUP
============================================================ */
let PROFILES = [];
let uploadedAvatarUrl = "";
let isUploading = false;

function initProfileSetup() {
  const avatarInput = document.getElementById('avatarInput');
  const avatarImg = document.getElementById('avatarImg');
  const avatarInitials = document.getElementById('avatarInitials');

  if (avatarInput) {
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files[0];
      if (!file) return;
        isUploading = true;

      // preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        avatarImg.src = ev.target.result;
        avatarImg.style.display = 'block';
        if (avatarInitials) avatarInitials.style.display = 'none';
      };
      reader.readAsDataURL(file);

      try {
        // upload to Cloudinary
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "dating_app");

        const res = await fetch(
          "https://api.cloudinary.com/v1_1/dkwllehmt/image/upload",
          { method: "POST", body: formData }
        );

        const data = await res.json();
        if (data?.secure_url) {
  uploadedAvatarUrl = data.secure_url;
  isUploading = false;
} else {
  console.warn('Cloudinary upload did not return secure_url', data);
        isUploading = false;
}
      }catch (err) {
  isUploading = false;
  console.error('Avatar upload failed', err);
  alert('Photo upload failed. Please try again.');
}
    });
  }

  const tagButtons = Array.from(document.querySelectorAll('.interest-tags .tag'));
  const selectedTags = new Set();

  function updateTagUI() {
    tagButtons.forEach(btn => {
      const text = btn.textContent.trim();
      btn.classList.toggle('selected', selectedTags.has(text));
      btn.setAttribute('aria-pressed', selectedTags.has(text) ? 'true' : 'false');
    });
  }

  tagButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const text = btn.textContent.trim();

      if (selectedTags.has(text)) {
        selectedTags.delete(text);
        updateTagUI();
        return;
      }

      if (selectedTags.size >= 5) {
        alert('You can choose up to 5 interests.');
        return;
      }

      selectedTags.add(text);
      updateTagUI();
    });
  });

  // If a profile already exists for the logged-in user, prefill fields and mark tags
  async function prefillExistingProfile() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return;
      const pdata = userDoc.data();

      if (pdata.name) document.getElementById('profileName').value = pdata.name;
      if (pdata.age) document.getElementById('profileAge').value = pdata.age;
      if (pdata.city) document.getElementById('profileCity').value = pdata.city;
      if (pdata.bio) document.getElementById('profileBio').value = pdata.bio;
      if (pdata.avatar) {
        uploadedAvatarUrl = pdata.avatar;
        avatarImg.src = pdata.avatar;
        avatarImg.style.display = 'block';
        if (avatarInitials) avatarInitials.style.display = 'none';
      }

      // mark tags that match saved interests (normalize to handle emoji or formatting)
      const normalizeTag = (s) => {
        if (!s) return '';
        try {
          return String(s).replace(/[^
          \p{L}\p{N}\s]/gu, '').trim().toLowerCase();
        } catch (e) {
          // fallback for environments without Unicode property escapes
          return String(s).replace(/[^\w\s]/g, '').trim().toLowerCase();
        }
      };

      const savedTags = (pdata.tags || []).map(t => normalizeTag(t));
      tagButtons.forEach(btn => {
        const text = btn.textContent.trim();
        const norm = normalizeTag(text);
        if (savedTags.includes(norm)) selectedTags.add(text);
      });

      updateTagUI();
    } catch (err) {
      console.warn('Failed to prefill profile', err);
    }
  }

  // run prefill when auth is ready
  onAuthStateChanged(auth, (user) => {
    if (user) prefillExistingProfile();
  });

  // save profile
 
  const form = document.getElementById('profileForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('Please log in first.');
        window.location.href = 'login.html';
        return;
      }

      const data = {
        userId: currentUser.uid,
        name: document.getElementById('profileName')?.value || '',
        age: document.getElementById('profileAge')?.value || '',
        city: document.getElementById('profileCity')?.value || '',
        bio: document.getElementById('profileBio')?.value || '',
        avatar: uploadedAvatarUrl,
        tags: [...selectedTags]
      };

      if (!data.name || !data.age || !data.city) {
        alert('Please complete your name, age and location.');
        return;
      }

     if (isUploading) {
  alert("Please wait for image upload to finish.");
  return;
}
      try {
        await setDoc(doc(db, 'users', currentUser.uid), data);
        // Use global showToast/t if available, otherwise fallback to alert
        if (typeof window.showToast === 'function') {
          const msg = typeof window.t === 'function' ? window.t('profileSaved') : 'Profile saved!';
          window.showToast(msg);
        } else {
          alert(typeof window.t === 'function' ? window.t('profileSaved') : 'Profile saved!');
        }
        window.location.href = 'swipe.html';
      } catch (err) {
        console.error('Failed to save profile', err);
        alert('Unable to save profile right now. Please try again.');
      }
    });
  }
}


/* ============================================================
   SWIPE SYSTEM
============================================================ */



let cardIndex = 0;
let isDragging = false;
let startX = 0;
let currentX = 0;
let activeCard = null;

async function handleLike(targetUserId) {


  const currentUser = auth.currentUser;
  if (!currentUser) {
  alert("Authentication not ready. Please wait.");
  return;
}

  if (!currentUser) {
    alert("You must be logged in");
    return;
  }

  // Save like
  await setDoc(doc(db, "likes", `${currentUser.uid}_${targetUserId}`), {
    from: currentUser.uid,
    to: targetUserId
  });

  // Check reverse like
  const reverseLike = await getDoc(
    doc(db, "likes", `${targetUserId}_${currentUser.uid}`)
  );

  if (reverseLike.exists()) {
    createMatch(currentUser.uid, targetUserId);
  }
}

  async function createMatch(user1, user2) {
  const matchId = [user1, user2].sort().join("_");

  await setDoc(doc(db, "matches", matchId), {
    users: [user1, user2],
    createdAt: Date.now()
  });

  alert("🎉 It's a match!");

  window.location.href = `chat.html?matchId=${matchId}`;
}
async function loadProfiles() {
  const querySnapshot = await getDocs(collection(db, "users"));

  PROFILES = [];
  cardIndex = 0;

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
   

    // ❗ skip yourself
    if (auth.currentUser && data.userId !== auth.currentUser.uid) {
  PROFILES.push(data);
}
  });

  renderCards();
}
function initSwipePage() {
  const stack = document.getElementById('cardStack');
  if (!stack) return;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      cardIndex = 0; // ✅ extra safety reset
      loadProfiles();
      bindSwipeButtons();
    } else {
      alert("You must log in first");
      window.location.href = "login.html";
    }
  });
}

function renderCards() {
  const stack = document.getElementById('cardStack');
  if (!stack) return;

  stack.innerHTML = '';

  const remaining = PROFILES.slice(cardIndex);

  if (remaining.length === 0) {
    showEmptyState();
    return;
  }

  remaining.slice(0, 4).forEach(profile => {
    stack.appendChild(createCard(profile));
  });

  //bindDrag(stack.firstChild);
}

function createCard(profile) {
  const card = document.createElement('div');
  card.className = 'swipe-card';

  card.innerHTML = `
    <div class="card-img-placeholder">
      <img src="${profile.avatar || 'default-avatar.png'}" style="width:100%;height:100%;object-fit:cover;border-radius:15px;" />
    </div>
    <div class="card-info">
      <h3>${profile.name}, ${profile.age}</h3>
      <p>📍 ${profile.city}</p>
      <p>${profile.bio}</p>
      <div>
        ${(profile.tags || []).map(t => `<span>${t}</span>`).join('')}
      </div>
    </div>
  `;

  return card;
}

/* swipe logic (unchanged but cleaned) */

function bindSwipeButtons() {
  document.getElementById('likeBtn')?.addEventListener('click', () => {
    const top = document.querySelector('.swipe-card');
    if (top) swipe('right', top);
  });

  document.getElementById('passBtn')?.addEventListener('click', () => {
    const top = document.querySelector('.swipe-card');
    if (top) swipe('left', top);
  });
}

function swipe(direction, card) {
  const profile = PROFILES[cardIndex];

 if (!profile) {
    return renderCards(); // reload safely
  }
  if (direction === 'right') {
  showToast(t('liked'));

  if (profile.userId) {
    handleLike(profile.userId);
  }
}

  card.remove();
  cardIndex++;
  renderCards();
}
function showEmptyState() {
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('swipeActions').style.display = 'none';
}

window.resetCards = function () {
  cardIndex = 0;
  renderCards();
};

document.addEventListener("DOMContentLoaded", () => {
  initProfileSetup();
  if (document.getElementById("cardStack")) {
    initSwipePage();
  }
});

// Expose init functions to legacy non-module code that expects globals
if (typeof window !== 'undefined') {
  window.initProfileSetup = initProfileSetup;
  window.initSwipePage = initSwipePage;
}