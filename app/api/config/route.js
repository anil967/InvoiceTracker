import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { ROLES } from "@/constants/roles";
import { db } from "@/lib/db";

// GET /api/config - Fetch system configuration
export async function GET(request) {
    try {
        const currentUser = await getCurrentUser();

        // Only Admin can access system configuration
        if (!currentUser || currentUser.role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
        }

        // Fetch configuration from database
        const config = await db.getSystemConfig();

        // Return default config if none exists
        if (!config) {
            const defaultConfig = {
                systemName: "InvoiceFlow",
                maintenanceMode: false,
                emailNotifications: true,
                autoBackup: true,
                sapIntegration: true,
                ringiIntegration: true,
                sharepointIntegration: true,
                smtpIntegration: true,
                matchTolerance: 5,
                ocrEngine: "azure",
                auditRetentionYears: 7,
                updatedAt: new Date(),
                updatedBy: currentUser.email
            };

            // Save default config to database
            await db.saveSystemConfig(defaultConfig);
            return NextResponse.json(defaultConfig);
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error('Config fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
    }
}

// PUT /api/config - Update system configuration
export async function PUT(request) {
    try {
        const currentUser = await getCurrentUser();

        // Only Admin can update system configuration
        if (!currentUser || currentUser.role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
        }

        const updates = await request.json();

        // Validate critical fields
        if (updates.matchTolerance && (updates.matchTolerance < 0 || updates.matchTolerance > 20)) {
            return NextResponse.json({ error: 'Match tolerance must be between 0-20%' }, { status: 400 });
        }

        if (updates.auditRetentionYears && updates.auditRetentionYears < 7) {
            return NextResponse.json({ error: 'Audit retention must be at least 7 years (compliance)' }, { status: 400 });
        }

        // Add metadata
        updates.updatedAt = new Date();
        updates.updatedBy = currentUser.email;

        // Save to database
        const updatedConfig = await db.saveSystemConfig(updates);

        // Log configuration change to audit trail
        await db.addAuditLog({
            username: currentUser.name,
            action: 'UPDATE',
            details: `System configuration updated: ${Object.keys(updates).join(', ')}`,
            invoice_id: null
        });

        return NextResponse.json(updatedConfig);
    } catch (error) {
        console.error('Config update error:', error);
        return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
    }
}
