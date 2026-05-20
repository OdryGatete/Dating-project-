
/* ============================================================
   MATCH PAGE
============================================================ */

function initMatchPage() {
  const lastMatch = JSON.parse(localStorage.getItem('amorwa_lastMatch') || 'null');

  if (lastMatch) {
    const nameEl = document.getElementById('matchName');
    const avatarEl = document.getElementById('matchAvatar');
    const initialEl = document.getElementById('matchInitial');

    if (nameEl) nameEl.textContent = lastMatch.name;
    if (avatarEl) avatarEl.style.background = lastMatch.grad || "#e879a0";
    if (initialEl) initialEl.textContent = lastMatch.name?.[0] || "?";

    localStorage.setItem('amorwa_chatPartner', JSON.stringify(lastMatch));
  }

  spawnConfetti();
  renderMatchesGrid();
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
    piece.style.position = "absolute";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.top = "-10px";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = "8px";
    piece.style.height = "8px";
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";

    container.appendChild(piece);
  }
}

/* ============================================================
   MATCH GRID
============================================================ */

function renderMatchesGrid() {
  const grid = document.getElementById('matchesGrid');
  if (!grid) return;

  const matches = JSON.parse(localStorage.getItem('amorwa_matches') || '[]');

  const display = matches.length ? matches : [];

  grid.innerHTML = display.map(p => `
    <div class="match-card" onclick="openChat('${p.name}')">
      <div class="mc-img" style="background:${p.grad || '#7c3aed'}">
        ${p.name?.[0] || "?"}
      </div>
      <div class="mc-name">${p.name}, ${p.age || ""}</div>
    </div>
  `).join('');
}

/* ============================================================
   CHAT SYSTEM
============================================================ */

const SEED_MESSAGES = [
  { from: 'them', text: "Muraho! 👋 How are you?", time: "2:30 PM" },
  { from: 'me', text: "I'm good 😊", time: "2:31 PM" }
];

function initChatPage() {
  const partner = JSON.parse(localStorage.getItem('amorwa_chatPartner') || 'null');

  const chatName = document.getElementById('chatName');
  const avatar = document.querySelector('.chat-avatar-sm');

  if (partner) {
    if (chatName) chatName.textContent = partner.name;
    if (avatar) {
      avatar.textContent = partner.name?.[0] || "?";
      avatar.style.background = partner.grad || "#7c3aed";
    }
  }

  renderMessages();

  const input = document.getElementById("chatInput");
  const btn = document.getElementById("sendBtn");

  if (btn) btn.onclick = sendMessage;
  if (input) input.onkeydown = (e) => {
    if (e.key === "Enter") sendMessage();
  };
}

/* ============================================================
   MESSAGES
============================================================ */

function renderMessages() {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  box.innerHTML = "";

  SEED_MESSAGES.forEach(m => {
    const div = document.createElement("div");
    div.className = "bubble " + m.from;
    div.textContent = m.text;
    box.appendChild(div);
  });
}

function sendMessage() {
  const input = document.getElementById("chatInput");
  const box = document.getElementById("chatMessages");

  if (!input || !box) return;

  const text = input.value.trim();
  if (!text) return;

  const msg = document.createElement("div");
  msg.className = "bubble me";
  msg.textContent = text;

  box.appendChild(msg);
  input.value = "";

  setTimeout(() => {
    const reply = document.createElement("div");
    reply.className = "bubble them";
    reply.textContent = "Nice! 😊";
    box.appendChild(reply);
  }, 1000);
}

/* ============================================================
   HELPERS
============================================================ */

function openChat(name) {
  localStorage.setItem("amorwa_chatPartner", JSON.stringify({ name }));
  window.location.href = "chat.html";
}