/**
 * Document Validation Service
 * Validates timesheets and rate cards against business rules
 */

import { extractTimesheetFromExcel, extractRateCardFromExcel } from './ocr';
import { RateCard } from '@/models/Admin';
import connectToDatabase from '@/lib/mongodb';

/**
 * Validate timesheet document
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateTimesheet = async (buffer, options = {}) => {
    const { vendorId, projectId } = options;

    // Extract timesheet data
    const extraction = await extractTimesheetFromExcel(buffer);

    if (!extraction.success) {
        return {
            isValid: false,
            errors: [extraction.error],
            warnings: [],
            data: null
        };
    }

    const errors = [...(extraction.validation.errors || [])];
    const warnings = [...(extraction.validation.warnings || [])];

    // Business rule validations
    const { data } = extraction;

    // Check for reasonable date range (not too old)
    if (data.dateRange.start) {
        const startDate = new Date(data.dateRange.start);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        if (startDate < threeMonthsAgo) {
            warnings.push(`Timesheet contains dates older than 3 months (${data.dateRange.start})`);
        }
    }

    // Check for duplicate entries (same employee, date, project)
    const entryKeys = new Set();
    for (const entry of data.entries) {
        const key = `${entry.employee}-${entry.date}-${entry.project}`;
        if (entryKeys.has(key)) {
            warnings.push(`Potential duplicate entry for ${entry.employee} on ${entry.date}`);
        }
        entryKeys.add(key);
    }

    // Cross-check with rate card if vendor is provided
    if (vendorId && data.totalHours > 0) {
        try {
            const rateCheckResult = await crossCheckWithRateCard(vendorId, projectId, data);
            if (rateCheckResult.warnings) {
                warnings.push(...rateCheckResult.warnings);
            }
            if (rateCheckResult.estimatedAmount) {
                data.estimatedAmount = rateCheckResult.estimatedAmount;
            }
        } catch (error) {
            console.warn('[Validation] Rate card cross-check failed:', error);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        data: {
            ...data,
            summary: {
                totalHours: data.totalHours,
                totalEntries: data.totalEntries,
                employees: data.employees.length,
                projects: data.projects.length,
                dateRange: data.dateRange
            }
        }
    };
};

/**
 * Validate rate card document
 * @param {Buffer} buffer - File buffer
 * @returns {Object} Validation result
 */
export const validateRateCard = async (buffer) => {
    const extraction = await extractRateCardFromExcel(buffer);

    if (!extraction.success) {
        return {
            isValid: false,
            errors: [extraction.error],
            warnings: [],
            data: null
        };
    }

    const errors = [...(extraction.validation.errors || [])];
    const warnings = [];

    const { rates } = extraction.data;

    // Check for unreasonable rates
    for (const rate of rates) {
        if (rate.rate > 50000 && rate.unit === 'HOUR') {
            warnings.push(`Rate for "${rate.description}" seems unusually high (${rate.rate}/hour)`);
        }
        if (rate.rate < 100 && rate.unit === 'DAY') {
            warnings.push(`Rate for "${rate.description}" seems unusually low (${rate.rate}/day)`);
        }
    }

    // Check for duplicate descriptions
    const descriptions = new Set();
    for (const rate of rates) {
        const desc = rate.description?.toLowerCase().trim();
        if (descriptions.has(desc)) {
            warnings.push(`Duplicate rate entry: "${rate.description}"`);
        }
        descriptions.add(desc);
    }

    return {
        isValid: errors.length === 0 && rates.length > 0,
        errors: rates.length === 0 && errors.length === 0
            ? ['No valid rate entries found']
            : errors,
        warnings,
        data: {
            rates,
            summary: {
                totalRates: rates.length,
                units: [...new Set(rates.map(r => r.unit))],
                currencies: [...new Set(rates.map(r => r.currency))]
            }
        }
    };
};

/**
 * Cross-check timesheet hours against vendor rate card
 * @param {string} vendorId - Vendor ID
 * @param {string} projectId - Project ID (optional)
 * @param {Object} timesheetData - Extracted timesheet data
 * @returns {Object} Cross-check result
 */
export const crossCheckWithRateCard = async (vendorId, projectId, timesheetData) => {
    await connectToDatabase();

    // Find active rate card for vendor
    const query = {
        vendorId,
        status: 'ACTIVE',
        effectiveFrom: { $lte: new Date() },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $gte: new Date() } }
        ]
    };

    // Prefer project-specific rate card
    if (projectId) {
        query.projectId = projectId;
    }

    let rateCard = await RateCard.findOne(query).sort({ created_at: -1 });

    // Fallback to general rate card if no project-specific found
    if (!rateCard && projectId) {
        delete query.projectId;
        query.projectId = null;
        rateCard = await RateCard.findOne(query).sort({ created_at: -1 });
    }

    const warnings = [];
    let estimatedAmount = 0;

    if (!rateCard) {
        warnings.push('No active rate card found for this vendor');
        return { warnings, estimatedAmount };
    }

    // Use first available hourly rate for estimation
    const hourlyRate = rateCard.rates.find(r => r.unit === 'HOUR');
    if (hourlyRate) {
        estimatedAmount = timesheetData.totalHours * hourlyRate.rate;
    }

    return {
        warnings,
        estimatedAmount,
        rateCardId: rateCard.id,
        rateCardName: rateCard.name
    };
};
