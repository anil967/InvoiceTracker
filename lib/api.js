const API_BASE_URL = typeof window !== 'undefined' ? '' : 'http://localhost:3000';

export const ingestInvoice = async (file, additionalData = {}, additionalFiles = {}) => {
    const formData = new FormData();
    formData.append('file', file);

    // Append any additional metadata (e.g., projectId, assignedPM, invoiceDate, basicAmount, taxType, hsnCode)
    Object.keys(additionalData).forEach(key => {
        if (additionalData[key]) {
            formData.append(key, additionalData[key]);
        }
    });

    // Append additional document files (RFP, Commercial/Timesheet)
    if (additionalFiles.rfpFile) {
        formData.append('rfpFile', additionalFiles.rfpFile);
    }
    if (additionalFiles.timesheetFile) {
        formData.append('timesheetFile', additionalFiles.timesheetFile);
    }

    const response = await fetch(`${API_BASE_URL}/api/ingest`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Send session cookie so server can identify vendor (RBAC)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to ingest invoice');
    }

    return response.json();
};


export const getAllInvoices = async (filters = {}) => {
    try {
        const params = new URLSearchParams({
            _t: Date.now(),
            ...filters
        });

        const response = await fetch(`${API_BASE_URL}/api/invoices?${params.toString()}`, {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        });
        if (!response.ok) {
            if (response.status === 401) throw new Error('Unauthorized');
            return [];
        }
        return response.json();
    } catch (e) {
        // Network error (Failed to fetch), CORS, or server unreachable — don't break the UI
        const isNetworkError = e?.name === 'TypeError' || e?.message === 'Failed to fetch';
        if (isNetworkError) {
            console.warn('getAllInvoices: network unavailable, returning empty list');
            return [];
        }
        console.warn('getAllInvoices failed:', e?.message || e);
        throw e;
    }
};

export const transitionWorkflow = async (id, action, comments = "") => {
    const response = await fetch(`${API_BASE_URL}/api/invoices/${id}/workflow`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, comments }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transition workflow');
    }
    return response.json();
};

export const getInvoiceStatus = async (id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/invoices/${id}`);
        if (response.status === 404) return null;
        if (!response.ok) {
            throw new Error('Failed to fetch invoice status');
        }
        return response.json();
    } catch (e) {
        console.error("API Error: getInvoiceStatus", e);
        throw e;
    }
};

export const updateInvoiceApi = async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update invoice');
    }
    return response.json();
};

export const getAnalytics = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/metrics`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) {
            // If 404/403/500, log specific warning but return empty structure
            console.warn(`getAnalytics failed with status ${response.status}`);
            return { metrics: {}, volumeOverTime: [], statusCounts: {}, categoryVolume: {} };
        }
        return response.json();
    } catch (e) {
        console.error("getAnalytics API call failed", e);
        // Return matching structure so UI doesn't crash on undefined properties
        return { metrics: {}, volumeOverTime: [], statusCounts: {}, categoryVolume: {} };
    }
};

export const getAuditLogs = async (invoiceId) => {
    const query = invoiceId ? `?invoiceId=${invoiceId}` : '';
    const response = await fetch(`${API_BASE_URL}/api/audit${query}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
        console.warn("Failed to fetch audit logs");
        return [];
    }
    return response.json();
};

/**
 * Fetch email/notification log for an invoice (or all if admin).
 * @param {string|null} relatedEntityId - Invoice ID, or null for admin global list
 */
export const getNotifications = async (relatedEntityId = null) => {
    const query = relatedEntityId ? `?relatedEntityId=${encodeURIComponent(relatedEntityId)}` : '';
    const response = await fetch(`${API_BASE_URL}/api/notifications${query}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
        console.warn("Failed to fetch notifications");
        return [];
    }
    return response.json();
};

/**
 * Upload a PM document (Ringi, Annex, Timesheet, Rate Card)
 * @param {File} file - The file to upload
 * @param {Object} metadata - Document metadata
 * @returns {Promise<Object>} Upload result with validation info
 */
export const uploadPMDocument = async (file, metadata = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', metadata.type || 'RINGI');

    if (metadata.projectId) formData.append('projectId', metadata.projectId);
    if (metadata.invoiceId) formData.append('invoiceId', metadata.invoiceId);
    if (metadata.billingMonth) formData.append('billingMonth', metadata.billingMonth);
    if (metadata.ringiNumber) formData.append('ringiNumber', metadata.ringiNumber);
    if (metadata.projectName) formData.append('projectName', metadata.projectName);
    if (metadata.vendorId) formData.append('vendorId', metadata.vendorId);
    if (metadata.description) formData.append('description', metadata.description);

    const response = await fetch(`${API_BASE_URL}/api/pm/documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload document');
    }

    return response.json();
};

/**
 * Get PM documents with optional filters
 * @param {Object} filters - Filter options (type, projectId, status)
 * @returns {Promise<Object>} Documents list
 */
export const getPMDocuments = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.projectId) params.append('projectId', filters.projectId);
    if (filters.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/api/pm/documents?${params.toString()}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch documents');
    }

    return response.json();
};

/**
 * Delete a PM document
 * @param {string} documentId - Document ID to delete
 * @returns {Promise<Object>} Delete result
 */
export const deletePMDocument = async (documentId) => {
    const response = await fetch(`${API_BASE_URL}/api/pm/documents?id=${documentId}`, {
        method: 'DELETE',
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete document');
    }

    return response.json();
};

/**
 * Get rate cards (Admin only)
 * @param {Object} filters - Filter options (vendorId, status)
 * @returns {Promise<Object>} Rate cards list
 */
export const getRateCards = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.vendorId) params.append('vendorId', filters.vendorId);
    if (filters.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/api/finance/ratecards?${params.toString()}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch rate cards');
    }

    return response.json();
};

/**
 * Create a new rate card (Admin only)
 * @param {Object} rateCardData - Rate card data
 * @returns {Promise<Object>} Created rate card
 */
export const createRateCard = async (rateCardData) => {
    const response = await fetch(`${API_BASE_URL}/api/admin/ratecards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rateCardData),
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create rate card');
    }

    return response.json();
};



/**
 * Fetch Admin dashboard data with RBAC-filtered invoices and admin-specific statistics
 * @returns {Promise<Object>} Object containing stats and filtered invoices for Admin role
 */
export const getAdminDashboardData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) {
            if (response.status === 401) throw new Error('Unauthorized');
            if (response.status === 403) throw new Error('Forbidden: Admin access required');
            throw new Error('Failed to fetch admin dashboard data');
        }
        return response.json();
    } catch (e) {
        console.error('getAdminDashboardData failed:', e?.message || e);
        throw e;
    }
};

/**
 * Fetch Vendor dashboard data with RBAC-filtered invoices (only vendor's own invoices)
 * @returns {Promise<Object>} Object containing stats and filtered invoices for Vendor role
 */
export const getVendorDashboardData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/vendors/dashboard`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) {
            if (response.status === 401) throw new Error('Unauthorized');
            if (response.status === 403) throw new Error('Forbidden: Vendor access required');
            throw new Error('Failed to fetch vendor dashboard data');
        }
        return response.json();
    } catch (e) {
        console.error('getVendorDashboardData failed:', e?.message || e);
        throw e;
    }
};

/**
 * Fetch Finance dashboard data with RBAC-filtered invoices and finance-specific statistics
 * @returns {Promise<Object>} Object containing stats and filtered invoices for Finance role
 */
export const getFinanceDashboardData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/finance/dashboard`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) {
            if (response.status === 401) throw new Error('Unauthorized');
            if (response.status === 403) throw new Error('Forbidden: Finance access required');
            throw new Error('Failed to fetch finance dashboard data');
        }
        return response.json();
    } catch (e) {
        console.error('getFinanceDashboardData failed:', e?.message || e);
        throw e;
    }
};

/**
 * Fetch Project Manager dashboard data with RBAC-filtered invoices (only PM's assigned invoices)
 * @returns {Promise<Object>} Object containing stats and filtered invoices for PM role
 */
export const getPMDashboardData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/pm/dashboard`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) {
            if (response.status === 401) throw new Error('Unauthorized');
            if (response.status === 403) throw new Error('Forbidden: Project Manager access required');
            throw new Error('Failed to fetch PM dashboard data');
        }
        return response.json();
    } catch (e) {
        console.error('getPMDashboardData failed:', e?.message || e);
        throw e;
    }
};
