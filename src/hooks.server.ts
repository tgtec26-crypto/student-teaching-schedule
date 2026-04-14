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
	const role = event.cookies.get('userRole');
	const path = event.url.pathname;

	// Protect /admin routes
	if (path.startsWith('/admin')) {
		if (role !== 'ADMIN') {
			throw redirect(303, '/');
		}
	}

	// Protect /supervisor routes
	if (path.startsWith('/supervisor')) {
		if (role !== 'SUPERVISOR' && role !== 'ADMIN') {
			throw redirect(303, '/');
		}
	}

	return resolve(event);
};
