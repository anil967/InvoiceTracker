import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const data = await request.json();

        // Fetch existing user to preserve password/immutable fields
        const existingUser = await db.getUserById(id);
        if (!existingUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Prepare update object (re-using createUser which handles upsert)
        // Note: db.createUser expects the full object including passwordHash
        // Real implementation should probably have a dedicated updateUser method, 
        // but given db.js structure, we can pass existing hash back.
        // Wait, db.getUserById doesn't return passwordHash. We need it.
        // Let's use getUserByEmail to get the hash since we don't have a direct "updateUser" that merges.
        // Actually, db.createUser allows overwriting. If we don't pass passwordHash, it might be lost if we aren't careful.
        // Let's check db.js implementation of createUser... it uses findOneAndUpdate.

        // To be safe, we should ideally fetch the full document including hash, or update db.js.
        // For now, let's fetch by email to get the full user object including hash from the DB layer 
        // (but db.getUserByEmail returns an API-safe object with hash).
        // Yes, db.getUserByEmail returns 'password_hash' property mapping to logic.

        const fullUser = await db.getUserByEmail(existingUser.email);

        const updatedUser = {
            id: id,
            name: data.name || existingUser.name,
            email: existingUser.email, // Email change not supported here for simplicity
            role: data.role || existingUser.role,
            assignedProjects: data.assignedProjects !== undefined ? data.assignedProjects : existingUser.assignedProjects,
            vendorId: data.vendorId !== undefined ? data.vendorId : existingUser.vendorId,
            isActive: data.isActive !== undefined ? data.isActive : existingUser.isActive,
            passwordHash: fullUser.password_hash // Preserve hash
        };

        const result = await db.createUser(updatedUser);
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Prevent deleting self
        if (currentUser.id === id) {
            return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
        }

        await db.deleteUser(id);
        return NextResponse.json({ message: 'User deleted' });

    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
