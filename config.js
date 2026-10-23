// Firebase project settings.
// Firebase console → Project settings → General → Your apps → Web app → "SDK setup and configuration" → Config.
// Paste the values here. These are not secret: access is controlled by firestore.rules.
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

// Emails that are always admins, even before anyone is added on the Access page.
// Keep this list identical to ADMIN_EMAILS in firestore.rules.
export const ADMIN_EMAILS = [
  "YOUR_GOOGLE_EMAIL@gmail.com"
];
