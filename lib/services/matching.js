import { getPurchaseOrder, getAnnexureByPO } from './erp';

/**
 * Performs a 3-way match: Invoice vs. Purchase Order vs. Ringi Annexure
 * ESM Version for Next.js.
 */
export const performThreeWayMatch = async (invoiceData) => {
    const { poNumber, totalAmount, vendorName, lineItems } = invoiceData;
    const results = {
        isMatched: false,
        discrepancies: [],
        poFound: false,
        annexureFound: false,
        toleranceApplied: false,
        matchDetails: []
    };

    if (!poNumber) {
        results.discrepancies.push("No PO Number provided.");
        return results;
    }

    const po = await getPurchaseOrder(poNumber);
    if (!po) {
        results.discrepancies.push(`PO ${poNumber} not found in system.`);
        return results;
    }
    results.poFound = true;
    results.matchDetails.push(`Matched with PO: ${po.po_number}`);

    const annexure = await getAnnexureByPO(poNumber);
    if (annexure) {
        results.annexureFound = true;
        results.matchDetails.push(`Linked Annexure: ${annexure.annexure_number}`);
    } else {
        // Annexure might not always be required, but if missing, we note it.
        // results.discrepancies.push(`Ringi Annexure for PO ${poNumber} not found.`);
    }

    // Vendor Match
    if (po.vendorName && vendorName && po.vendorName.toLowerCase().trim() !== vendorName.toLowerCase().trim()) {
        results.discrepancies.push(`Vendor mismatch: Invoice (${vendorName}) vs PO (${po.vendorName})`);
    }

    // Amount Match with 5% Tolerance (FR-4)
    const tolerance = 0.05;
    const invAmount = parseFloat(totalAmount) || 0;
    const poAmount = parseFloat(po.totalAmount) || 0;

    const diff = Math.abs(invAmount - poAmount);
    const maxAllowedDiff = poAmount * tolerance;

    if (diff > maxAllowedDiff) {
        results.discrepancies.push(`Total Amount mismatch: Invoice (${invAmount.toFixed(2)}) vs PO (${poAmount.toFixed(2)}). Diff: ${diff.toFixed(2)} exceeds ${tolerance * 100}% tolerance.`);
    } else if (diff > 0) {
        results.toleranceApplied = true;
        results.matchDetails.push(`Amount matched within ${tolerance * 100}% tolerance.`);
    }

    // Line Item Match (FR-4)
    if (lineItems && lineItems.length > 0 && po.items && po.items.length > 0) {
        results.matchDetails.push(`Comparing ${lineItems.length} invoice items against ${po.items.length} PO items.`);

        lineItems.forEach((invItem, index) => {
            const poItem = po.items.find(pi =>
                pi.description.toLowerCase().includes(invItem.description.toLowerCase()) ||
                invItem.description.toLowerCase().includes(pi.description.toLowerCase())
            );

            if (!poItem) {
                results.discrepancies.push(`Line Item not found in PO: ${invItem.description}`);
            } else {
                if (parseFloat(invItem.quantity) > parseFloat(poItem.quantity)) {
                    results.discrepancies.push(`Quantity mismatch for "${invItem.description}": Invoice (${invItem.quantity}) > PO (${poItem.quantity})`);
                }
                if (parseFloat(invItem.unitPrice) > parseFloat(poItem.unitPrice)) {
                    results.discrepancies.push(`Price mismatch for "${invItem.description}": Invoice (${invItem.unitPrice}) > PO (${poItem.unitPrice})`);
                }
            }
        });
    }

    // Annexure Limit Check (FR-4)
    if (annexure && annexure.approved_amount) {
        const approvedLimit = parseFloat(annexure.approved_amount);
        if (invAmount > approvedLimit) {
            results.isMatched = false; // Force mismatch
            results.discrepancies.push(`Ringi Violation: Invoice Amount (${invAmount.toFixed(2)}) exceeds Approved Annexure Limit (${approvedLimit.toFixed(2)}).`);
        } else {
            results.matchDetails.push(`Verified against Ringi Annexure limit: OK`);
        }
    } else if (results.annexureFound) {
        results.discrepancies.push("Ringi Annexure found but has no approved amount limit.");
    }

    results.isMatched = results.discrepancies.length === 0;
    return results;
};
