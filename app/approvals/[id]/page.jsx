"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES, getNormalizedRole } from "@/constants/roles";
import { getInvoiceStatus, transitionWorkflow } from "@/lib/api";
import AuditTrail from "@/components/Workflow/AuditTrail";
import ApprovalActions from "@/components/Workflow/ApprovalActions";
import Icon from "@/components/Icon";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// Inline component for restoring rejected/approved invoices
function RestoreToReviewButton({ invoiceId }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRestore = async () => {
    setLoading(true);
    try {
      await transitionWorkflow(invoiceId, "RESTORE", "Restored to review by admin");
      router.refresh();
      setTimeout(() => router.push("/approvals"), 500);
    } catch (error) {
      console.error("Failed to restore invoice:", error);
      alert("Failed to restore invoice. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="mt-4 btn btn-sm btn-ghost bg-white/60 border border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300 gap-2"
      >
        <Icon name="RotateCcw" size={16} /> Restore to Review
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 bg-white/80 rounded-xl border border-slate-200 space-y-3">
      <p className="text-sm font-medium text-slate-700">Restore this invoice to review status?</p>
      <div className="flex gap-2">
        <button
          onClick={() => setShowConfirm(false)}
          disabled={loading}
          className="btn btn-sm btn-ghost flex-1"
        >
          Cancel
        </button>
        <button
          onClick={handleRestore}
          disabled={loading}
          className="btn btn-sm btn-primary flex-1 gap-2"
        >
          {loading ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            <Icon name="RotateCcw" size={14} />
          )}
          Confirm Restore
        </button>
      </div>
    </div>
  );
}


export default function ApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [docViewerLoading, setDocViewerLoading] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else {
        const role = getNormalizedRole(user);
        if (![ROLES.ADMIN, ROLES.PROJECT_MANAGER].includes(role)) {
          router.push("/dashboard");
        }
      }
    }
  }, [user, authLoading, router, getNormalizedRole]);

  useEffect(() => {
    if (authLoading || !user) return; // Wait for auth

    const fetchInvoice = async () => {
      try {
        const foundInvoice = await getInvoiceStatus(params.id);

        if (!foundInvoice) {
          router.push("/approvals");
          return;
        }

        setInvoice(foundInvoice);
      } catch (error) {
        console.error("Failed to fetch invoice:", error);
        router.push("/approvals");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchInvoice();
    }
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <span className="loading loading-infinity loading-lg text-amber-500 mb-4"></span>
          <p className="text-gray-500">Loading invoice context...</p>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const isProcessed = ["APPROVED", "REJECTED", "PAID"].includes(invoice.status);

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto space-y-4 pb-10">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link
          href="/approvals"
          className="hover:text-primary transition-colors flex items-center gap-1"
        >
          <Icon name="ArrowLeft" size={14} /> Back to Approvals
        </Link>
        <span>/</span>
        <span className="font-semibold text-gray-700">{invoice.id}</span>
        <span>/</span>
        <span className="text-amber-600">Final Review</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Left Panel: Invoice Summary */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-2 space-y-4 min-w-0"
        >
          {/* Info Banner */}
          <div className="alert bg-blue-50 border-blue-200 text-blue-800 shadow-sm">
            <Icon name="Info" size={20} />
            <div>
              <h3 className="font-bold text-sm">Invoice Summary</h3>
              <div className="text-xs">
                Review invoice details and pending discrepancies below.
              </div>
            </div>
          </div>

          {/* Invoice Details Display */}
          <div className="relative rounded-2xl overflow-hidden border border-gray-200/50 bg-white/60 p-6 space-y-3">
            <div className="flex flex-col">
              <div className="text-sm font-semibold text-gray-800 mb-2">
                <Icon name="Info" size={16} />
                <span className="text-sm font-semibold text-gray-800 ml-2">Invoice #{invoice.id}</span>
              </div>
              <div className="text-sm font-medium text-gray-700 mt-2">
                <span className="text-sm font-medium text-gray-700 inline">Vendor:</span>
                <span className="text-sm font-medium text-gray-700 inline"> {invoice.vendorName || "N/A"}</span>
              </div>
              <div className="text-sm font-medium text-gray-700 mt-2">
                <span className="text-sm font-medium text-gray-700 inline">Status:</span>
                <span className={`text-sm font-semibold text-gray-700 inline ${invoice.status === "MATCH_DISCREPANCY" ? "bg-amber-50/50" : ""}`}> {invoice.status}</span>
              </div>
              <div className="text-sm font-medium text-gray-700 mt-2">
                <span className="text-sm font-medium text-gray-700 inline">Amount:</span>
                <span className="text-sm font-semibold text-gray-700 inline"> ${invoice.totalAmount !== undefined && invoice.totalAmount !== null ? invoice.totalAmount.toLocaleString() : (invoice.amount ? invoice.amount.toLocaleString() : "N/A")}</span>
              </div>
              <div className="text-sm font-medium text-gray-700 mt-2">
                <span className="text-sm font-medium text-gray-700 inline">PO Number:</span>
                <span className="text-sm font-semibold text-gray-700 inline"> ${invoice.purchaseOrderNumber || "N/A"}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Panel: Workflow Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-1 space-y-6 min-w-0 shrink-0"
        >
          {/* View invoice document — same as vendor portal */}
          <div className="p-4 rounded-2xl border border-gray-200/50 bg-white/60">
            <button
              type="button"
              onClick={() => { setShowDocViewer(true); setDocViewerLoading(true); }}
              className="w-full btn btn-ghost border border-amber-200 bg-amber-50/50 text-amber-800 hover:bg-amber-100/80 gap-2"
            >
              <Icon name="Eye" size={18} />
              View invoice document
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">Preview the uploaded invoice file</p>
          </div>

          {/* Approval Actions */}
          {!isProcessed ? (
            <ApprovalActions
              invoiceId={invoice.id}
              onActionComplete={(newStatus) => {
                // Optimistically update the UI to show success state immediately
                setInvoice(prev => ({ ...prev, status: newStatus }));
              }}
            />
          ) : (
            <div
              className={`p-6 rounded-2xl border ${invoice.status === "APPROVED" || invoice.status === "PAID"
                ? "bg-success/10 border-success/30 text-success-content"
                : "bg-error/10 border-error/30 text-error-content"
                } flex flex-col items-center justify-center text-center space-y-3`}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${invoice.status === "APPROVED" || invoice.status === "PAID" ? "bg-success text-white" : "bg-error text-white"
                  }`}
              >
                <Icon
                  name={invoice.status === "APPROVED" || invoice.status === "PAID" ? "Check" : "X"}
                  size={32}
                />
              </div>
              <h3 className="text-xl font-bold uppercase">
                Invoice {invoice.status === "PAID" ? "Paid" : invoice.status}
              </h3>
              <p className="text-sm opacity-80">
                {invoice.status === "PAID"
                  ? "This invoice has been paid. No further actions can be taken."
                  : "This workflow has been finalized. You can restore it for re-review if needed."}
              </p>
              {invoice.status !== "PAID" && (
                <RestoreToReviewButton invoiceId={invoice.id} />
              )}
            </div>
          )}

          {/* Audit Trail */}
          <AuditTrail invoice={invoice} />
        </motion.div>
      </div>

      {/* Document viewer modal — view invoice like in vendor portal */}
      <AnimatePresence>
        {showDocViewer && invoice && (
          <div className="fixed inset-0 z- flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDocViewer(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden z- flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 shrink-0">
                <span className="font-semibold text-gray-800 text-sm truncate">
                  {invoice.originalName || invoice.vendorName || `Invoice ${invoice.id}`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowDocViewer(false)}
                  className="btn btn-ghost btn-sm btn-square"
                >
                  <Icon name="X" size={20} />
                </button>
              </div>
              <div className="flex-1 min-h-[70vh] bg-gray-100 relative">
                {docViewerLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <span className="loading loading-spinner loading-lg text-amber-500" />
                  </div>
                )}
                <iframe
                  src={`/api/invoices/${invoice.id}/file`}
                  title="Invoice document"
                  className="w-full h-full min-h-[70vh] border-0"
                  onLoad={() => setDocViewerLoading(false)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}