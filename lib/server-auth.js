import { getSession } from '@/lib/auth';

/**
 * Retrieves the currently authenticated user from the session cookie.
 * This is designed for usage in Next.js Server Components and API Routes.
 * 
 * @returns {Promise<Object|null>} The user object if authenticated, or null.
 */
export async function getCurrentUser() {
    try {
        const session = await getSession();
        if (!session || !session.user) {
            return null;
        }
        return session.user;
    } catch (error) {
        console.error("Error retrieving current user:", error);
        return null;
    }
}

/**
 * Assert that a user is authenticated. Throws if not.
 */
export async function requireUser() {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error("Unauthorized");
    }
    return user;
}
