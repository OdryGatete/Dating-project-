import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

/* ============================================================
   MATCH PAGE
============================================================ */

async function initMatchPage() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    await updateMatchHeader();
    await loadMatches(user.uid);
    spawnConfetti();
  });
}

async function updateMatchHeader() {
  const lastMatch = JSON.parse(localStorage.getItem('amorwa_lastMatch') || 'null');
  const screen = document.getElementById('matchScreen');
  const nameEl = document.getElementById('matchName');
  const avatarEl = document.getElementById('matchAvatar');
  const initialEl = document.getElementById('matchInitial');
  const startChatBtn = document.getElementById('startChatBtn');

  if (!lastMatch || !startChatBtn) {
    if (screen) screen.style.display = 'none';
    return;
  }

  if (nameEl) nameEl.textContent = lastMatch.name;
  if (avatarEl) avatarEl.style.background = lastMatch.grad || '#e879a0';
  if (initialEl) initialEl.textContent = lastMatch.name?.[0] || '?';
  startChatBtn.href = 'chat.html?matchId=' + lastMatch.matchId;
}

async function loadMatches(currentUid) {
  const grid = document.getElementById('matchesGrid');
  if (!grid) return;

  const matchesQuery = query(
    collection(db, 'matches'),
    where('users', 'array-contains', currentUid)
  );

  console.debug('[match.js] Setting up real-time listener for matches');

  onSnapshot(matchesQuery, async (snapshot) => {
    console.debug('[match.js] Matches snapshot received:', snapshot.size);
    const cards = [];

    for (const matchDoc of snapshot.docs) {
      const matchData = matchDoc.data();
      const partnerId = Array.isArray(matchData.users)
        ? matchData.users.find((id) => id !== currentUid)
        : null;

      if (!partnerId) continue;

      try {
        const partnerDoc = await getDoc(doc(db, 'users', partnerId));
        if (!partnerDoc.exists()) continue;

        const partner = partnerDoc.data();
        const displayName = partner.name || partner.displayName || (partner.email ? partner.email.split('@')[0] : 'Match');
        const avatar = partner.photo || partner.photoURL || partner.avatar || '';
        cards.push({
          matchId: matchDoc.id,
          name: displayName,
          age: partner.age || '',
          grad: partner.grad || '#7c3aed',
          avatar,
        });
      } catch (err) {
        console.warn('[match.js] Failed to load match partner:', err);
      }
    }

    console.debug('[match.js] Rendering', cards.length, 'match cards');
    renderMatchesGrid(cards);
  }, (err) => {
    console.error('[match.js] Match listener error:', err);
  });
}

/* ============================================================
   CONFETTI
============================================================ */

function spawnConfetti() {
  const container = document.getElementById('confetti');
  if (!container) return;

  const colors = ['#e879a0','#7c3aed','#f5576c','#facc15','#4ade80','#60a5fa'];

  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.position = 'absolute';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.top = '-10px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = '8px';
    piece.style.height = '8px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(piece);
  }
}

/* ============================================================
   MATCH GRID
============================================================ */

function renderMatchesGrid(matches) {
  const grid = document.getElementById('matchesGrid');
  if (!grid) return;

  if (!matches || !matches.length) {
    grid.innerHTML = '<div class="empty-state"><p>No matches yet. Keep swiping!</p></div>';
    return;
  }

  grid.innerHTML = matches.map((p) => `
    <div class="match-card" data-match-id="${p.matchId}" data-name="${p.name}" data-grad="${p.grad}">
      <div class="mc-img" style="background:${p.grad}">${p.avatar ? '' : (p.name?.[0] || '?')}</div>
      <div class="mc-meta">
        <div class="mc-name">${p.name}</div>
        <div class="mc-sub">${p.age || ''}</div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.match-card').forEach((card) => {
    card.addEventListener('click', () => {
      openChat(card.dataset.matchId, card.dataset.name, card.dataset.grad);
    });
  });
}

/* ============================================================
   HELPERS
============================================================ */

function openChat(matchId, name, grad) {
  if (!matchId) return;
  const partner = { name, grad, matchId };
  localStorage.setItem('amorwa_chatPartner', JSON.stringify(partner));
  window.location.href = 'chat.html?matchId=' + matchId;
}

window.initMatchPage = initMatchPage;
window.openChat = openChat;
