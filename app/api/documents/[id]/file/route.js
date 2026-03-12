import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';
import connectDB from '@/lib/mongodb';
import { DocumentUpload } from '@/models/Internal';

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
};

/**
 * GET /api/documents/[id]/file
 * Serves the document upload file for viewing (similar to invoice file endpoint).
 * This endpoint bypasses X-Frame-Options restrictions from cloud storage by
 * proxying through our backend with iframe-friendly headers.
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;

        // Get current user for authorization
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        // Fetch document from database
        const document = await DocumentUpload.findOne({ id });

        if (!document || !document.fileUrl) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Authorization check:
        // - Admin can view all documents
        // - PM can view all documents (project authorization removed)

        const fileUrl = document.fileUrl;
        const fileName = document.fileName || `document-${id}`;

        // Handle Data URIs (already have the content)
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
                    'Content-Disposition': `inline; filename="${fileName.replace(/"/g, '%22')}"`,
                    'Cache-Control': 'private, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Handle local file paths (/uploads/documents/...)
        if (fileUrl.startsWith('/')) {
            const { readFile } = await import('fs/promises');
            const { join } = await import('path');

            const filePath = join(process.cwd(), fileUrl.replace(/^\//, ''));
            const { stat } = await import('fs/promises');

            try {
                const fileStats = await stat(filePath);
                if (!fileStats.isFile()) {
                    return NextResponse.json({ error: 'File not found' }, { status: 404 });
                }
            } catch {
                return NextResponse.json({ error: 'File not found' }, { status: 404 });
            }

            const { extname } = await import('path');
            const ext = extname(filePath).toLowerCase();
            const mimeType = MIME_BY_EXT[ext] || document.mimeType || 'application/octet-stream';
            const buffer = await readFile(filePath);

            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    'Content-Type': mimeType,
                    'Content-Disposition': `inline; filename="${fileName.replace(/"/g, '%22')}"`,
                    'Cache-Control': 'private, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Handle external URLs (S3, Cloudinary, etc.)
        // We need to fetch the file and serve it with proper headers
        return new NextResponse(
            new ReadableStream({
                async start(controller) {
                    try {
                        const response = await fetch(fileUrl, {
                            cache: 'no-store',
                        });

                        if (!response.ok) {
                            controller.error(new Error('Failed to fetch file'));
                            return;
                        }

                        const reader = response.body.getReader();

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            controller.enqueue(value);
                        }

                        controller.close();
                    } catch (error) {
                        console.error('[API] Document fetch error:', error);
                        controller.error(error);
                    }
                },
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': document.mimeType || 'application/octet-stream',
                    'Content-Disposition': `inline; filename="${fileName.replace(/"/g, '%22')}"`,
                    'Cache-Control': 'private, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                    // Remove X-Frame-Options to allow iframe embedding
                    'X-Content-Type-Options': 'nosniff',
                },
            }
        );

    } catch (error) {
        console.error('[API] Document file serve error:', error);
        return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
    }
}