import { NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/server-auth";
import { ROLES } from "@/constants/roles";
import { db } from "@/lib/db";
import os from "os";

/**
 * Comprehensive health check endpoint for Admin monitoring
 * Returns real-time system metrics: DB status, API latency, memory usage
 */
export async function GET(request) {
    try {
        const currentUser = await getCurrentUser();

        // Only Admin can access system health (using normalized check)
        const { getNormalizedRole: normalize } = await import('@/constants/roles');
        const role = normalize(currentUser);

        if (!currentUser || role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Access denied. System health is restricted to Admin only.' }, { status: 403 });
        }

        // Measure API latency (time to check DB)
        const startTime = Date.now();

        // Check database connection
        let dbStatus = 'Disconnected';
        let dbLatency = 0;
        try {
            await db.testConnection();
            dbLatency = Date.now() - startTime;
            dbStatus = 'Connected';
        } catch (error) {
            dbStatus = 'Error';
            console.error('DB Health check failed:', error);
        }

        // Calculate memory usage
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);

        // Get system uptime
        const uptimeSeconds = process.uptime();
        const uptimeHours = Math.floor(uptimeSeconds / 3600);

        // Response
        const healthData = {
            status: dbStatus === 'Connected' ? 'healthy' : 'degraded',
            dbStatus,
            dbLatency: `${dbLatency}ms`,
            apiLatency: `${dbLatency}ms`,
            storageUsage: `${memoryUsagePercent}%`,
            memoryUsed: `${Math.round(usedMemory / (1024 * 1024 * 1024) * 10) / 10}GB`,
            memoryTotal: `${Math.round(totalMemory / (1024 * 1024 * 1024) * 10) / 10}GB`,
            uptime: uptimeHours > 24 ? `${Math.floor(uptimeHours / 24)} days` : `${uptimeHours} hrs`,
            platform: os.platform(),
            cpuCount: os.cpus().length,
            timestamp: new Date().toISOString(),
            version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
            environment: process.env.NODE_ENV
        };

        const statusCode = healthData.status === 'healthy' ? 200 : 503;

        return NextResponse.json(healthData, {
            status: statusCode,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });
    } catch (error) {
        console.error('Health check error:', error);
        return NextResponse.json({
            status: 'error',
            error: 'Health check failed',
            dbStatus: 'Unknown',
            apiLatency: 'N/A',
            storageUsage: 'N/A'
        }, { status: 500 });
    }
}
