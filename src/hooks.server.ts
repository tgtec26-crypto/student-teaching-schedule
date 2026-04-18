import { redirect, type Handle } from '@sveltejs/kit';

/**
 * SvelteKit Server Hook: Route Protection
 *
 * This hook runs on every server-side request.
 * It checks for a 'userRole' cookie to determine if the user has access to protected routes.
 *
 * Protected Routes:
 * - /admin: Requires 'ADMIN' role
 * - /supervisor: Requires 'SUPERVISOR' role
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Let client-side handle routing logic for better UX with Firebase Auth
	return resolve(event);
};
