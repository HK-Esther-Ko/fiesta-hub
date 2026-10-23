// Thin wrapper over Firestore + Firebase Auth.
// app.js talks to `db` with collection()/doc()/onSnapshot()/set()/update(), so the UI code
// does not depend on Firebase's own API shape.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection as fsCollection, doc as fsDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  onSnapshot as fsOnSnapshot, query as fsQuery, orderBy as fsOrderBy, limit as fsLimit, FieldPath, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAILS } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = getFirestore(app);

const wrapDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data() });
const wrapQuery = s => ({ docs: s.docs.map(wrapDoc), size: s.size, empty: s.empty });
const isPlain = v => v !== null && typeof v === "object" && !Array.isArray(v);

// update() merges nested objects field by field (so {deliv:{a:true}} keeps deliv.b)
function flatten(obj, prefix, out){
  for (const [k, v] of Object.entries(obj)){
    const path = [...prefix, k];
    if (isPlain(v) && Object.keys(v).length) flatten(v, path, out);
    else out.push(new FieldPath(...path), v);
  }
  return out;
}

function docRef(ref){
  return {
    id: ref.id, path: ref.path,
    get: async () => wrapDoc(await getDoc(ref)),
    set: data => setDoc(ref, data),
    update: data => updateDoc(ref, ...flatten(data, [], [])),
    delete: () => deleteDoc(ref),
    onSnapshot: (next, err) => fsOnSnapshot(ref, s => next(wrapDoc(s)), err),
    collection: p => colRef(fsCollection(ref, p))
  };
}
function queryRef(q){
  return {
    orderBy: (f, dir) => queryRef(fsQuery(q, fsOrderBy(f, dir || "asc"))),
    limit: n => queryRef(fsQuery(q, fsLimit(n))),
    get: async () => wrapQuery(await getDocs(q)),
    onSnapshot: (next, err) => fsOnSnapshot(q, s => next(wrapQuery(s)), err)
  };
}
function colRef(c){
  return {
    ...queryRef(c), path: c.path,
    doc: id => docRef(id ? fsDoc(c, id) : fsDoc(c)),
    add: async data => { const r = fsDoc(c); await setDoc(r, data); return docRef(r); }
  };
}

export const db = { collection: p => colRef(fsCollection(fs, p)), doc: p => docRef(fsDoc(fs, p)) };

/* ---------- sign-in and access ---------- */
export const onUser = cb => onAuthStateChanged(auth, cb);
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser = () => signOut(auth);
export const isBootstrapAdmin = email => !!email && ADMIN_EMAILS.map(x => x.toLowerCase()).includes(email.toLowerCase());

// access: "admin" | "content" | "member"; null = not allowed in
export async function getAccess(email){
  try{
    const s = await getDoc(fsDoc(fs, "allowed", email.toLowerCase()));
    return s.exists() ? (s.data().access || "member") : null;
  }catch(e){ return null; }
}
export const setAccess = (email, patch) => setDoc(fsDoc(fs, "allowed", email.toLowerCase()), patch, { merge: true });
export const removeAccess = email => deleteDoc(fsDoc(fs, "allowed", email.toLowerCase()));

// json: { "<collection path>": { "<doc id>": {...fields} } }
export async function importData(json, onProgress){
  const entries = [];
  for (const [col, docs] of Object.entries(json)) for (const [id, data] of Object.entries(docs)) entries.push([col, id, data]);
  for (let i = 0; i < entries.length; i += 400){
    const b = writeBatch(fs);
    for (const [col, id, data] of entries.slice(i, i + 400)) b.set(fsDoc(fs, col, id), data);
    await b.commit();
    if (onProgress) onProgress(Math.min(i + 400, entries.length), entries.length);
  }
  return entries.length;
}
