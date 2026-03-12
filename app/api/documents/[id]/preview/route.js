import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { DocumentUpload } from '@/models/Internal';
import path from 'path';
import fs from 'fs/promises';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

/**
 * GET /api/documents/[id]/preview
 * Returns parsed spreadsheet data (CSV/XLS/XLSX) as JSON for preview.
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;

        await connectDB();
        const document = await DocumentUpload.findOne({ id });

        if (!document || !document.fileUrl) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const fileUrl = document.fileUrl;
        let buffer;

        if (fileUrl.startsWith('data:')) {
            const match = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (!match) {
                return NextResponse.json({ error: 'Invalid file data' }, { status: 400 });
            }
            buffer = Buffer.from(match[2], 'base64');
        } else if (fileUrl.startsWith('/')) {
            const filePath = path.join(process.cwd(), fileUrl.replace(/^\//, ''));
            buffer = await fs.readFile(filePath);
        } else {
            return NextResponse.json({ error: 'Unsupported file reference' }, { status: 400 });
        }

        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        const previewData = data.slice(0, 100);

        return NextResponse.json({
            data: previewData,
            totalRows: data.length,
            sheetName: firstSheetName
        });

    } catch (err) {
        console.error('[API] Document spreadsheet preview error:', err);
        return NextResponse.json({ error: 'Failed to parse spreadsheet' }, { status: 500 });
    }
}
