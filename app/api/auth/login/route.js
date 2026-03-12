import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { login } from '@/lib/auth';

// Basic email format validation
const isValidEmailFormat = (email) => {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(trimmed);
};

export async function POST(request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        const trimmedEmail = (email || '').trim().toLowerCase();
        if (!isValidEmailFormat(trimmedEmail)) {
            return NextResponse.json(
                { error: 'Please enter a valid email address' },
                { status: 400 }
            );
        }

        // Find user
        const user = await db.getUserByEmail(trimmedEmail);
        if (!user) {
            return NextResponse.json(
                { error: 'No account found with this email address' },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            return NextResponse.json(
                { error: 'Incorrect password. Please try again.' },
                { status: 401 }
            );
        }

        // Normalize role for internal consistency via helper
        const { getNormalizedRole: normalize } = await import('@/constants/roles');
        const normalizedRole = normalize({ role: user.role });

        // Clean user object for session
        const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: normalizedRole,
            vendorId: user.vendorId, // Include vendorId for role-based logic
            isActive: user.isActive !== false // Default to true unless explicitly set to false
        };

        // Start session
        await login(sessionUser);

        return NextResponse.json({
            user: sessionUser,
            message: 'Logged in successfully'
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
