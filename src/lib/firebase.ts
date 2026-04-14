import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { writable } from 'svelte/store';

const firebaseConfig = {
	apiKey: "AIzaSyAWk9OxdEFTtQ3pvErnkSEki65BMHFD46k",
	authDomain: "testprojecttgtec.firebaseapp.com",
	projectId: "testprojecttgtec",
	storageBucket: "testprojecttgtec.firebasestorage.app",
	messagingSenderId: "414637479547",
	appId: "1:414637479547:web:7519a3f42b8475946334de"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// User State Store
export const user = writable<any>(null);
export const isAdmin = writable<boolean>(false);

// Admin Privilege Check
async function checkAdminPrivilege(email: string | null) {
	if (!email) return false;
	if (email === 'tgtec26@snu-g.ms.kr') return true;

	try {
		const docSnap = await getDoc(doc(db, "settings", "admin_whitelist"));
		if (docSnap.exists()) {
			const adminList = docSnap.data().emails || [];
			return adminList.includes(email);
		}
	} catch (e) {
		console.error("Admin check error:", e);
	}
	return false;
}

// Observe Auth State
onAuthStateChanged(auth, async (u) => {
	user.set(u);
	if (u) {
		const isUserAdmin = await checkAdminPrivilege(u.email);
		isAdmin.set(isUserAdmin);
	} else {
		isAdmin.set(false);
	}
});

// Login/Logout Functions
export async function login() {
	try {
		googleProvider.setCustomParameters({ prompt: 'select_account' });
		const result = await signInWithPopup(auth, googleProvider);
		return result.user;
	} catch (error: any) {
		console.error("Login Error:", error);
		alert("로그인 중 오류가 발생했습니다: " + error.message);
	}
}

export async function logout() {
	try {
		await signOut(auth);
	} catch (error) {
		console.error("Logout Error:", error);
	}
}
