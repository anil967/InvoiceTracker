import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

export const dynamic = 'force-dynamic';

const MIME_BY_EXT = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
};

/**
 * GET /api/invoices/[id]/file
 * Serves the invoice document for viewing (e.g. when clicking Verification).
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const invoice = await db.getInvoice(id);

        if (!invoice || !invoice.fileUrl) {
            return NextResponse.json({ error: 'Invoice or file not found' }, { status: 404 });
        }

        const fileUrl = invoice.fileUrl;
        const originalName = invoice.originalName || `invoice-${id}.pdf`;

        // Data URI (e.g. from ingest: data:application/pdf;base64,...)
        if (fileUrl.startsWith('data:')) {
            const match = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (!match) {
                return NextResponse.json({ error: 'Invalid file data' }, { status: 400 });
            }
            const mimeType = match[1].trim();
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    'Content-Type': mimeType,
                    'Content-Disposition': `inline; filename="${originalName.replace(/"/g, '%22')}"`,
                    'Cache-Control': 'private, max-age=3600',
                },
            });
        }

        // Path (e.g. /uploads/invoices/xxx.pdf from vendor submit)
        if (fileUrl.startsWith('/')) {
            const filePath = path.join(process.cwd(), fileUrl.replace(/^\//, ''));
            try {
                const stat = await fs.stat(filePath);
                if (!stat.isFile()) {
                    return NextResponse.json({ error: 'File not found' }, { status: 404 });
                }
            } catch {
                return NextResponse.json({ error: 'File not found' }, { status: 404 });
            }
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';
            const buffer = await fs.readFile(filePath);
            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    'Content-Type': mimeType,
                    'Content-Disposition': `inline; filename="${originalName.replace(/"/g, '%22')}"`,
                    'Cache-Control': 'private, max-age=3600',
                },
            });
        }

        return NextResponse.json({ error: 'Unsupported file reference' }, { status: 400 });
    } catch (err) {
        console.error('[API] Invoice file serve error:', err);
        return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
    }
}
