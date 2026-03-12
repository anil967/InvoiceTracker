/**
 * ERP Integration Service
 * Fetches real data from the Purchase Orders and Annexures tables.
 */
import { db } from '@/lib/db';

export const getPurchaseOrder = async (poNumber) => {
    // Phase 3: Real Database Query
    return await db.getPurchaseOrder(poNumber);
};

export const getAnnexureByPO = async (poNumber) => {
    // We need PO ID to find annexure, but if input is PO number, we might need a lookup.
    // However, our db.getAnnexureByPO expects poId, or we can query by poNumber if we adjust.
    // Let's first get the PO to get its ID.
    const po = await db.getPurchaseOrder(poNumber);
    if (!po) return null;

    return await db.getAnnexureByPO(po.id);
};
