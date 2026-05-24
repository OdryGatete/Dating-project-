const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

// Expect these env vars to be set via `firebase functions:config:set cloudinary.key="..." cloudinary.secret="..." cloudinary.cloud_name="..."`
const CLOUD_NAME = functions.config().cloudinary && functions.config().cloudinary.cloud_name;
const API_KEY = functions.config().cloudinary && functions.config().cloudinary.key;
const API_SECRET = functions.config().cloudinary && functions.config().cloudinary.secret;

// Helper to call Cloudinary delete API
async function deleteCloudinary(publicId) {
  if (!publicId || !CLOUD_NAME || !API_KEY || !API_SECRET) return;

  // Cloudinary destroy endpoint requires signed request; for simplicity we call the Admin API via REST with basic auth
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/upload`;

  try {
    // Cloudinary recommends using the Admin API SDK or server-side SDK; here we call the delete endpoint via POST to /image/destroy
    const destroyUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`;
    const body = new URLSearchParams();
    body.append('public_id', publicId);

    const res = await fetch(destroyUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const json = await res.json();
    console.log('Cloudinary destroy result for', publicId, json);
  } catch (err) {
    console.warn('Failed to delete Cloudinary image', publicId, err.message || err);
  }
}

exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  try {
    const uid = user.uid;
    console.log('Auth user deleted:', uid);

    // Remove Firestore user document
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (snap.exists) {
      const data = snap.data();
      // delete Cloudinary image if public id saved
      if (data && data.avatarPublicId) {
        await deleteCloudinary(data.avatarPublicId);
      }
      await userRef.delete();
      console.log('Deleted user document for', uid);
    } else {
      console.log('No user doc found for', uid);
    }

    // Cleanup Storage files for this user
    await deleteUserStorageFiles(uid);

    // Cleanup likes, matches, reports that reference this uid
    const batch = db.batch();

    // likes
    const likesSnap = await db.collection('likes').where('from', '==', uid).get();
    likesSnap.forEach(d => batch.delete(d.ref));
    const likesToSnap = await db.collection('likes').where('to', '==', uid).get();
    likesToSnap.forEach(d => batch.delete(d.ref));

    // matches
    const matchesSnap = await db.collection('matches').where('users', 'array-contains', uid).get();
    matchesSnap.forEach(d => batch.delete(d.ref));

    // reports
    const rep1 = await db.collection('reports').where('reportedUser', '==', uid).get();
    rep1.forEach(d => batch.delete(d.ref));
    const rep2 = await db.collection('reports').where('reportedBy', '==', uid).get();
    rep2.forEach(d => batch.delete(d.ref));

    await batch.commit();
    console.log('Cleanup complete for', uid);
  } catch (err) {
    console.error('Error in onUserDeleted:', err);
  }
});
