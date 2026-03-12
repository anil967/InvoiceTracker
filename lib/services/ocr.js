/**
 * OCR and Document Parsing Service
 * Supports PDF, Excel, Word document parsing with OCR capabilities
 */

import * as XLSX from 'xlsx';

/**
 * Parse Excel file and extract data
 * @param {Buffer} buffer - File buffer
 * @returns {Object} Parsed data with sheets and cells
 */
export const parseExcelFile = async (buffer) => {
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const result = {
            sheets: [],
            rawData: {}
        };

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            result.sheets.push(sheetName);
            result.rawData[sheetName] = jsonData;
        }

        return {
            success: true,
            data: result
        };
    } catch (error) {
        console.error('[OCR] Excel parsing error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Extract timesheet data from Excel file
 * Expected format: Employee Name, Date, Project, Hours, Description
 * @param {Buffer} buffer - File buffer
 * @returns {Object} Extracted timesheet data
 */
export const extractTimesheetFromExcel = async (buffer) => {
    const parseResult = await parseExcelFile(buffer);
    if (!parseResult.success) {
        return parseResult;
    }

    const data = parseResult.data;
    const firstSheet = data.sheets[0];
    const rows = data.rawData[firstSheet] || [];

    // Try to detect header row
    const headerRowIndex = findHeaderRow(rows, ['date', 'hours', 'project', 'employee', 'name']);

    if (headerRowIndex === -1) {
        return {
            success: false,
            error: 'Could not detect timesheet header row',
            rawData: rows.slice(0, 10)
        };
    }

    const headers = rows[headerRowIndex].map(h => String(h).toLowerCase().trim());
    const dataRows = rows.slice(headerRowIndex + 1).filter(row => row.length > 0);

    // Map columns
    const colMap = {
        employee: findColumnIndex(headers, ['employee', 'name', 'resource']),
        date: findColumnIndex(headers, ['date', 'day']),
        project: findColumnIndex(headers, ['project', 'task', 'assignment']),
        hours: findColumnIndex(headers, ['hours', 'hrs', 'time']),
        description: findColumnIndex(headers, ['description', 'desc', 'notes', 'comments'])
    };

    const entries = [];
    let totalHours = 0;
    const validationErrors = [];

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const entry = {
            employee: colMap.employee !== -1 ? row[colMap.employee] : null,
            date: colMap.date !== -1 ? parseDate(row[colMap.date]) : null,
            project: colMap.project !== -1 ? row[colMap.project] : null,
            hours: colMap.hours !== -1 ? parseFloat(row[colMap.hours]) || 0 : 0,
            description: colMap.description !== -1 ? row[colMap.description] : null,
            rowIndex: i + headerRowIndex + 2 // 1-indexed for user display
        };

        // Validate entry
        if (!entry.date) {
            validationErrors.push(`Row ${entry.rowIndex}: Invalid or missing date`);
        }
        if (entry.hours <= 0 && row.some(cell => cell !== null && cell !== '')) {
            validationErrors.push(`Row ${entry.rowIndex}: Invalid hours value`);
        }
        if (entry.hours > 24) {
            validationErrors.push(`Row ${entry.rowIndex}: Hours exceed 24 (${entry.hours})`);
        }

        if (entry.hours > 0) {
            totalHours += entry.hours;
            entries.push(entry);
        }
    }

    return {
        success: true,
        data: {
            entries,
            totalHours,
            totalEntries: entries.length,
            employees: [...new Set(entries.map(e => e.employee).filter(Boolean))],
            projects: [...new Set(entries.map(e => e.project).filter(Boolean))],
            dateRange: getDateRange(entries.map(e => e.date).filter(Boolean))
        },
        validation: {
            isValid: validationErrors.length === 0,
            errors: validationErrors,
            warnings: totalHours > 200 ? ['Total hours exceed 200 - please verify'] : []
        }
    };
};

/**
 * Extract rate card data from Excel file
 * Expected format: Description, Unit, Rate, Currency
 * @param {Buffer} buffer - File buffer
 * @returns {Object} Extracted rate card data
 */
export const extractRateCardFromExcel = async (buffer) => {
    const parseResult = await parseExcelFile(buffer);
    if (!parseResult.success) {
        return parseResult;
    }

    const data = parseResult.data;
    const firstSheet = data.sheets[0];
    const rows = data.rawData[firstSheet] || [];

    const headerRowIndex = findHeaderRow(rows, ['description', 'rate', 'unit', 'price']);

    if (headerRowIndex === -1) {
        return {
            success: false,
            error: 'Could not detect rate card header row',
            rawData: rows.slice(0, 10)
        };
    }

    const headers = rows[headerRowIndex].map(h => String(h).toLowerCase().trim());
    const dataRows = rows.slice(headerRowIndex + 1).filter(row => row.length > 0);

    const colMap = {
        description: findColumnIndex(headers, ['description', 'item', 'service', 'role']),
        unit: findColumnIndex(headers, ['unit', 'type', 'billing']),
        rate: findColumnIndex(headers, ['rate', 'price', 'amount', 'cost']),
        currency: findColumnIndex(headers, ['currency', 'curr'])
    };

    const rates = [];
    const validationErrors = [];

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rateItem = {
            description: colMap.description !== -1 ? row[colMap.description] : null,
            unit: colMap.unit !== -1 ? normalizeUnit(row[colMap.unit]) : 'HOUR',
            rate: colMap.rate !== -1 ? parseFloat(row[colMap.rate]) || 0 : 0,
            currency: colMap.currency !== -1 ? row[colMap.currency] || 'INR' : 'INR',
            rowIndex: i + headerRowIndex + 2
        };

        if (!rateItem.description) {
            validationErrors.push(`Row ${rateItem.rowIndex}: Missing description`);
            continue;
        }
        if (rateItem.rate <= 0) {
            validationErrors.push(`Row ${rateItem.rowIndex}: Invalid rate value`);
            continue;
        }

        rates.push(rateItem);
    }

    return {
        success: true,
        data: { rates },
        validation: {
            isValid: validationErrors.length === 0 && rates.length > 0,
            errors: validationErrors,
            rateCount: rates.length
        }
    };
};

/**
 * Detect document type from file extension and content
 * @param {string} fileName - Original file name
 * @param {string} mimeType - MIME type
 * @returns {Object} Document type info
 */
export const detectDocumentType = (fileName, mimeType) => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    const typeMap = {
        'pdf': { category: 'document', format: 'PDF', supportsOCR: true },
        'doc': { category: 'document', format: 'DOC', supportsOCR: false },
        'docx': { category: 'document', format: 'DOCX', supportsOCR: false },
        'xls': { category: 'spreadsheet', format: 'XLS', supportsOCR: false },
        'xlsx': { category: 'spreadsheet', format: 'XLSX', supportsOCR: false },
        'jpg': { category: 'image', format: 'JPEG', supportsOCR: true },
        'jpeg': { category: 'image', format: 'JPEG', supportsOCR: true },
        'png': { category: 'image', format: 'PNG', supportsOCR: true }
    };

    return typeMap[ext] || { category: 'unknown', format: ext?.toUpperCase(), supportsOCR: false };
};

/**
 * Get allowed file extensions for document type
 * @param {string} docType - Document type (RINGI, ANNEX, TIMESHEET, RATE_CARD)
 * @returns {string[]} Allowed extensions
 */
export const getAllowedExtensions = (docType) => {
    const allowedMap = {
        'RINGI': ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
        'ANNEX': ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
        'TIMESHEET': ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
        'RATE_CARD': ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
        'INVOICE': ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
        'RFP_COMMERCIAL': ['pdf', 'doc', 'docx', 'xls', 'xlsx']
    };
    return allowedMap[docType] || [];
};

/**
 * Validate file type against document type
 * @param {string} fileName - File name
 * @param {string} docType - Document type
 * @returns {Object} Validation result
 */
export const validateFileType = (fileName, docType) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const allowed = getAllowedExtensions(docType);

    if (allowed.length === 0) {
        return { valid: false, error: 'Unknown document type' };
    }

    if (!allowed.includes(ext)) {
        return {
            valid: false,
            error: `Invalid file type for ${docType}. Allowed: ${allowed.join(', ')}`
        };
    }

    return { valid: true };
};

// Helper functions
function findHeaderRow(rows, keywords) {
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (!row) continue;
        const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
        const matches = keywords.filter(kw => rowStr.includes(kw)).length;
        if (matches >= 2) return i;
    }
    return -1;
}

function findColumnIndex(headers, keywords) {
    for (let i = 0; i < headers.length; i++) {
        for (const kw of keywords) {
            if (headers[i].includes(kw)) return i;
        }
    }
    return -1;
}

function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value === 'number') {
        // Excel serial date
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}

function getDateRange(dates) {
    if (!dates || dates.length === 0) return { start: null, end: null };
    const sorted = dates.sort();
    return { start: sorted[0], end: sorted[sorted.length - 1] };
}

function normalizeUnit(unit) {
    const str = String(unit || '').toLowerCase().trim();
    if (str.includes('hour') || str === 'hr' || str === 'hrs') return 'HOUR';
    if (str.includes('day') || str === 'd') return 'DAY';
    if (str.includes('month')) return 'MONTHLY';
    if (str.includes('fix')) return 'FIXED';
    return 'HOUR';
}
