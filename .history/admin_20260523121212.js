/* ============================================================
   AmorWa Admin Panel — admin.js
   Firebase Realtime Dashboard Logic
   ============================================================ */

'use strict';

/* ============================================================
   1. IMPORT FIREBASE
   ============================================================ */

import { auth, db } from "./firebase.js";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  addDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";


/* ============================================================
   2. GLOBAL VARIABLES
   ============================================================ */

let usersTableBody = null;
let reportsTableBody = null;
let statCards = null;
let adminInitialized = false;

let allUsers = [];
let allReports = [];
let totalMatches = 0;


/* ============================================================
   3. INITIALIZE DOM REFERENCES (after page loads)
   ============================================================ */

function initializeDOMReferences() {
  if (adminInitialized) return;
  
  usersTableBody = document.querySelector("#section-users tbody");
  reportsTableBody = document.querySelector("#section-reports tbody");
  statCards = document.querySelectorAll(".stat-value");
  
  if (!usersTableBody || !reportsTableBody) {
    console.warn("⚠️ Admin dashboard DOM elements not found. Retrying...");
    setTimeout(initializeDOMReferences, 500);
    return;
  }
  
  adminInitialized = true;
  console.log("✅ Admin dashboard initialized");
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDOMReferences);
} else {
  setTimeout(initializeDOMReferences, 100);
}


/* ============================================================
   4. AUTH CHECK
   ============================================================ */

let authCheckComplete = false;

onAuthStateChanged(auth, async (user) => {

  /* NOT LOGGED IN */
  if (!user) {
    console.log("🚪 No user logged in, redirecting to login...");
    window.location.href = "login.html";
    return;
  }

  // Prevent multiple auth checks
  if (authCheckComplete) {
    console.log("✓ Auth already verified");
    return;
  }
  authCheckComplete = true;

  try {
    console.log("🔐 Verifying admin access for:", user.email);
    
    let isAdmin = false;

    /* GET ADMINS */
    try {
      const adminSnapshot = await getDocs(collection(db, "admins"));
      
      console.log("📋 Found", adminSnapshot.size, "admin records");

      adminSnapshot.forEach((doc) => {
        const adminData = doc.data();
        if (adminData.email && adminData.email.toLowerCase() === user.email.toLowerCase()) {
          isAdmin = true;
          console.log("✅ User is admin!");
        }
      });
    } catch (adminErr) {
      console.warn("⚠️ Could not read admins collection:", adminErr.code, adminErr.message);
      
      // Fallback: check user doc for role = admin
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
          isAdmin = true;
          console.log("✅ User is admin (via role field)");
        }
      } catch (e) {
        console.warn("⚠️ Fallback check failed:", e.message);
      }
    }

    /* BLOCK NON ADMINS */
    if (!isAdmin) {
      console.error("❌ Access denied - user is not admin");
      (window.showToast && window.showToast("Access denied. Admins only.")) || alert("Access denied. Admins only.");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
      return;
    }

    console.log("✅ Admin verified, loading dashboard...");
    
    // Initialize DOM after auth is confirmed
    initializeDOMReferences();
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      loadAdminProfile();
      loadDashboard();
      loadUsers();
      loadReports();
    }, 100);

  } catch (error) {
    console.error("❌ Auth error:", error);
    (window.showToast && window.showToast("Failed to verify admin access.")) || alert("Failed to verify admin access.");
  }
});

/* ============================================================
   5. LOAD DASHBOARD STATS
   ============================================================ */

async function loadDashboard() {
  console.log("📊 Loading dashboard stats...");
  
  /* USERS */
  onSnapshot(collection(db, "users"), (snapshot) => {
    allUsers = [];
    snapshot.forEach((docSnap) => {
      allUsers.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    console.log("👥 Loaded", allUsers.length, "users");
    updateDashboardStats();
  }, (error) => {
    console.error("❌ Users listener error:", error);
  });

  /* REPORTS */
  onSnapshot(collection(db, "reports"), (snapshot) => {
    allReports = [];
    snapshot.forEach((docSnap) => {
      allReports.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    console.log("📢 Loaded", allReports.length, "reports");
    updateDashboardStats();
  }, (error) => {
    console.error("❌ Reports listener error:", error);
  });

  /* MATCHES */
  onSnapshot(collection(db, "matches"), (snapshot) => {
    totalMatches = snapshot.size;
    console.log("💖 Loaded", totalMatches, "matches");
    updateDashboardStats();
  }, (error) => {
    console.error("❌ Matches listener error:", error);
  });
}


/* ============================================================
   6. UPDATE DASHBOARD CARDS
   ============================================================ */

function updateDashboardStats() {
  const totalUsers = allUsers.length;
  const activeUsers = allUsers.filter(user => user.status !== "banned").length;
  const reportsCount = allReports.length;

  if (statCards && statCards.length >= 4) {
    if (statCards[0]) statCards[0].textContent = totalUsers;
    if (statCards[1]) statCards[1].textContent = activeUsers;
    if (statCards[2]) statCards[2].textContent = reportsCount;
    if (statCards[3]) statCards[3].textContent = totalMatches;
  }

  updateSidebarStats(totalUsers, reportsCount);
  loadActivityFeed();
}


/* ============================================================
   7. LOAD USERS TABLE
   ============================================================ */

function loadUsers() {
  if (!usersTableBody) {
    console.warn("⚠️ usersTableBody not initialized");
    setTimeout(loadUsers, 500);
    return;
  }

  const q = query(
    collection(db, "users"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    console.log("📝 Rendering", snapshot.size, "users");
    usersTableBody.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const user = docSnap.data();
      const userId = docSnap.id;

      const initials = getInitials(user.name || "User");

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>
          <input type="checkbox" class="tbl-check">
        </td>

        <td>
          <div class="user-cell">
            <div class="user-avatar">
              ${initials}
            </div>

            <div>
              <div class="user-name">
                ${user.name || "No Name"}
              </div>

              <div class="user-id">
                ${userId}
              </div>
            </div>
          </div>
        </td>

        <td>
          ${user.email || "No Email"}
        </td>

        <td>
          <span class="badge ${
            user.status === "banned"
              ? "badge-banned"
              : "badge-active"
          }">
            ${
              user.status === "banned"
                ? "Banned"
                : "Active"
            }
          </span>
        </td>

        <td>
          ${user.location || "Unknown"}
        </td>

        <td>
          ${formatDate(user.createdAt)}
        </td>

        <td>
          ${user.matches || 0}
        </td>

        <td>
          <div class="actions-cell">

            <button
              class="btn btn-ghost btn-sm ban-btn"
              data-id="${userId}"
              data-status="${user.status || 'active'}"
            >
              ${
                user.status === "banned"
                  ? "✅ Unban"
                  : "🔒 Ban"
              }
            </button>

            <button
              class="btn btn-danger btn-sm delete-btn"
              data-id="${userId}"
            >
              🗑 Delete
            </button>

          </div>
        </td>
      `;

      usersTableBody.appendChild(row);
    });

    attachUserActions();
  }, (error) => {
    console.error("❌ Users table listener error:", error);
  });
}


/* ============================================================
   7. BAN / UNBAN / DELETE USERS
   ============================================================ */

function attachUserActions() {

  /* BAN USER */
  document.querySelectorAll(".ban-btn").forEach((btn) => {

    btn.addEventListener("click", async () => {

      const userId = btn.dataset.id;
      const currentStatus = btn.dataset.status;

      try {

        await updateDoc(doc(db, "users", userId), {
          status:
            currentStatus === "banned"
              ? "active"
              : "banned"
        });

        showToast(
          currentStatus === "banned"
            ? "User unbanned"
            : "User banned"
        );

      } catch (error) {
        console.error(error);
      }
    });
  });


  /* DELETE USER */
  document.querySelectorAll(".delete-btn").forEach((btn) => {

    btn.addEventListener("click", async () => {

      const userId = btn.dataset.id;

      const confirmDelete = confirm(
        "Delete this user permanently?"
      );

      if (!confirmDelete) return;

      try {

        await deleteDoc(doc(db, "users", userId));

        showToast("User deleted");

      } catch (error) {
        console.error(error);
      }
    });
  });
}


/* ============================================================
   9. LOAD REPORTS
   ============================================================ */

function loadReports() {
  if (!reportsTableBody) {
    console.warn("⚠️ reportsTableBody not initialized");
    setTimeout(loadReports, 500);
    return;
  }

  const q = query(
    collection(db, "reports"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    console.log("📝 Rendering", snapshot.size, "reports");
    reportsTableBody.innerHTML = "";

    snapshot.forEach((docSnap) => {

      const report = docSnap.data();
      const reportId = docSnap.id;

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>
          <input type="checkbox" class="tbl-check">
        </td>

        <td>
          <span class="report-id">
            ${reportId}
          </span>
        </td>

        <td>
          ${report.reportedUser || "Unknown"}
        </td>

        <td>
          ${report.reportedBy || "Unknown"}
        </td>

        <td>
          ${report.reason || "No reason"}
        </td>

        <td>
          ${formatDate(report.createdAt)}
        </td>

        <td>
          <span class="badge ${
            report.status === "resolved"
              ? "badge-resolved"
              : "badge-pending"
          }">
            ${
              report.status || "Pending"
            }
          </span>
        </td>

        <td>

          <button
            class="btn btn-primary btn-sm resolve-btn"
            data-id="${reportId}"
          >
            ${
              report.status === "resolved"
                ? "Resolved"
                : "Resolve"
            }
          </button>

        </td>
      `;

      reportsTableBody.appendChild(row);
    });

    attachReportActions();
  }, (error) => {
    console.error("❌ Reports table listener error:", error);
  });
}

/* ============================================================
   RECENT ACTIVITY FEED
   ============================================================ */

function loadActivityFeed() {

  const activityFeed =
    document.getElementById("activityFeed");

  if (!activityFeed) return;

  activityFeed.innerHTML = "";

  /* RECENT USERS */
  allUsers
    .slice(0, 3)
    .forEach(user => {

      const item = document.createElement("div");

      item.className = "activity-item";

      item.innerHTML = `
        <div class="activity-timeline">
          <span class="activity-dot dot-emerald"></span>
        </div>

        <div class="activity-body">
          <p class="activity-text">
            <strong>${user.name || "New User"}</strong>
            joined the platform
          </p>

          <p class="activity-time">
            Recently
          </p>
        </div>
      `;

      activityFeed.appendChild(item);
    });

  /* RECENT REPORTS */
  allReports
    .slice(0, 3)
    .forEach(report => {

      const item = document.createElement("div");

      item.className = "activity-item";

      item.innerHTML = `
        <div class="activity-timeline">
          <span class="activity-dot dot-rose"></span>
        </div>

        <div class="activity-body">
          <p class="activity-text">
            New report against
            <strong>${report.reportedUser || "Unknown User"}</strong>
          </p>

          <p class="activity-time">
            Recently
          </p>
        </div>
      `;

      activityFeed.appendChild(item);
    });
}
/* ============================================================
   9. RESOLVE REPORTS
   ============================================================ */

function attachReportActions() {

  document.querySelectorAll(".resolve-btn").forEach((btn) => {

    btn.addEventListener("click", async () => {

      const reportId = btn.dataset.id;

      try {

        await updateDoc(doc(db, "reports", reportId), {
          status: "resolved"
        });

        showToast("Report resolved");

      } catch (error) {
        console.error(error);
      }
    });
  });
}


/* ============================================================
   10. SEARCH USERS
   ============================================================ */

const userSearchInput = document.querySelector(
  '#section-users input[type="search"]'
);

if (userSearchInput) {

  userSearchInput.addEventListener("input", () => {

    const value = userSearchInput.value.toLowerCase();

    document.querySelectorAll("#section-users tbody tr")
      .forEach((row) => {

        row.style.display =
          row.innerText.toLowerCase().includes(value)
            ? ""
            : "none";
      });
  });
}


/* ============================================================
   11. SEARCH REPORTS
   ============================================================ */

const reportSearchInput = document.querySelector(
  '#section-reports input[type="search"]'
);

if (reportSearchInput) {

  reportSearchInput.addEventListener("input", () => {

    const value = reportSearchInput.value.toLowerCase();

    document.querySelectorAll("#section-reports tbody tr")
      .forEach((row) => {

        row.style.display =
          row.innerText.toLowerCase().includes(value)
            ? ""
            : "none";
      });
  });
}


/* ============================================================
   12. LOGOUT
   ============================================================ */

const logoutBtn = document.querySelector(
  'a[href="index.html"]'
);

if (logoutBtn) {

  logoutBtn.addEventListener("click", async (e) => {

    e.preventDefault();

    try {

      await signOut(auth);

      window.location.href = "login.html";

    } catch (error) {
      console.error(error);
    }
  });
}


/* ============================================================
   13. THEME TOGGLE
   ============================================================ */

const themeBtn = document.querySelector(
  '.icon-btn[aria-label="Toggle theme"]'
);

if (themeBtn) {

  let currentTheme =
    localStorage.getItem("admin_theme") || "dark";

  applyTheme();

  themeBtn.addEventListener("click", () => {

    currentTheme =
      currentTheme === "dark"
        ? "light"
        : "dark";

    localStorage.setItem(
      "admin_theme",
      currentTheme
    );

    applyTheme();
  });

  function applyTheme() {

    document.documentElement.setAttribute(
      "data-theme",
      currentTheme
    );

    themeBtn.textContent =
      currentTheme === "dark"
        ? "🌙"
        : "☀️";
  }
}


/* ============================================================
   14. HELPER FUNCTIONS
   ============================================================ */

function getInitials(name) {

  return name
    .split(" ")
    .map(word => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}


function formatDate(timestamp) {

  if (!timestamp) return "N/A";

  try {

    const date =
      timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

    return date.toLocaleDateString();

  } catch {

    return "N/A";
  }
}
function updateSidebarStats(usersCount, reportsCount) {

  const usersBadge =
    document.getElementById("sidebarUsersCount");

  const reportsBadge =
    document.getElementById("sidebarReportsCount");

  if (usersBadge) {

    usersBadge.textContent =
      usersCount >= 1000
        ? (usersCount / 1000).toFixed(1) + "k"
        : usersCount;
  }

  if (reportsBadge) {
    reportsBadge.textContent = reportsCount;
  }
}

function showToast(message) {

  let toast = document.createElement("div");

  toast.className = "admin-toast";

  toast.innerText = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  setTimeout(() => {

    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
    }, 300);

  }, 3000);
}

async function loadAdminProfile() {

  const user = auth.currentUser;

  if (!user) return;

  try {

    const adminRef = doc(db, "admins", user.uid);

    const snap = await getDoc(adminRef);

    let adminName = "Admin";
    let adminRole = "Super Admin";

    if (snap.exists()) {

      const data = snap.data();

      adminName = data.name || "Admin";
      adminRole = data.role || "Super Admin";
    }

    // Create initials
    const initials = adminName
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    /* =========================
       SIDEBAR PROFILE
    ========================= */

    const sidebarName =
      document.getElementById("adminName");

    const sidebarRole =
      document.getElementById("adminRole");

    const sidebarAvatar =
      document.getElementById("adminAvatar");

    if (sidebarName)
      sidebarName.textContent = adminName;

    if (sidebarRole)
      sidebarRole.textContent = adminRole;

    if (sidebarAvatar)
      sidebarAvatar.textContent = initials;

    /* =========================
       TOPBAR PROFILE
    ========================= */

    const topbarName =
      document.getElementById("topbarAdminName");

    const topbarAvatar =
      document.getElementById("topbarAvatar");

    if (topbarName)
      topbarName.textContent = adminName;

    if (topbarAvatar)
      topbarAvatar.textContent = initials;

  } catch (error) {

    console.error("Failed to load admin profile:", error);
  }
}

/* ============================================================
   15. OPTIONAL: CREATE TEST REPORT
   ============================================================ */

window.createTestReport = async function () {

  await addDoc(collection(db, "reports"), {

    reportedUser: "Test User",
    reportedBy: "Admin",
    reason: "Spam",
    status: "pending",
    createdAt: serverTimestamp()

  });

  showToast("Test report created");
};