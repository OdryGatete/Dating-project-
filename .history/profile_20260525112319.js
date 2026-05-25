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
  const selectedInterests = new Set();
  if (interestContainer) {
    interestContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tag');
      if (!btn || !interestContainer.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();

      const tagText = btn.textContent.trim();
      if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        btn.setAttribute('aria-pressed', 'false');
        selectedInterests.delete(tagText);
        return;
      }

      if (selectedInterests.size >= 5) {
        alert('You can choose up to 5 interests.');
        return;
      }

      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
      selectedInterests.add(tagText);
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

      const selectedTags = selectedInterests.size
        ? Array.from(selectedInterests)
        : [...document.querySelectorAll('.tag.selected')].map(t => t.textContent.trim());

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
        tags: selectedTags
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
    console.warn('[profile.js] No current user when liking');
    alert("You must be logged in");
    return;
  }

  if (targetUserId === currentUser.uid) {
    console.warn('[profile.js] User tried to like themselves');
    return;
  }

  const likeId = `${currentUser.uid}_${targetUserId}`;
  const likeRef = doc(db, "likes", likeId);

  try {
    console.debug('[profile.js] Checking existing like:', likeId);
    const likeDoc = await getDoc(likeRef);
    
    if (!likeDoc.exists()) {
      console.debug('[profile.js] Saving new like:', likeId);
      await setDoc(likeRef, {
        from: currentUser.uid,
        to: targetUserId,
        createdAt: serverTimestamp()
      });
      console.debug('[profile.js] Like saved successfully');
    } else {
      console.debug('[profile.js] Like already exists, skipping save');
    }

    // Check for mutual like
    const reverseId = `${targetUserId}_${currentUser.uid}`;
    console.debug('[profile.js] Checking reverse like:', reverseId);
    const reverseLike = await getDoc(doc(db, "likes", reverseId));

    if (reverseLike.exists()) {
      console.debug('[profile.js] Mutual like detected! Creating match...');
      await createMatch(currentUser.uid, targetUserId);
    } else {
      console.debug('[profile.js] No reverse like yet');
    }
  } catch (err) {
    console.error('[profile.js] handleLike error:', err.code, err.message);
    const msg = err.code === 'permission-denied' 
      ? 'Unable to save like. Please check permissions.'
      : 'Unable to like user. Please try again.';
    showToast(typeof window.t === 'function' ? t('matchFound') : msg);
  }
}

async function createMatch(user1, user2) {
  const matchId = [user1, user2].sort().join("_");
  const matchRef = doc(db, "matches", matchId);
  
  try {
    console.debug('[profile.js] Checking for existing match:', matchId);
    const existingMatch = await getDoc(matchRef);

    if (existingMatch.exists()) {
      console.debug('[profile.js] Match already exists');
      // Match already exists, just show it
    } else {
      console.debug('[profile.js] Creating new match:', matchId);
      await setDoc(matchRef, {
        users: [user1, user2],
        matchedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        mutual: true
      });
      console.debug('[profile.js] Match created successfully');
    }

    // Fetch partner profile for match screen
    const partnerId = user1 === auth.currentUser.uid ? user2 : user1;
    console.debug('[profile.js] Loading partner profile:', partnerId);
    
    const partnerDoc = await getDoc(doc(db, 'users', partnerId));
    if (!partnerDoc.exists()) {
      console.warn('[profile.js] Partner profile not found');
      window.location.href = `chat.html?matchId=${matchId}`;
      return;
    }

    const partner = partnerDoc.data();
    const lastMatch = {
      matchId,
      name: partner.name || partner.displayName || 'Someone',
      grad: partner.grad || '#e879a0',
      avatar: partner.avatar || partner.photo || partner.photoURL || ''
    };

    localStorage.setItem('amorwa_lastMatch', JSON.stringify(lastMatch));
    console.debug('[profile.js] Match screen data saved, showing match page');

    showToast(typeof window.t === 'function' ? t('matchFound') : "🎉 It's a Match!");
    window.location.href = 'match.html';
  } catch (err) {
    console.error('[profile.js] createMatch error:', err.code, err.message);
    const matchId = [user1, user2].sort().join("_");
    console.debug('[profile.js] Fallback: redirecting to chat');
    window.location.href = `chat.html?matchId=${matchId}`;
  }
}

async function loadProfiles() {
  console.debug('[profile.js] loadProfiles() starting');

  try {
    const matchedUserIds = new Set();
    if (auth.currentUser) {
      try {
        console.debug('[profile.js] Querying matches for current user:', auth.currentUser.uid);
        const matchesQuery = query(
          collection(db, 'matches'),
          where('users', 'array-contains', auth.currentUser.uid)
        );
        const matchesSnapshot = await getDocs(matchesQuery);
        console.debug('[profile.js] Found matches:', matchesSnapshot.size);
        matchesSnapshot.forEach((matchDoc) => {
          const matchData = matchDoc.data();
          const otherId = Array.isArray(matchData.users)
            ? matchData.users.find((uid) => uid !== auth.currentUser.uid)
            : null;
          if (otherId) matchedUserIds.add(otherId);
        });
      } catch (matchErr) {
        console.warn('[profile.js] Error loading matches:', matchErr.code, matchErr.message);
      }
    }

    console.debug('[profile.js] Querying all active users');
    const q = query(
      collection(db, "users"),
      where('status', '==', 'active')
    );
    const querySnapshot = await getDocs(q);
    console.debug('[profile.js] Query returned', querySnapshot.size, 'users');

    PROFILES = [];
    cardIndex = 0;

    let skipped = 0;
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data) {
        skipped++;
        return;
      }

      // exclude deleted/inactive users and malformed docs
      if (data.deleted) {
        console.debug('[profile.js] Skipping deleted user:', data.userId);
        skipped++;
        return;
      }
      if (data.status !== 'active') {
        console.debug('[profile.js] Skipping non-active user:', data.userId, 'status=', data.status);
        skipped++;
        return;
      }
      if (!data.userId || !data.name) {
        console.debug('[profile.js] Skipping malformed user (missing userId/name)');
        skipped++;
        return;
      }

      const avatarUrl = data.avatar || data.avatarUrl || data.photo || data.photoURL || data.uploadedAvatarUrl || '';
      if (!avatarUrl) {
        console.debug('[profile.js] Skipping user with no avatar:', data.userId);
        skipped++;
        return;
      }

      // skip yourself
      if (auth.currentUser && data.userId === auth.currentUser.uid) {
        console.debug('[profile.js] Skipping self:', data.userId);
        skipped++;
        return;
      }

      data.isMatched = matchedUserIds.has(data.userId);
      PROFILES.push(data);
    });

    PROFILES.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return bTime - aTime;
    });

    console.debug('[profile.js] loadProfiles() complete: loaded', PROFILES.length, 'profiles, skipped', skipped, 'users');
    console.debug('[profile.js] Profile IDs:', PROFILES.map(p => p.userId));
    renderCards();
  } catch (err) {
    console.error('[profile.js] loadProfiles() error:', err.code, err.message, err);
    showEmptyState();
    (window.showToast && window.showToast('Error loading profiles. Please refresh.')) || alert('Error loading profiles. Please refresh.');
  }
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
      ${profile.isMatched ? '<div class="matched-badge">Matched</div>' : ''}
    </div>
    <div class="card-info">
      <h3>${profile.name}, ${profile.age}</h3>
      <p>📍 ${profile.city}</p>
      <p>${profile.bio}</p>
      <div class="card-tags">
        ${(profile.tags || []).map(t => `<span class="card-tag">${t}</span>`).join('')}
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
    const selectedTags = new Set(tags);
    document.querySelectorAll('.interest-tags .tag').forEach(btn => {
      const txt = btn.textContent.trim();
      if (selectedTags.has(txt)) {
        btn.classList.add('selected');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('selected');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  } catch (e) {
    console.warn('Failed to load profile data for prefill', e);
  }
});

window.initProfileSetup = initProfileSetup;
window.initSwipePage = initSwipePage;

