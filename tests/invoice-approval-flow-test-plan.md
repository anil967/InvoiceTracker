# Invoice Approval Flow Test Plan

## Overview
This test plan verifies the complete Invoice Approval Flow and Hierarchy fixes implemented in this session.

## Fix Summary
1. **Data Layer Fix**: Removed `DEPT_HEAD` and `DIV_HEAD` from PM filtering in `lib/db.js` line 34
2. **Admin Notification Fix**: Added Admin notification on Div Head final approval in `app/api/div-head/approve/[id]/route.js`

## Test Case 1: Vendor Submits Invoice → PM Queue
**Expected Behavior:**
- Invoice appears in PM's approval queue
- Invoice has `SUBMITTED` or `PENDING_PM_APPROVAL` status
- `assignedPM` field is populated

**Steps:**
1. Login as Vendor
2. Submit a new invoice via vendor page
3. Login as the Project Manager
4. Check `/pm/approval-queue` page
5. Verify the submitted invoice appears in the queue

**Expected Result:** ✅ Invoice visible in PM queue

---

## Test Case 2: PM Approves → Dept Head Queue
**Expected Behavior:**
- PM approves the invoice
- Invoice status changes to `PENDING_DEPT_HEAD_REVIEW`
- `assignedDeptHead` field is automatically populated from PM's `managedBy` field
- Dept Head receives notification message
- Invoice appears in Dept Head's approval queue

**Steps:**
1. Login as Project Manager
2. Approve the invoice with optional notes
3. Change session to Department Head (assignedDeptHead)
4. Check Dept Head's approval queue page
5. Verify the invoice appears in Dept Head queue
6. Check that Dept Head received notification

**Expected Result:** ✅ Invoice visible in Dept Head queue with `PENDING_DEPT_HEAD_REVIEW` status

---

## Test Case 3: Dept Head Approves → Div Head Queue
**Expected Behavior:**
- Dept Head approves the invoice
- Invoice status changes to `PENDING_DIV_HEAD_REVIEW`
- `assignedDivHead` field is automatically populated from Dept Head's `managedBy` field
- Div Head receives notification message
- Invoice appears in Div Head's approval queue

**Steps:**
1. Login as Department Head
2. Approve the invoice with optional notes
3. Change session to Divisional Head (assignedDivHead)
4. Check Div Head's approval queue page
5. Verify the invoice appears in Div Head queue
6. Check that Div Head received notification

**Expected Result:** ✅ Invoice visible in Div Head queue with `PENDING_DIV_HEAD_REVIEW` status

---

## Test Case 4: Div Head Approves → Admin Notified (FINAL APPROVAL)
**Expected Behavior:**
- Div Head approves the invoice (final approval)
- Invoice status changes to `DIV_HEAD_APPROVED` (terminal state)
- Vendor receives notification of final approval
- **ALL Admin users receive notification for oversight** (NEW FIX)
- Workflow is complete

**Steps:**
1. Login as Divisional Head
2. Approve the invoice with optional notes
3. Check vendor's messages - should receive approval notification
4. Login as Admin user
5. Check Admin's messages - should receive oversight notification (NEW)
6. Verify invoice status is `DIV_HEAD_APPROVED`

**Expected Result:** ✅ Both Vendor and Admin receive notifications

---

## Test Case 5: PM Reject → Vendor Notified
**Expected Behavior:**
- PM can reject invoice
- Invoice status changes to `PM_REJECTED` (terminal state)
- Vendor receives rejection notification
- Workflow ends at PM stage

**Steps:**
1. Login as Project Manager
2. Reject the new invoice with reason
3. Login as Vendor
4. Check for rejection notification
5. Verify invoice status is `PM_REJECTED`

**Expected Result:** ✅ Vendor receives rejection notification

---

## Test Case 6: Dept Head Reject → Back to Dept Head Queue
**Expected Behavior:**
- Dept Head can reject invoice
- Invoice status changes to `DEPT_HEAD_REJECTED`
- Dept Head receives notification about rejection
- Workflow ends at Dept Head stage

**Steps:**
1. Login as Department Head
2. Reject the invoice with reason
3. Check Dept Head's messages
4. Verify invoice status is `DEPT_HEAD_REJECTED`

**Expected Result:** ✅ Weekly rejection handled correctly

---

## Test Case 7: Div Head Reject → Back to Dept Head
**Expected Behavior:**
- Div Head can reject invoice
- Invoice status changes to `DIV_HEAD_REJECTED`
- Dept Head receives notification about rejection
- Workflow ends at Div Head stage

**Steps:**
1. Login as Divisional Head
2. Reject the invoice with reason
3. Check Dept Head's messages
4. Verify invoice status is `DIV_HEAD_REJECTED`

**Expected Result:** ✅ Final rejection handled correctly

---

## Test Case 8: Verify Queue Filters (DATA LAYER FIX VERIFICATION)
**Expected Behavior:**
- PM sees only PM-assigned invoices
- Dept Head sees invoices assigned to them OR from their managed PMs
- Div Head sees invoices assigned to them OR from their managed Dept Heads

**Steps:**
1. Login as PM → Check queue, note count
2. Login as Dept Head (not the assigned one) → Should NOT see PM-only invoices
3. Login as assigned Dept Head → Should see invoices from their managed PMs
4. Login as Div Head → Should see invoices from their managed Dept Heads

**Expected Result:** ✅ Each role sees only their relevant invoices

---

## Test Case 9: Workflow Audit Trail
**Expected Behavior:**
- Every state transition is recorded in `auditTrailEntry`
- Each entry includes: action, actor, actorRole, timestamp, previousStatus, newStatus, notes

**Steps:**
1. Review any invoice's audit trail
2. Verify all transitions are logged
3. Check actor roles are correct
4. Verify timestamps are in order

**Expected Result:** ✅ Complete audit trail present

---

## Test Case 10: Multiple Admin Users Notification
**Expected Behavior:**
- If multiple Admin users exist in the system
- ALL Admin users receive notification on final Div Head approval

**Steps:**
1. Ensure 2+ Admin users exist in system
2. Complete full approval flow (Vendor → PM → Dept Head → Div Head)
3. Check Admin 1 messages - should receive notification
4. Check Admin 2 messages - should receive notification

**Expected Result:** ✅ All Admin users receive oversight notifications

---

## Manual Testing Checklist
Run these commands to verify the fixes:

```bash
# Check the fix in lib/db.js
grep -A 5 "requireRole" lib/db.js
# Should show only PROJECT_MANAGER in the condition

# Check the Admin notification in Div Head route
grep -A 20 "Notify Admin for oversight" app/api/div-head/approve/[id]/route.js
# Should show Admin notification code block
```

## Regression Testing
Verify these scenarios still work:
- ✅ Legacy Finance User workflow (PM → Finance Approval)
- ✅ Vendor can submit invoices
- ✅ PM can approve/reject
- ✅ Dept Head can approve/reject
- ✅ Div Head can approve/reject
- ✅ Admin can view all invoices
- ✅ Request More Info flow works

---

## Success Criteria
All test cases pass when:
1. Invoices appear in correct queues based on role hierarchy
2. Dept Head and Div Head correctly receive invoices from their lower hierarchy
3. Admin users receive notifications on final approval
4. No "shadowing" occurs (Dept Head doesn't see PM queue, Div Head doesn't see Dept Head's PM-only invoices)
5. Workflow state transitions are correct and irreversible
6. All notifications reach correct recipients
7. Audit trails are complete and accurate