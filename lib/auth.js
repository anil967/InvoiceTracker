import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    return new TextEncoder().encode(secret);
}

export async function encrypt(payload) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(getSecret());
}

export async function decrypt(input) {
    try {
        const { payload } = await jwtVerify(input, getSecret(), {
            algorithms: ['HS256'],
        });
        return payload;
    } catch {
        return null; // Expired or invalid token
    }
}

export async function login(user) {
    // Create the session
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const session = await encrypt({ user, expires });

    // Save the session in a cookie
    const cookieStore = await cookies();
    cookieStore.set('session', session, {
        expires,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // 'lax' works reliably on Vercel/HTTPS; 'strict' can block cookie after redirects
        path: '/',
    });
}

export async function logout_session() {
    const cookieStore = await cookies();
    cookieStore.set('session', '', { expires: new Date(0), path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return null;
    return await decrypt(session);
}
