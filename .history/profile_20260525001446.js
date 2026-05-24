import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

/* ============================================================
   PROFILE SETUP
============================================================ */
let PROFILES = [];

function initProfileSetup() {
  console.debug('[profile.js] initProfileSetup()');
  const avatarInput = document.getElementById('avatarInput');
  const avatarImg = document.getElementById('avatarImg');
  const avatarInitials = document.getElementById('avatarInitials');
  let avatarUploading = false;

  if (avatarInput) {
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files[0];
      if (!file) return;

      avatarUploading = true;
      avatarImg.dataset.cloudUrl = '';
      avatarImg.dataset.cloudPublicId = '';

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
        formData.append('file', file);
        formData.append('upload_preset', 'dating_app');

        const res = await fetch(
          'https://api.cloudinary.com/v1_1/dkwllehmt/image/upload',
          { method: 'POST', body: formData }
        );

        const data = await res.json();
        const imageUrl = data?.secure_url || data?.url || data?.secureUrl || '';
        if (imageUrl) {
          avatarImg.dataset.cloudUrl = imageUrl;
          avatarImg.dataset.cloudPublicId = data?.public_id || data?.publicId || '';
        } else {
          console.warn('Cloudinary upload did not return a usable URL', data);
          alert('Photo upload failed. Please try again.');
        }
      } catch (err) {
        console.error('Avatar upload failed', err);
        alert('Photo upload failed. Please try again.');
      } finally {
        avatarUploading = false;
      }

      avatarImg.dataset.uploaded = 'true';
    });
  }

  const interestContainer = document.getElementById('interestTags');
  if (interestContainer) {
    interestContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tag');
      if (!btn || !interestContainer.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();

      if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        btn.setAttribute('aria-pressed', 'false');
        return;
      }

      const selectedCount = interestContainer.querySelectorAll('.tag.selected').length;
      if (selectedCount >= 5) {
        alert('You can choose up to 5 interests.');
        return;
      }

      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
    });
  }

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

      if (avatarInput && avatarInput.files.length > 0 && !avatarImg.dataset.cloudUrl) {
        if (avatarUploading) {
          alert('Please wait until your photo upload completes.');
          return;
        }
        alert('Please upload a profile photo again before saving.');
        return;
      }

      const data = {
        userId: currentUser.uid,
        name: document.getElementById('profileName')?.value || '',
        age: document.getElementById('profileAge')?.value || '',
        city: document.getElementById('profileCity')?.value || '',
        bio: document.getElementById('profileBio')?.value || '',
        avatar: avatarImg?.dataset.cloudUrl || avatarImg?.src || '',
        avatarPublicId: avatarImg?.dataset.cloudPublicId || '',
        status: 'active',
        deleted: false,
        tags: [...document.querySelectorAll('.tag.selected')].map(t => t.textContent.trim())
      };

      if (!data.name || !data.age || !data.city) {
        alert('Please complete your name, age and location.');
        return;
      }

      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          ...data,
          createdAt: serverTimestamp()
        });
        showToast(typeof window.t === 'function' ? window.t('profileSaved') : 'Profile saved!');
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

  // Fetch partner profile to show on the match screen
  try {
    const partnerId = user1 === auth.currentUser.uid ? user2 : user1;
    const partnerDoc = await getDoc(doc(db, 'users', partnerId));
    const partner = partnerDoc.exists() ? partnerDoc.data() : {};

    const lastMatch = {
      matchId,
      name: partner.name || partner.displayName || 'Someone',
      grad: partner.grad || '#e879a0',
      avatar: partner.avatar || partner.photo || partner.photoURL || ''
    };

    localStorage.setItem('amorwa_lastMatch', JSON.stringify(lastMatch));

    // Friendly toast then go to the match screen where user can start chat
    showToast(typeof window.t === 'function' ? t('matchFound') : "🎉 It's a Match!");
    window.location.href = 'match.html';
    return;
  } catch (e) {
    console.warn('Could not load partner profile for match header', e);
    // fallback: go straight to chat if match screen cannot be prepared
    window.location.href = `chat.html?matchId=${matchId}`;
  }
}

async function loadProfiles() {
  const q = query(
    collection(db, "users"),
    where('status', '==', 'active')
  );
  const querySnapshot = await getDocs(q);

  PROFILES = [];
  cardIndex = 0;

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data) return; // skip empty

    // exclude deleted/inactive users and malformed docs
    if (data.deleted) return;
    if (data.status !== 'active') return;
    if (!data.userId || !data.name) return;

    const avatarUrl = data.avatar || data.avatarUrl || data.photo || data.photoURL || data.uploadedAvatarUrl || '';
    if (!avatarUrl) return;

    // skip yourself
    if (auth.currentUser && data.userId === auth.currentUser.uid) return;

    PROFILES.push(data);
  });

  PROFILES.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0;
    const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0;
    return bTime - aTime;
  });

  renderCards();
}

function initSwipePage() {
  const stack = document.getElementById('cardStack');
  if (!stack) return;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      cardIndex = 0; // extra safety reset
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
}

function createCard(profile) {
  const card = document.createElement('div');
  card.className = 'swipe-card';
  const avatarUrl = profile.avatar || profile.avatarUrl || profile.photo || profile.photoURL || profile.uploadedAvatarUrl || '';

  card.innerHTML = `
    <div class="card-img-placeholder">
      <img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:15px;" />
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

  // fallback placeholder for broken images (Cloudinary deletions)
  const img = card.querySelector('img');
  if (img) {
    const placeholder = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1200'><rect width='100%' height='100%' fill='%23e6e6e6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%23999'>No Photo</text></svg>";
    img.addEventListener('error', () => {
      if (img.src !== placeholder) img.src = placeholder;
    });
    if (!avatarUrl) img.src = placeholder;
  }

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
    showToast(typeof window.t === 'function' ? t('liked') : 'Liked');

    if (profile.userId) {
      handleLike(profile.userId);
    }
  }

  card.remove();
  cardIndex++;
  renderCards();
}

function showEmptyState() {
  const emptyEl = document.getElementById('emptyState');
  const actionsEl = document.getElementById('swipeActions');
  if (emptyEl) emptyEl.style.display = 'flex';
  if (actionsEl) actionsEl.style.display = 'none';
}

window.resetCards = function () {
  cardIndex = 0;
  renderCards();
};

// Initialize profile setup when user is authenticated and prefill data
onAuthStateChanged(auth, async (user) => {
  if (!user) return; // page may redirect elsewhere if not signed in

  // initialize listeners and UI
  initProfileSetup();

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) return;
    const pdata = userDoc.data() || {};

    const nameEl = document.getElementById('profileName');
    const ageEl = document.getElementById('profileAge');
    const cityEl = document.getElementById('profileCity');
    const bioEl = document.getElementById('profileBio');
    const avatarImg = document.getElementById('avatarImg');
    const avatarInitials = document.getElementById('avatarInitials');

    if (nameEl && pdata.name) nameEl.value = pdata.name;
    if (ageEl && pdata.age) ageEl.value = pdata.age;
    if (cityEl && pdata.city) cityEl.value = pdata.city;
    if (bioEl && pdata.bio) bioEl.value = pdata.bio;

    const avatarUrl = pdata.avatar || pdata.avatarUrl || pdata.photo || pdata.photoURL || pdata.uploadedAvatarUrl || '';
    if (avatarImg && avatarUrl) {
      avatarImg.src = avatarUrl;
      avatarImg.style.display = 'block';
      if (avatarInitials) avatarInitials.style.display = 'none';
      avatarImg.dataset.cloudUrl = avatarUrl;
    }

    // restore tags selection
    const tags = pdata.tags || [];
    if (tags.length) {
      document.querySelectorAll('.interest-tags .tag').forEach(btn => {
        const txt = btn.textContent.trim();
        if (tags.includes(txt)) {
          btn.classList.add('selected');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('selected');
          btn.setAttribute('aria-pressed', 'false');
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load profile data for prefill', e);
  }
});

window.initProfileSetup = initProfileSetup;
window.initSwipePage = initSwipePage;

