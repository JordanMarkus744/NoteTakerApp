// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import { inject } from "@vercel/analytics";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyACBEA9Ol8HAhPY8k3wwWH_52LkU4YoWDo",
  authDomain: "notesapp-50dda.firebaseapp.com",
  projectId: "notesapp-50dda",
  storageBucket: "notesapp-50dda.appspot.com",
  messagingSenderId: "1098631667450",
  appId: "1:1098631667450:web:ecb892fd820671ea4bf343",
  measurementId: "G-D4SZJSBZ4C",
};

let currentTitle = "";
let currentContent = "";
let currentUser = null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const notesContainer = document.getElementById("notes-wrapper");
const popupOverlay = document.getElementById("popup-overlay");
const notesPopup = document.getElementById("notes-popup");
const deleteNoteBtn = document.getElementById("delete-note-btn");
const authPopup = document.getElementById("auth-popup");
const userInfo = document.getElementById("user-info");
const userEmail = document.getElementById("user-email");

// Reference to the "notes" collection
const notesRef = collection(db, "notes");

// Auth functions
function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password).catch(
    (error) => {
      console.error("Error signing up:", error);
      throw error;
    }
  );
}

function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password).catch((error) => {
    console.error("Error logging in:", error);
    throw error;
  });
}

// Logout
window.logout = function () {
  signOut(auth)
    .then(() => {
      console.log("Logged out");
      authPopup.style.display = "flex";
      userInfo.style.display = "none";
    })
    .catch((error) => {
      console.error("Error signing out:", error);
    });
};

// Get document data
function getDataFromDoc(docId) {
  const docRef = doc(db, "notes", docId);
  return getDoc(docRef).then((docSnap) =>
    docSnap.exists() ? docSnap.data() : null
  );
}

function getFormattedDate(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateText(text, maxLines = 5) {
  if (!text) return "";
  const lines = text.split("\n");
  return lines.length <= maxLines
    ? text
    : lines.slice(0, maxLines).join("\n") + "...";
}

function renderNotes(docSnap) {
  let noteCard = document.createElement("div");
  noteCard.classList.add("notes-card");
  noteCard.setAttribute("data-id", docSnap.id);

  const title = docSnap.data().title || "Untitled Note";
  const content = docSnap.data().Notes || "";
  const timestamp = docSnap.data().timestamp || Date.now();

  noteCard.innerHTML = `
    <div class="notes-title"><h3>${title}</h3></div>
    <div class="notes-content"><p>${truncateText(content)}</p></div>
    <div class="notes-footer">Last edited: ${getFormattedDate(timestamp)}</div>
  `;

  noteCard.addEventListener("click", function (event) {
    event.stopPropagation();
    let noteId = this.getAttribute("data-id");
    showNotesPopup(noteId);
  });

  notesContainer.appendChild(noteCard);
}

// Load notes of the current user only
async function loadNotes() {
  if (!currentUser) return;

  notesContainer.innerHTML = "";
  const q = query(notesRef, where("uid", "==", currentUser.uid));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    notesContainer.innerHTML = `<div id="no-notes-message"><h3>No Notes Yet</h3><p>Click the + button to create your first note</p></div>`;
    return;
  }

  querySnapshot.forEach(renderNotes);
}

// Show popup with note data
window.showNotesPopup = async function (noteId) {
  popupOverlay.classList.add("active");
  notesPopup.classList.add("active");
  window.currentNoteId = noteId;

  if (noteId) {
    let docData = await getDataFromDoc(noteId);
    deleteNoteBtn.style.display = "flex";

    if (docData) {
      document.getElementById("popup-title-input").value = docData.title || "";
      document.getElementById("popup-content-input").value =
        docData.Notes || "";
      currentTitle = docData.title || "";
      currentContent = docData.Notes || "";
    } else {
      document.getElementById("popup-title-input").value = "Note not found";
      document.getElementById("popup-content-input").value = "";
      currentTitle = "";
      currentContent = "";
    }
  } else {
    document.getElementById("popup-title-input").value = "";
    document.getElementById("popup-content-input").value = "";
    currentTitle = "";
    currentContent = "";
    deleteNoteBtn.style.display = "none";
  }

  document.getElementById("popup-title-input").focus();
};

window.saveNote = async function () {
  if (!currentUser) return;

  let noteId = window.currentNoteId;
  let title = document.getElementById("popup-title-input").value.trim();
  let content = document.getElementById("popup-content-input").value.trim();

  if (title === "" && content === "") {
    window.closePopup();
    return;
  }

  if (title === "") title = "Untitled Note";
  const timestamp = Date.now();

  if (noteId) {
    if (title === currentTitle && content === currentContent) {
      window.closePopup();
      return;
    }

    try {
      await updateDoc(doc(db, "notes", noteId), {
        title,
        Notes: content,
        timestamp,
      });
    } catch (error) {
      console.error("Error updating document: ", error);
    }
  } else {
    try {
      await addDoc(collection(db, "notes"), {
        title,
        Notes: content,
        timestamp,
        uid: currentUser.uid,
      });
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }

  window.closePopup();
  loadNotes();
};

window.deleteNote = async function () {
  if (!window.currentNoteId) return;
  try {
    await deleteDoc(doc(db, "notes", window.currentNoteId));
    window.closePopup();
    loadNotes();
  } catch (error) {
    console.error("Error removing document: ", error);
  }
};

window.closePopup = function () {
  popupOverlay.classList.remove("active");
  notesPopup.classList.remove("active");
  window.currentNoteId = null;
  document.getElementById("popup-title-input").value = "";
  document.getElementById("popup-content-input").value = "";
  currentTitle = "";
  currentContent = "";
};

// Auth state listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    console.log("Logged in as:", user.email);
    authPopup.style.display = "none";
    userInfo.style.display = "flex";
    userEmail.textContent = user.email;
    loadNotes();
  } else {
    authPopup.style.display = "flex";
    userInfo.style.display = "none";
  }
});

// Tabs switcher
window.switchTab = function (tab) {
  document.getElementById("login-form").classList.add("hidden");
  document.getElementById("signup-form").classList.add("hidden");
  document.getElementById("login-tab").classList.remove("active");
  document.getElementById("signup-tab").classList.remove("active");
  if (tab === "login") {
    document.getElementById("login-form").classList.remove("hidden");
    document.getElementById("login-tab").classList.add("active");
  } else {
    document.getElementById("signup-form").classList.remove("hidden");
    document.getElementById("signup-tab").classList.add("active");
  }
};

// Login
document.getElementById("login-button").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const errorElement = document.getElementById("login-error");

  if (!email || !password) {
    errorElement.textContent = "Please enter both email and password";
    errorElement.style.display = "block";
    return;
  }

  try {
    await login(email, password);
    errorElement.style.display = "none";
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.style.display = "block";
  }
});

// Sign up
document.getElementById("signup-button").addEventListener("click", async () => {
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const errorElement = document.getElementById("signup-error");

  if (!email || !password) {
    errorElement.textContent = "Please enter both email and password";
    errorElement.style.display = "block";
    return;
  }

  if (password.length < 6) {
    errorElement.textContent = "Password should be at least 6 characters";
    errorElement.style.display = "block";
    return;
  }

  try {
    await signUp(email, password);
    errorElement.style.display = "none";
    switchTab("login");
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.style.display = "block";
  }
});

// UI event listeners
document.getElementById("close-popup-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  closePopup();
});

document.getElementById("cancel-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  closePopup();
});

notesPopup.addEventListener("click", (e) => e.stopPropagation());
