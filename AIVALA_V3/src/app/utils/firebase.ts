// Firebase Authentication Integration for AIVALA Platform
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from "firebase/auth";

// Firebase credentials extracted from google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyB2gft9lZBUqWHNeAZZbIARLe0PvbFDchk",
  authDomain: "aivala-15349.firebaseapp.com",
  projectId: "aivala-15349",
  storageBucket: "aivala-15349.firebasestorage.app",
  messagingSenderId: "358029947649",
  appId: "1:358029947649:android:c130e9489e7cc407b62100"
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

/**
 * Firebase restores the persisted session asynchronously in a WebView. Wait
 * for that restore before building authenticated API requests, then allow the
 * caller to force-refresh the ID token when a request must be accepted by the
 * backend.
 */
export function getFirebaseIdToken(
  forceRefresh = false,
  timeoutMs = 5_000,
): Promise<string | null> {
  const waitForUser = (): Promise<FirebaseUser | null> => {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);

    return new Promise((resolve) => {
      let unsubscribe: () => void = () => undefined;
      const timer = window.setTimeout(() => {
        unsubscribe();
        resolve(auth.currentUser);
      }, timeoutMs);

      unsubscribe = onAuthStateChanged(auth, (user) => {
        window.clearTimeout(timer);
        unsubscribe();
        resolve(user);
      });
    });
  };

  return waitForUser()
    .then((user) => user?.getIdToken(forceRefresh) || null)
    .catch(() => null);
}

// Helper function to format Firebase error codes
function formatAuthError(code?: string, fallbackMessage?: string): string {
  if (!code) return fallbackMessage || "Authentication failed";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Invalid email or password. Please check your credentials.";
  }
  if (code.includes("email-already-in-use")) {
    return "An account with this email already exists. Please log in.";
  }
  if (code.includes("weak-password")) {
    return "Password should be at least 6 characters long.";
  }
  if (code.includes("invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many failed attempts. Please try again later.";
  }
  return fallbackMessage || "Authentication failed";
}

// Helper function to sign up with Firebase
export async function registerWithFirebase(email: string, pass: string, name: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    if (userCredential.user) {
      await updateProfile(userCredential.user, { displayName: name });
    }
    const user = userCredential.user;
    const userData = {
      id: user.uid,
      name: name || user.email?.split('@')[0] || "User",
      email: user.email,
      provider: "HDFC ERGO • Firebase Auth"
    };
    localStorage.setItem("user", JSON.stringify(userData));
    return { success: true, user: userData };
  } catch (error: any) {
    console.error("Firebase Registration Error:", error);
    return { success: false, error: formatAuthError(error?.code, error?.message) };
  }
}

// Helper function to log in with Firebase
export async function loginWithFirebase(email: string, pass: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;
    const userData = {
      id: user.uid,
      name: user.displayName || user.email?.split('@')[0] || "User",
      email: user.email,
      provider: "HDFC ERGO • Firebase Auth"
    };
    localStorage.setItem("user", JSON.stringify(userData));
    return { success: true, user: userData };
  } catch (error: any) {
    console.error("Firebase Login Error:", error);
    return { success: false, error: formatAuthError(error?.code, error?.message) };
  }
}

// Helper function to logout
export async function logoutFirebase() {
  try {
    await signOut(auth);
    localStorage.removeItem("user");
    return true;
  } catch (error) {
    console.error("Firebase Logout Error:", error);
    localStorage.removeItem("user");
    return false;
  }
}
