/**
 * ERP Integration Service
 * Simulates connection to SAP and Ringi Portal for 3-way matching data.
 * In a real environment, these would be REST/SOAP API calls.
 */

export const integration = {
    /**
     * Fetch Purchase Order from SAP
     * @param {string} poNumber 
     * @returns {Promise<Object|null>}
     */
    fetchPurchaseOrder: async (poNumber) => {
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!poNumber) return null;

        // Mock Data Generation based on PO Number
        // In real app: axios.get(`https://sap-gateway.internal/po/${poNumber}`)
        return {
            id: poNumber,
            date: "2026-02-01",
            vendorId: "V-1001",
            currency: "INR",
            items: [
                {
                    line: 10,
                    description: "High-Performance Server Blade",
                    quantity: 2,
                    unitPrice: 2500.00,
                    uom: "EA"
                },
                {
                    line: 20,
                    description: "Network Switch 48-Port",
                    quantity: 1,
                    unitPrice: 1200.00,
                    uom: "EA"
                }
            ],
            totalAmount: 6200.00,
            status: "RELEASED"
        };
    },

    /**
     * Fetch Goods Receipt from SAP/WMS
     * @param {string} poNumber 
     * @returns {Promise<Object|null>}
     */
    fetchGoodsReceipt: async (poNumber) => {
        await new Promise(resolve => setTimeout(resolve, 400));

        if (!poNumber) return null;

        // Mock GR Data
        // In real app: axios.get(`https://sap-gateway.internal/gr?po=${poNumber}`)
        return {
            id: `GR-${poNumber.split('-')[1] || '999'}`,
            date: "2026-02-03",
            receivedBy: "Warehouse A",
            items: [
                {
                    line: 10,
                    quantity: 2, // Full receipt
                    accepted: 2,
                    rejected: 0
                },
                {
                    line: 20,
                    quantity: 1, // Full receipt
                    accepted: 1,
                    rejected: 0
                }
            ]
        };
    }
};
