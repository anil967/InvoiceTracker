import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const invoice = await db.getInvoice(id);

        if (!invoice || !invoice.fileUrl) {
            return NextResponse.json({ error: 'Invoice or file not found' }, { status: 404 });
        }

        const fileUrl = invoice.fileUrl;
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

        // Convert to JSON (array of arrays or array of objects)
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        // Limit results for preview (e.g., first 100 rows)
        const previewData = data.slice(0, 100);

        return NextResponse.json({
            data: previewData,
            totalRows: data.length,
            sheetName: firstSheetName
        });

    } catch (err) {
        console.error('[API] Spreadsheet preview error:', err);
        return NextResponse.json({ error: 'Failed to parse spreadsheet' }, { status: 500 });
    }
}
