import { extractInvoiceData } from './services/idp';
import { performThreeWayMatch } from './services/matching';

/**
 * Enterprise Processing Utility for serverless environment.
 */
export const processInvoice = async (invoiceId, fileBuffer) => {
    console.log(`[Processor] Processing invoice ${invoiceId}...`);

    try {
        const extractedData = await extractInvoiceData(fileBuffer);

        // Data Validation
        const validationResults = validateExtractedData(extractedData);

        // Phase 2: Handling Manual Entry Flow
        if (extractedData.extractionMethod === "MANUAL_ENTRY_REQUIRED") {
            return {
                success: true,
                data: extractedData,
                validation: {
                    ...validationResults,
                    isValid: false, // Forces review
                    errors: ["Manual digitization required"]
                },
                matching: { isMatched: false, discrepancies: [] }, // No matching yet
                status: 'DIGITIZING' // New status for the queue
            };
        }

        // 3-Way Matching (Only if data exists)
        if (!extractedData.poNumber) {
            // extractedData.poNumber = "PO-2026-001"; // REMOVED MOCK DEFAULT
        }

        const matchingResults = await performThreeWayMatch(extractedData);

        return {
            success: true,
            data: extractedData,
            validation: validationResults,
            matching: matchingResults
        };

    } catch (error) {
        console.error(`[Processor] Failed to process ${invoiceId}:`, error);
        return { success: false, error: error.message };
    }
};

const validateExtractedData = (data) => {
    const errors = [];
    const warnings = [];

    if (!data.invoiceNumber) errors.push("Missing Invoice Number");
    if (!data.vendorName) errors.push("Missing Vendor Name");
    if (!data.totalAmount || data.totalAmount <= 0) errors.push("Invalid or missing Total Amount");
    if (!data.invoiceDate) errors.push("Missing Invoice Date");

    if (!data.costCenter) {
        warnings.push("Cost Center not assigned");
    } else if (!/^CC-\d{3}/.test(data.costCenter)) {
        errors.push(`Invalid Cost Center format: ${data.costCenter}`);
    }

    if (!data.accountCode) {
        warnings.push("General Ledger account not assigned");
    } else if (!/^GL-\d{4}/.test(data.accountCode)) {
        errors.push(`Invalid Account Code format: ${data.accountCode}`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};
