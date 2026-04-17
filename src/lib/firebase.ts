import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { teacherMetadata, getStandardizedName } from './teacherData';

const firebaseConfig = {
// ... (omitted config for brevity in this thought, will provide full replacement)
	apiKey: 'AIzaSyAWk9OxdEFTtQ3pvErnkSEki65BMHFD46k',
	authDomain: 'testprojecttgtec.firebaseapp.com',
	projectId: 'testprojecttgtec',
	storageBucket: 'testprojecttgtec.firebasestorage.app',
	messagingSenderId: '414637479547',
	appId: '1:414637479547:web:7519a3f42b8475946334de'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'STUDENT' | null;

// User State Store
export const user = writable<any>(null);
export const userRole = writable<UserRole>(null);

// Derived Stores for UI convenience
export const isAdmin = derived(userRole, ($role) => $role === 'ADMIN');
export const isSupervisor = derived(
	userRole,
	($role) => $role === 'SUPERVISOR' || $role === 'ADMIN'
);
export const isStudent = derived(userRole, ($role) => $role === 'STUDENT' || $role === 'ADMIN');

// Cookie Sync for Server-Side Protection
function setRoleCookie(role: UserRole) {
	if (!browser) return;
	if (role) {
		// Set cookie for 1 hour (matches Firebase session roughly)
		document.cookie = `userRole=${role}; path=/; max-age=3600; SameSite=Lax`;
	} else {
		// Clear cookie
		document.cookie = `userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
	}
}

// User Sync & Role Management
async function syncUser(u: any): Promise<UserRole> {
	if (!u || !u.email) return null;

	const userRef = doc(db, 'users', u.email);
	const docSnap = await getDoc(userRef);

	const standardizedName = getStandardizedName(u.email, u.displayName);

	if (!docSnap.exists()) {
		// New user: set default role
		// Special case for the primary admin
		const role: UserRole = u.email === 'tgtec26@snu-g.ms.kr' ? 'ADMIN' : 'STUDENT';
		await setDoc(userRef, {
			email: u.email,
			displayName: standardizedName,
			photoURL: u.photoURL,
			role: role,
			createdAt: serverTimestamp(),
			lastLogin: serverTimestamp()
		});
		return role;
	} else {
		// Existing user: update last login and profile info
		let role = docSnap.data().role;
		
		// Force ADMIN role for the primary admin email
		if (u.email === 'tgtec26@snu-g.ms.kr') {
			role = 'ADMIN';
		}

		await setDoc(
			userRef,
			{
				displayName: standardizedName,
				photoURL: u.photoURL,
				role: role, // Ensure role is updated/maintained
				lastLogin: serverTimestamp()
			},
			{ merge: true }
		);

		// Migration from old 'USER' role if necessary
		if (role === 'USER') return 'STUDENT';
		return role as UserRole;
	}
}

// Observe Auth State
onAuthStateChanged(auth, async (u) => {
	if (u) {
		const role = await syncUser(u);
		userRole.set(role);
		setRoleCookie(role);

		// Fetch latest profile from Firestore to ensure standardized name is used
		// Note: We use email as the document ID in 'users' collection
		const userRef = doc(db, 'users', u.email!);
		const userSnap = await getDoc(userRef);
		
		if (userSnap.exists()) {
			const userData = userSnap.data();
			// Create a merged user object with standardized displayName
			const mergedUser = {
				...u,
				displayName: userData.displayName || u.displayName,
				photoURL: userData.photoURL || u.photoURL
			};
			user.set(mergedUser);
		} else {
			user.set(u);
		}
	} else {
		user.set(null);
		userRole.set(null);
		setRoleCookie(null);
	}
});

// Login/Logout Functions
export async function login() {
	try {
		googleProvider.setCustomParameters({ prompt: 'select_account' });
		const result = await signInWithPopup(auth, googleProvider);
		return result.user;
	} catch (error: any) {
		console.error('Login Error:', error);
		alert('로그인 중 오류가 발생했습니다: ' + error.message);
	}
}

export async function logout() {
	try {
		await signOut(auth);
		setRoleCookie(null);
	} catch (error) {
		console.error('Logout Error:', error);
	}
}
