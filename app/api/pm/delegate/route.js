import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getNormalizedRole } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';
import Users from '@/models/Users';
import connectToDatabase from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const user = await getCurrentUser();
        const role = getNormalizedRole(user);
        if (!user || role !== ROLES.PROJECT_MANAGER) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        await connectToDatabase();

        // Fetch current delegation status
        const currentUserData = await Users.findOne({ id: user.id }, 'delegatedTo delegationExpiresAt');

        // Fetch eligible delegates (e.g. Finance Users or Admins)
        // For simplicity, let's allow Finance Users
        const financeUsers = await Users.find({ role: ROLES.FINANCE_USER }, 'id name email');

        return NextResponse.json({
            delegates: financeUsers,
            currentDelegation: currentUserData.delegatedTo ? {
                to: currentUserData.delegatedTo,
                expiresAt: currentUserData.delegationExpiresAt
            } : null
        });
    } catch (error) {
        console.error('Error fetching delegates:', error);
        return NextResponse.json({ error: 'Failed to fetch delegates' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const user = await getCurrentUser();
        const role = getNormalizedRole(user);
        if (!user || role !== ROLES.PROJECT_MANAGER) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const data = await request.json();
        const { delegateUserId, durationDays = 7 } = data;

        if (!delegateUserId) {
            // Remove delegation if empty
            await connectToDatabase();
            await Users.updateOne(
                { id: user.id },
                { $unset: { delegatedTo: "", delegationExpiresAt: "" } }
            );
            return NextResponse.json({ success: true, message: 'Delegation removed' });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

        await connectToDatabase();
        await Users.updateOne(
            { id: user.id },
            {
                delegatedTo: delegateUserId,
                delegationExpiresAt: expiresAt
            }
        );

        return NextResponse.json({ success: true, message: `Authority delegated for ${durationDays} days` });

    } catch (error) {
        console.error('Error setting delegation:', error);
        return NextResponse.json({ error: 'Failed to set delegation' }, { status: 500 });
    }
}
