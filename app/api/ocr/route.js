import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server-auth';

export async function POST(request) {
    try {
        // Auth check
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Strict PDF-only validation
        const fileName = file.name?.toLowerCase() || '';
        if (!fileName.endsWith('.pdf') && file.type !== 'application/pdf') {
            return NextResponse.json(
                { error: 'Only PDF files are supported for OCR extraction.' },
                { status: 400 }
            );
        }

        // Convert the uploaded file to a Buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Use pdf-parse v2 to extract text from the PDF
        // Worker import MUST come before PDFParse import (required for Vercel/serverless)
        await import('pdf-parse/worker');
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        await parser.destroy();
        const fullText = pdfData.text || '';

        if (!fullText.trim()) {
            return NextResponse.json({
                success: true,
                data: {
                    invoiceNumber: null,
                    invoiceDate: null,
                    basicAmount: null,
                    totalAmount: null,
                    taxType: null,
                    hsnCode: null,
                },
                message: 'No text could be extracted from this PDF. It may be a scanned image.',
            });
        }

        // Extract fields from the text
        console.log('[OCR] Extracted text (first 2000 chars):', fullText.substring(0, 2000));
        const extracted = parseInvoiceText(fullText);
        console.log('[OCR] Parsed fields:', JSON.stringify(extracted));

        return NextResponse.json({
            success: true,
            data: extracted,
        });
    } catch (error) {
        console.error('[OCR] Extraction error:', error);
        return NextResponse.json(
            { error: 'OCR extraction failed. Please fill the fields manually.' },
            { status: 500 }
        );
    }
}

/**
 * Parse extracted PDF text and find invoice fields using regex.
 * Uses a line-by-line approach for table-layout PDFs where
 * labels and values appear on separate lines.
 * Returns null for any field that cannot be found.
 */
function parseInvoiceText(text) {
    const result = {
        invoiceNumber: null,
        invoiceDate: null,
        basicAmount: null,
        totalAmount: null,
        taxType: null,
        hsnCode: null,
    };

    // Normalize text
    const normalizedText = text.replace(/\r\n/g, '\n');
    const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);

    try {
        // ---- Invoice Number ----
        const invNumPatterns = [
            /(?:invoice\s*(?:no|number|#|num|id))[\s.:/-]*\s*([A-Z0-9][\w\-\/]{1,25})/i,
            /(?:inv[\s.:/-]*(?:no|num|#)?)[\s.:/-]*\s*([A-Z0-9][\w\-\/]{1,25})/i,
            /(?:bill\s*(?:no|number|#))[\s.:/-]*\s*([A-Z0-9][\w\-\/]{1,25})/i,
            /(?:voucher\s*(?:no|number))[\s.:/-]*\s*([A-Z0-9][\w\-\/]{1,25})/i,
        ];
        for (const pat of invNumPatterns) {
            const m = normalizedText.match(pat);
            if (m?.[1]) {
                result.invoiceNumber = m[1].trim();
                break;
            }
        }

        // ---- Invoice Date ----
        // Handles: "Invoice Date: 15-Feb-2026", "Date: 01/02/2026", "Dated: 15 January 2026"
        const datePatterns = [
            // DD-Mon-YYYY or DD Mon YYYY (e.g. 15-Feb-2026, 15 Feb 2026)
            /(?:invoice\s*date|inv\.?\s*date|date\s*of\s*invoice|billing\s*date|bill\s*date|dated)[\s.:/-]*\s*(\d{1,2}[\s./-]*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s.,/-]*\d{2,4})/i,
            // Mon DD, YYYY (e.g. February 15, 2026)
            /(?:invoice\s*date|inv\.?\s*date|date\s*of\s*invoice|billing\s*date|bill\s*date|dated)[\s.:/-]*\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s./-]*\d{1,2}[\s,]*\d{2,4})/i,
            // DD/MM/YYYY or DD-MM-YYYY
            /(?:invoice\s*date|inv\.?\s*date|date\s*of\s*invoice|billing\s*date|bill\s*date|dated)[\s.:/-]*\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
            // Generic "date" with DD/MM/YYYY
            /(?:date)[\s.:/-]*\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
            // Generic "date" with DD-Mon-YYYY
            /(?:date)[\s.:/-]*\s*(\d{1,2}[\s./-]*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s.,/-]*\d{2,4})/i,
        ];
        for (const pat of datePatterns) {
            const m = normalizedText.match(pat);
            if (m?.[1]) {
                result.invoiceDate = normalizeDate(m[1].trim());
                if (result.invoiceDate) break;
            }
        }

        // ---- Total Amount (using line-by-line, pick LARGEST near label) ----
        result.totalAmount = findLargestAmountNearLabel(lines, /grand\s*total/i)
            ?? findLargestAmountNearLabel(lines, /total\s*amount/i)
            ?? findLargestAmountNearLabel(lines, /amount\s*payable/i)
            ?? findLargestAmountNearLabel(lines, /net\s*payable/i)
            ?? findLargestAmountNearLabel(lines, /invoice\s*total/i)
            ?? findLargestAmountNearLabel(lines, /bill\s*amount/i);

        // ---- Basic Amount (using line-by-line, pick FIRST near label) ----
        result.basicAmount = findAmountNearLabel(lines, /total\s*basic\s*amount/i)
            ?? findAmountNearLabel(lines, /basic\s*amount/i)
            ?? findAmountNearLabel(lines, /sub\s*total/i)
            ?? findAmountNearLabel(lines, /taxable\s*(?:value|amount)/i)
            ?? findAmountNearLabel(lines, /net\s*amount/i)
            ?? findAmountNearLabel(lines, /assessable\s*value/i);

        // ---- Tax Type ----
        if (/\bigst\b/i.test(normalizedText)) {
            result.taxType = 'IGST';
        } else if (/\bcgst\b|\bsgst\b/i.test(normalizedText)) {
            result.taxType = 'CGST_SGST';
        } else if (/\bgst\b/i.test(normalizedText)) {
            result.taxType = 'CGST_SGST';
        } else if (/\bvat\b/i.test(normalizedText)) {
            result.taxType = 'VAT';
        }

        // ---- HSN / SAC Code (using line-by-line for table layouts) ----
        result.hsnCode = findHsnNearLabel(lines);

    } catch (e) {
        console.error('[OCR] Parse error:', e);
    }

    return result;
}

/**
 * Find a monetary amount near a label in table-layout PDFs.
 * Searches the same line first, then the next few lines for a number.
 * Returns the FIRST valid amount found.
 */
function findAmountNearLabel(lines, labelPattern) {
    for (let i = 0; i < lines.length; i++) {
        if (!labelPattern.test(lines[i])) continue;

        // 1) Check if the amount is on the SAME line after the label
        const sameLineMatch = lines[i].match(
            /(?:[\s.:₹$Rs]*)([0-9,]+\.?\d{0,2})\s*$/
        );
        if (sameLineMatch) {
            const val = parseFloat(sameLineMatch[1].replace(/,/g, ''));
            if (val >= 1) return val;
        }

        // 2) Check the next few lines for a standalone number
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const line = lines[j].trim();
            // Match a line that is primarily a number (with optional currency symbol)
            const nextMatch = line.match(/^[₹$Rs.\s]*([0-9,]+\.?\d{0,2})\s*$/);
            if (nextMatch) {
                const val = parseFloat(nextMatch[1].replace(/,/g, ''));
                if (val >= 1) return val;
            }
        }
    }
    return null;
}

/**
 * Find the LARGEST monetary amount near a label.
 * Used for Grand Total / Total Amount where the biggest number is correct.
 * In table-layout PDFs, multiple amounts may appear near the label.
 */
function findLargestAmountNearLabel(lines, labelPattern) {
    for (let i = 0; i < lines.length; i++) {
        if (!labelPattern.test(lines[i])) continue;

        let largest = null;

        // 1) Check same line
        const sameLineMatch = lines[i].match(
            /(?:[\s.:₹$Rs]*)([0-9,]+\.?\d{0,2})\s*$/
        );
        if (sameLineMatch) {
            const val = parseFloat(sameLineMatch[1].replace(/,/g, ''));
            if (val >= 1 && (largest === null || val > largest)) largest = val;
        }

        // 2) Check next several lines and pick the largest number
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
            const line = lines[j].trim();
            const nextMatch = line.match(/^[₹$Rs.\s]*([0-9,]+\.?\d{0,2})\s*$/);
            if (nextMatch) {
                const val = parseFloat(nextMatch[1].replace(/,/g, ''));
                if (val >= 1 && (largest === null || val > largest)) largest = val;
            }
        }

        if (largest !== null) return largest;
    }
    return null;
}

/**
 * Find HSN/SAC codes near "HSN" or "SAC" labels, handling table layouts.
 * Returns the first valid HSN code found (4-8 digits).
 */
function findHsnNearLabel(lines) {
    for (let i = 0; i < lines.length; i++) {
        if (!/\bhsn\b|\bsac\b/i.test(lines[i])) continue;

        // 1) Same line: "HSN Code 998314" or has digits on it
        const sameLine = lines[i].match(/(\d{4,8})/);
        if (sameLine) return sameLine[1];

        // 2) Check next 15 lines for HSN code values (table headers can be far from data)
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            const code = lines[j].trim().match(/^(\d{4,8})$/);
            if (code) return code[1];
        }
    }
    return null;
}

/**
 * Normalize various date formats to YYYY-MM-DD for HTML date input.
 */
function normalizeDate(dateStr) {
    if (!dateStr) return null;

    const months = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        january: '01', february: '02', march: '03', april: '04',
        june: '06', july: '07', august: '08', september: '09',
        october: '10', november: '11', december: '12',
    };

    try {
        // DD-Mon-YYYY or DD Mon YYYY (e.g. 15-Feb-2026, 15 Feb 2026)
        let m = dateStr.match(/^(\d{1,2})[\s./-]*([a-z]+)[\s.,/-]*(\d{2,4})$/i);
        if (m) {
            const mon = months[m[2].toLowerCase()];
            if (mon) {
                const year = m[3].length === 2
                    ? (parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`)
                    : m[3];
                return `${year}-${mon}-${m[1].padStart(2, '0')}`;
            }
        }

        // Mon DD, YYYY (e.g. February 15, 2026)
        m = dateStr.match(/^([a-z]+)[\s./-]*(\d{1,2})[\s,]*(\d{2,4})$/i);
        if (m) {
            const mon = months[m[1].toLowerCase()];
            if (mon) {
                const year = m[3].length === 2
                    ? (parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`)
                    : m[3];
                return `${year}-${mon}-${m[2].padStart(2, '0')}`;
            }
        }

        // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        m = dateStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
        if (m) {
            return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        }

        // DD/MM/YY
        m = dateStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/);
        if (m) {
            const year = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
            return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        }

        // Fallback: try JS Date parser
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    } catch {
        // ignore parse errors
    }

    return null;
}
