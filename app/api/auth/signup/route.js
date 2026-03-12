import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { login } from '@/lib/auth';

export async function POST(request) {
    try {
        const { name, email, password, role, pmId } = await request.json();

        if (!name || !email || !password || !role) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const validRoles = ['Admin', 'PM', 'Finance User', 'Vendor'];
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role selected' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            return NextResponse.json(
                { error: 'User already exists with this email' },
                { status: 400 }
            );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        const userId = uuidv4();
        let vendorId = null;

        // For Vendor role: create a Vendor record with unique vendorCode and link to user
        if (role === 'Vendor') {
            const vendorRecord = await db.createVendor({
                id: 'v-' + userId.slice(0, 8),
                name,
                email: email.toLowerCase(),
                linkedUserId: userId,
            });
            vendorId = vendorRecord.id;
        }

        const newUser = {
            id: userId,
            name,
            email,
            passwordHash,
            role,
            vendorId,
            managedBy: (role === 'Vendor' && pmId) ? pmId : null,
        };

        const savedUser = await db.createUser(newUser);

        // Build a plain, JSON-serializable session object.
        // Mongoose documents contain non-serializable types (e.g., special arrays)
        // that cause DataCloneError when passed to SignJWT.
        const sessionUser = {
            id: savedUser.id,
            name: savedUser.name,
            email: savedUser.email,
            role: savedUser.role,
            vendorId: savedUser.vendorId ?? vendorId,
            isActive: savedUser.isActive !== false,
        };

        // Start session (include vendorId so vendor portal can show vendorCode)
        await login(sessionUser);

        return NextResponse.json({
            user: sessionUser,
            message: 'User created successfully'
        });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
