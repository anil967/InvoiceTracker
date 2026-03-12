/**
 * Simulates an IDP (OCR) service for invoice data extraction.
 * ESM Version for Next.js.
 */
export const extractInvoiceData = async (fileBuffer) => {
    // Phase 2: Manual Entry Mode (User has no OCR keys)

    // In a real implementation with keys, we would call Azure/AWS here.
    // For now, we simulate a successful "upload" but with empty data requiring manual entry.

    // Simulate processing time (reduced for snappier feel)
    await new Promise(resolve => setTimeout(resolve, 300));

    // For Demo: Detect PO number from filename or just default to a known one if it's a test upload
    // In a real system, AWS Textract/Azure Form Recognizer would return this.
    const isExcel = fileBuffer.toString('hex', 0, 4) === '504b0304'; // Simple check for docx/xlsx (ZIP header)
    const isCsv = !isExcel && fileBuffer.toString().includes(','); // Extremely naive CSV check

    // Default extraction (High confidence for demo if we can guess the PO)
    return {
        invoiceNumber: `INV-${Math.floor(Math.random() * 100000)}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        vendorName: "Acme solutions",
        totalAmount: 50000.00,
        currency: "INR",
        poNumber: "PO-2026-001",
        lineItems: [
            { description: 'Cloud infrastructure - Feb', quantity: 1, unitPrice: 45000.00, total: 45000.00 },
            { description: 'Setup Fee', quantity: 1, unitPrice: 5000.00, total: 5000.00 }
        ],
        confidence: 0.98,
        costCenter: "CC-101",
        accountCode: "GL-5000",
        status: "DIGITIZED",
        extractionMethod: isExcel ? "EXCEL_PARSED" : (isCsv ? "CSV_PARSED" : "AI_EXTRACTED")
    };
};
