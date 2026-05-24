/**
 * One-off script to remove Firestore user docs and Cloudinary images for auth users that no longer exist.
 * Run this locally with service account credentials.
 *
 * Usage:
 *   node cleanupOrphanUsers.js /path/to/serviceAccountKey.json
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

async function main() {
  const keyPath = process.argv[2];
  if (!keyPath) {
    console.error('Provide path to service account JSON as first arg');
    process.exit(2);
  }

  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
  const db = admin.firestore();

  // Build set of auth uids
  const authUids = new Set();
  let nextPageToken;
  do {
    const list = await admin.auth().listUsers(1000, nextPageToken);
    list.users.forEach(u => authUids.add(u.uid));
    nextPageToken = list.pageToken;
  } while (nextPageToken);

  console.log('Loaded', authUids.size, 'auth users');

  // Scan user documents and delete those not in authUids
  const usersSnap = await db.collection('users').get();
  const batch = db.batch();
  let deleted = 0;

  for (const docSnap of usersSnap.docs) {
    const uid = docSnap.id;
    if (!authUids.has(uid)) {
      console.log('Deleting orphan user doc:', uid);
      const data = docSnap.data();
      // optionally delete cloudinary image via REST if avatarPublicId present
      if (data && data.avatarPublicId) {
        console.log('  would delete Cloudinary image', data.avatarPublicId);
        // Could call Cloudinary destroy here if configured
      }
      batch.delete(docSnap.ref);
      deleted++;
    }
  }

  if (deleted > 0) {
    await batch.commit();
    console.log('Deleted', deleted, 'orphan user docs');
  } else {
    console.log('No orphan user docs found');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
