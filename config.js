// Firebase project settings.
// Firebase console → Project settings → General → Your apps → Web app → "SDK setup and configuration" → Config.
// These are not secret: access is controlled by firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyBtFkr4vEuj0_XtSN3gGXh1i7kUzrsvyOw",
  authDomain: "fiesta-hub-68418.firebaseapp.com",
  projectId: "fiesta-hub-68418",
  storageBucket: "fiesta-hub-68418.firebasestorage.app",
  messagingSenderId: "298154868011",
  appId: "1:298154868011:web:611364bdae4dcfd132d96e"
};

// Emails that are always admins, even before anyone is added on the Access page.
// Keep this list identical to bootstrapAdmin() in firestore.rules.
export const ADMIN_EMAILS = [
  "rhdptmej0102@gmail.com"
];

// Request emails (optional, free): paste the web app URL from tools/email-hook.gs once it's deployed,
// and the same key you set in that script. Left empty, the site offers to open a pre-filled email instead.
export const EMAIL_HOOK = {
  url: "",
  key: ""
};
