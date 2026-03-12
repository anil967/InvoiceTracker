import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import { DocumentUpload, Message } from '@/models/Internal';
import { RateCard } from '@/models/Admin';
import { getSession } from '@/lib/auth';
import { requireRole, getNormalizedRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/vendor/submit - Submit invoice with documents (Vendor only)
 */
export async function POST(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.VENDOR])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const formData = await request.formData();
        const body = Object.fromEntries(formData);
        const invoiceFile = formData.get('invoice');
        const lineItems = formData.get('lineItems') ? JSON.parse(formData.get('lineItems')) : [];

        // Calculate total amount from line items if present, otherwise use provided amount
        // But for this phase, we trust the Vendor's provided Amount for the header, 
        // and Validate the Line Items total = Header Amount.

        let calculatedTotal = 0;
        if (lineItems.length > 0) {
            calculatedTotal = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        }

        // Validate: Header Amount should match Line Items Total (approx)
        if (lineItems.length > 0 && Math.abs(calculatedTotal - Number(body.amount)) > 1.0) {
            return NextResponse.json(
                { error: `Invoice Amount (${body.amount}) does not match Line Items Total (${calculatedTotal})` },
                { status: 400 }
            );
        }

        let billingMonth = formData.get('billingMonth');
        const assignedPM = formData.get('assignedPM');
        const project = formData.get('project');
        const amount = formData.get('amount');
        const basicAmount = formData.get('basicAmount');
        const taxType = formData.get('taxType');
        const hsnCode = formData.get('hsnCode');
        const invoiceNumber = formData.get('invoiceNumber');
        const invoiceDate = formData.get('invoiceDate');
        const notes = formData.get('notes');

        // Logic: if billingMonth is empty but invoiceDate exists, auto-derive it
        if (!billingMonth && invoiceDate) {
            billingMonth = invoiceDate.substring(0, 7); // Extract YYYY-MM
        }

        // Auto-resolve Finance User from the PM's hierarchy (managedBy field).
        // The vendor no longer picks the FU manually — it is derived from the admin hierarchy.
        let assignedFinanceUser = null;
        if (assignedPM) {
            const pmUser = await db.getUserById(assignedPM);
            if (pmUser?.managedBy) {
                const manager = await db.getUserById(pmUser.managedBy);
                // Only assign if the manager is a Finance User (use shared getNormalizedRole)
                if (manager && getNormalizedRole(manager) === ROLES.FINANCE_USER) {
                    assignedFinanceUser = manager.id;
                    console.log(`[Vendor Submit] Auto-assigned Finance User ${manager.name} (${manager.id}) from PM hierarchy`);
                }
            }
        }

        // Additional document files
        const timesheetFile = formData.get('timesheet');
        const annexFile = formData.get('annex') || formData.get('rfpCommercial');

        if (!invoiceFile) {
            return NextResponse.json(
                { error: 'Invoice file is required' },
                { status: 400 }
            );
        }

        // Validate Line Items against Rate Card
        if (lineItems.length > 0) {
            // Find applicable rate cards
            // Priority: Project-specific > Global
            const vendorEntityId = session.user.vendorId;

            if (!vendorEntityId) {
                return NextResponse.json(
                    { error: 'No vendor entity linked to this account. Rate validation cannot be performed.' },
                    { status: 400 }
                );
            }

            const rateQuery = {
                vendorId: vendorEntityId,
                status: 'ACTIVE',
                $or: [
                    { effectiveTo: { $exists: false } },
                    { effectiveTo: { $gte: new Date() } }
                ]
            };

            if (project) {
                rateQuery.$or.push({ projectId: project });
                rateQuery.$or.push({ projectId: null });
            } else {
                rateQuery.projectId = null;
            }

            const rateCards = await RateCard.find(rateQuery).sort({ projectId: -1, effectiveFrom: -1 }); // Project specific first

            // Flatten rates for easier lookup
            const availableRates = [];
            rateCards.forEach(card => {
                if (card.rates) {
                    card.rates.forEach(r => {
                        // Add only if not already present (respecting priority)
                        if (!availableRates.find(ar => ar.role === r.role && ar.experienceRange === r.experienceRange)) {
                            availableRates.push(r);
                        }
                    });
                }
            });

            // Validate each item
            lineItems.forEach(item => {
                const match = availableRates.find(r => r.role === item.role && r.experienceRange === item.experienceRange);
                if (match) {
                    // Check rate, allow for minor floating point diff? strict for now.
                    if (Math.abs(match.rate - Number(item.rate)) < 0.01) {
                        item.status = 'MATCH';
                    } else {
                        item.status = 'MISMATCH';
                        item.description = (item.description || '') + ` [Rate Mismatch: Expected ${match.rate}, Got ${item.rate}]`;
                    }
                } else {
                    item.status = 'MANUAL'; // No rate card found for this role
                    item.description = (item.description || '') + ` [No Rate Card Found]`;
                }
            });
        }

        const invoiceBuffer = Buffer.from(await invoiceFile.arrayBuffer());
        const invoiceBase64 = invoiceBuffer.toString('base64');
        const invoiceMimeType = invoiceFile.type || 'application/pdf';
        const invoiceFileUrl = `data:${invoiceMimeType};base64,${invoiceBase64}`;
        const invoiceId = uuidv4();

        // --- OCR Extraction: Parse PDF to extract invoice fields ---
        let ocrData = {};
        if (invoiceMimeType === 'application/pdf' || invoiceFile.name?.toLowerCase().endsWith('.pdf')) {
            try {
                await import('pdf-parse/worker');
                const { PDFParse } = await import('pdf-parse');
                const parser = new PDFParse({ data: invoiceBuffer });
                const pdfData = await parser.getText();
                await parser.destroy();
                const fullText = pdfData.text || '';

                if (fullText.trim()) {
                    // Extract Invoice Number
                    const invNumPatterns = [
                        /(?:invoice\s*(?:no|number|#|num|id)[\s.:/-]*)\s*([A-Z0-9][\w\-\/]{1,25})/i,
                        /(?:inv[\s.:/-]*(?:no|num|#)?[\s.:/-]*)\s*([A-Z0-9][\w\-\/]{1,25})/i,
                    ];
                    for (const pat of invNumPatterns) {
                        const m = fullText.match(pat);
                        if (m?.[1]) { ocrData.invoiceNumber = m[1].trim(); break; }
                    }

                    // Extract Invoice Date
                    const datePatterns = [
                        /(?:invoice\s*date|inv\.?\s*date|date\s*of\s*invoice|billing\s*date|bill\s*date)[\s.:/-]*\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
                        /(?:invoice\s*date|inv\.?\s*date|date\s*of\s*invoice|billing\s*date|bill\s*date)[\s.:/-]*\s*(\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s.,]*\d{2,4})/i,
                        /(?:date)[\s.:/-]*\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
                        /(?:date)[\s.:/-]*\s*(\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s.,]*\d{2,4})/i,
                    ];
                    for (const pat of datePatterns) {
                        const m = fullText.match(pat);
                        if (m?.[1]) {
                            ocrData.invoiceDate = normalizeOcrDate(m[1].trim());
                            break;
                        }
                    }

                    // Extract Basic Amount
                    const basicPatterns = [
                        /(?:sub\s*total|basic\s*amount|taxable\s*(?:value|amount)|net\s*amount|amount\s*before\s*tax)[\s.:₹$Rs]*\s*([0-9,]+\.?\d{0,2})/i,
                        /(?:subtotal)[\s.:₹$Rs]*\s*([0-9,]+\.?\d{0,2})/i,
                    ];
                    for (const pat of basicPatterns) {
                        const m = fullText.match(pat);
                        if (m?.[1]) { ocrData.basicAmount = parseFloat(m[1].replace(/,/g, '')); break; }
                    }

                    // Extract Total Amount (fallback for amount)
                    const totalPatterns = [
                        /(?:grand\s*total|total\s*amount|amount\s*payable|net\s*payable|total\s*(?:due|inv(?:oice)?))[\s.:₹$Rs]*\s*([0-9,]+\.?\d{0,2})/i,
                        /(?:total)[\s.:₹$Rs]*\s*([0-9,]+\.\d{2})/i,
                    ];
                    for (const pat of totalPatterns) {
                        const m = fullText.match(pat);
                        if (m?.[1]) { ocrData.totalAmount = parseFloat(m[1].replace(/,/g, '')); break; }
                    }

                    // Extract Tax Type
                    if (/igst/i.test(fullText)) {
                        ocrData.taxType = 'IGST';
                    } else if (/cgst|sgst/i.test(fullText)) {
                        ocrData.taxType = 'CGST_SGST';
                    } else if (/gst/i.test(fullText)) {
                        ocrData.taxType = 'CGST_SGST';
                    }

                    // Extract HSN Code
                    const hsnMatch = fullText.match(/(?:hsn|sac)[\s\/:.-]*(?:code)?[\s\/:.-]*(\d{4,8})/i);
                    if (hsnMatch?.[1]) {
                        ocrData.hsnCode = hsnMatch[1];
                    }

                    console.log('[Vendor Submit] OCR extracted fields:', ocrData);
                }
            } catch (ocrErr) {
                console.error('[Vendor Submit] OCR extraction failed, continuing without:', ocrErr.message);
            }
        }

        // Derive billingMonth from invoiceDate if not provided
        if (!billingMonth && invoiceDate) {
            const [year, month] = invoiceDate.split('-');
            if (year && month) {
                billingMonth = `${year}-${month}`;
                console.log(`[Vendor Submit] Derived billingMonth from invoiceDate: ${billingMonth}`);
            }
        }

        // Create invoice record — manual input takes priority over OCR
        const invoice = await Invoice.create({
            id: invoiceId,
            vendorName: session.user.name || session.user.email,
            submittedByUserId: session.user.id,
            vendorId: session.user.vendorId || null,
            originalName: invoiceFile.name,
            receivedAt: new Date(),
            invoiceNumber: invoiceNumber || null,
            date: invoiceDate || null,
            invoiceDate: invoiceDate || null,
            billingMonth: billingMonth || null,
            amount: amount ? parseFloat(amount) : null,
            basicAmount: basicAmount ? parseFloat(basicAmount) : null,
            taxType: taxType || '',
            hsnCode: hsnCode || null,
            status: 'Submitted',
            originatorRole: 'Vendor',
            fileUrl: invoiceFileUrl,
            project: project || null,
            assignedPM: assignedPM || null,
            assignedFinanceUser: assignedFinanceUser || null,
            pmApproval: { status: 'PENDING' },
            financeApproval: { status: 'PENDING' },
            hilReview: { status: 'PENDING' },
            lineItems: lineItems,
            documents: [],
            auditTrail: [{
                action: 'SUBMITTED',
                actor: session.user.name || session.user.email || 'Vendor',
                actorId: session.user.id,
                actorRole: 'Vendor',
                timestamp: new Date(),
                previousStatus: null,
                newStatus: 'Submitted',
                notes: notes || 'Invoice submitted by vendor'
            }]
        });

        // Process additional documents
        const documentIds = [];

        // Save timesheet if provided
        if (timesheetFile) {
            const tsBuffer = Buffer.from(await timesheetFile.arrayBuffer());
            const tsBase64 = tsBuffer.toString('base64');
            const tsMimeType = timesheetFile.type || 'application/pdf';
            const tsFileUrl = `data:${tsMimeType};base64,${tsBase64}`;
            const tsId = uuidv4();

            await DocumentUpload.create({
                id: tsId,
                invoiceId: invoiceId,
                type: 'TIMESHEET',
                fileName: timesheetFile.name,
                fileUrl: tsFileUrl,
                mimeType: tsMimeType,
                fileSize: tsBuffer.length,
                uploadedBy: session.user.id,
                metadata: {
                    billingMonth,
                    projectId: project
                },
                status: 'PENDING'
            });
            documentIds.push({ documentId: tsId, type: 'TIMESHEET', fileName: timesheetFile.name });
        }

        // Save Annex if provided
        if (annexFile) {
            const annexBuffer = Buffer.from(await annexFile.arrayBuffer());
            const annexBase64 = annexBuffer.toString('base64');
            const annexMimeType = annexFile.type || 'application/pdf';
            const annexFileUrl = `data:${annexMimeType};base64,${annexBase64}`;
            const annexId = uuidv4();

            await DocumentUpload.create({
                id: annexId,
                invoiceId: invoiceId,
                type: 'RFP_COMMERCIAL',
                fileName: annexFile.name,
                fileUrl: annexFileUrl,
                mimeType: annexMimeType,
                fileSize: annexBuffer.length,
                uploadedBy: session.user.id,
                metadata: {
                    billingMonth,
                    projectId: project
                },
                status: 'PENDING'
            });
            documentIds.push({ documentId: annexId, type: 'ANNEX', fileName: annexFile.name });
        }

        // Update invoice with document references
        if (documentIds.length > 0) {
            await Invoice.findOneAndUpdate(
                { id: invoiceId },
                { documents: documentIds }
            );
        }

        // Create audit trail
        await db.createAuditTrailEntry({
            invoice_id: invoiceId,
            username: session.user.name || session.user.email,
            action: 'INVOICE_SUBMITTED',
            details: `Vendor submitted invoice${documentIds.length > 0 ? ` with ${documentIds.length} document(s)` : ''}${assignedPM ? ` routed to PM` : ''}`
        });

        // Notify assigned PM that a new invoice needs review
        if (assignedPM) {
            try {
                const pmUser = await db.getUserById(assignedPM);
                const msgId = uuidv4();
                const invoiceLabel = invoiceNumber || invoiceId.slice(0, 8);
                await connectToDatabase();
                await Message.create({
                    id: msgId,
                    invoiceId: invoiceId,
                    projectId: project || null,
                    senderId: session.user.id,
                    senderName: session.user.name || session.user.email,
                    senderRole: 'Vendor',
                    recipientId: assignedPM,
                    recipientName: pmUser?.name || 'Project Manager',
                    subject: `New Invoice for Review: ${invoiceLabel}`,
                    content: `A new invoice (${invoiceLabel}) has been submitted by ${session.user.name || session.user.email} and assigned to you for review.${notes ? ' Notes: ' + notes : ''}`,
                    messageType: 'STATUS_UPDATE',
                    threadId: msgId
                });
                console.log(`[Vendor Submit] PM notification sent to ${assignedPM}`);
            } catch (msgErr) {
                console.error('[Vendor Submit] Failed to notify PM:', msgErr);
            }
        }

        // Notify assigned Finance User about the new submission
        if (assignedFinanceUser) {
            try {
                const finUser = await db.getUserById(assignedFinanceUser);
                const msgId = uuidv4();
                const invoiceLabel = invoiceNumber || invoiceId.slice(0, 8);
                await connectToDatabase();
                await Message.create({
                    id: msgId,
                    invoiceId: invoiceId,
                    projectId: project || null,
                    senderId: session.user.id,
                    senderName: session.user.name || session.user.email,
                    senderRole: 'Vendor',
                    recipientId: assignedFinanceUser,
                    recipientName: finUser?.name || 'Finance User',
                    subject: `New Invoice Submitted: ${invoiceLabel}`,
                    content: `A new invoice (${invoiceLabel}) has been submitted by ${session.user.name || session.user.email}. It is currently pending PM review.${notes ? ' Notes: ' + notes : ''}`,
                    messageType: 'STATUS_UPDATE',
                    threadId: msgId
                });
                // console.log(`[Vendor Submit] Finance notification sent to ${assignedFinanceUser}`);
            } catch (msgErr) {
                console.error('[Vendor Submit] Failed to notify Finance:', msgErr);
            }
        }

        return NextResponse.json({
            success: true,
            invoiceId,
            message: 'Invoice submitted successfully',
            documentsAttached: documentIds.length
        }, { status: 201 });
    } catch (error) {
        console.error('Error submitting invoice:', error);
        return NextResponse.json({ error: 'Failed to submit invoice' }, { status: 500 });
    }
}

/**
 * Normalize various date formats to YYYY-MM-DD for HTML date input.
 */
function normalizeOcrDate(dateStr) {
    if (!dateStr) return null;
    try {
        // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        let m = dateStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
        if (m) {
            const day = m[1].padStart(2, '0');
            const month = m[2].padStart(2, '0');
            return `${m[3]}-${month}-${day}`;
        }
        // DD/MM/YY
        m = dateStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/);
        if (m) {
            const year = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
            const day = m[1].padStart(2, '0');
            const month = m[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        // DD Mon YYYY (e.g. 07 Feb 2026)
        const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
        m = dateStr.match(/^(\d{1,2})\s*([a-z]{3})[a-z]*[\s.,]*(\d{4})$/i);
        if (m) {
            const mon = months[m[2].toLowerCase().substring(0, 3)];
            if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
        }
        // Fallback: JS Date parser
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch { /* ignore */ }
    return null;
}
