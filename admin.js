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
  addDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";


/* ============================================================
   2. GLOBAL VARIABLES
   ============================================================ */

const usersTableBody = document.querySelector("#section-users tbody");
const reportsTableBody = document.querySelector("#section-reports tbody");

const statCards = document.querySelectorAll(".stat-value");

let allUsers = [];
let allReports = [];
let totalMatches = 0;


/* ============================================================
   3. AUTH CHECK
   ============================================================ */

onAuthStateChanged(auth, async (user) => {

  /* NOT LOGGED IN */

  if (!user) {

    window.location.href = "login.html";
    return;
  }

  try {

    /* GET ADMINS */

    const adminSnapshot =
      await getDocs(collection(db, "admins"));

    let isAdmin = false;

    adminSnapshot.forEach((doc) => {

      const adminData = doc.data();

      if (adminData.email === user.email) {
        isAdmin = true;
      }
    });

    /* BLOCK NON ADMINS */

    if (!isAdmin) {

      alert("Access denied. Admins only.");

      window.location.href = "index.html";

      return;
    }

    /* LOAD ADMIN DASHBOARD */

    loadDashboard();
    loadUsers();
    loadReports();

  } catch (error) {

    console.error(error);

    alert("Failed to verify admin access.");
  }
});

/* ============================================================
   4. LOAD DASHBOARD STATS
   ============================================================ */

async function loadDashboard() {

  /* USERS */
  onSnapshot(collection(db, "users"), (snapshot) => {

    allUsers = [];

    snapshot.forEach((docSnap) => {
      allUsers.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    updateDashboardStats();
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

    updateDashboardStats();
  });


  /* MATCHES */
  onSnapshot(collection(db, "matches"), (snapshot) => {

    totalMatches = snapshot.size;

    updateDashboardStats();
  });
}


/* ============================================================
   5. UPDATE DASHBOARD CARDS
   ============================================================ */

function updateDashboardStats() {

  const totalUsers = allUsers.length;

  const activeUsers = allUsers.filter(user =>
    user.status !== "banned"
  ).length;

  const reportsCount = allReports.length;

  
  if (statCards[0]) statCards[0].textContent = totalUsers;
if (statCards[1]) statCards[1].textContent = activeUsers;
if (statCards[2]) statCards[2].textContent = reportsCount;
if (statCards[3]) statCards[3].textContent = totalMatches;

/* UPDATE SIDEBAR BADGES */
updateSidebarStats(totalUsers, reportsCount);
loadActivityFeed();
}


/* ============================================================
   6. LOAD USERS TABLE
   ============================================================ */

function loadUsers() {

  const q = query(
    collection(db, "users"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {

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
   8. LOAD REPORTS
   ============================================================ */

function loadReports() {

  const q = query(
    collection(db, "reports"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {

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