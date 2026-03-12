"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { transitionWorkflow } from "@/lib/api";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/Icon";

const ApprovalActions = ({ invoiceId, onActionComplete }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(null); // 'approved' | 'rejected' | null

  const handleAction = async (decision) => {
    setLoading(true);

    try {
      // decide which action to send to API
      const action = decision === "Approved" ? "APPROVE" : "REJECT";

      // Update via API
      await transitionWorkflow(invoiceId, action, "Authorized via Management Dashboard");

      setShowToast(decision === "Approved" ? "approved" : "rejected");

      // Wait for toast animation before redirecting
      setTimeout(() => {
        if (onActionComplete) {
          onActionComplete(decision === "Approved" ? "APPROVED" : "REJECTED");
        } else {
          router.push("/approvals");
        }
      }, 1500);
    } catch (error) {
      console.error("Workflow transition failed:", error);
      alert("Failed to update invoice status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-white/50 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Icon name="CheckSquare" size={20} className="text-primary" />
          Manager Actions
        </h3>
        <p className="text-sm text-gray-500">
          Review the matching analysis and authorize payment or reject the invoice.
        </p>

        <div className="grid grid-cols-1 gap-4 pt-2">
          <Button
            variant="danger"
            onClick={() => handleAction("Rejected")}
            loading={loading}
            disabled={loading || showToast !== null}
            icon="XCircle"
            className="w-full"
          >
            Reject
          </Button>
          <Button
            variant="primary"
            onClick={() => handleAction("Approved")}
            loading={loading}
            disabled={loading || showToast !== null}
            icon="CheckCircle"
            className="w-full bg-success hover:bg-success/90 border-success shadow-success/30 text-sm font-bold uppercase tracking-wider"
          >
            <div className="flex flex-col items-center">
              <span className="leading-none">Authorize & Release Payment (SAP)</span>
            </div>
          </Button>
          <div className="flex justify-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              This action triggers the payment release in SAP
            </span>
          </div>
        </div>
      </div>

      {/* Toast Notification Simulation */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`absolute -top-20 left-0 right-0 z-50 p-4 rounded-xl shadow-2xl flex items-center justify-center gap-3 border ${showToast === "approved"
              ? "bg-success text-white border-success-content/20"
              : "bg-error text-white border-error-content/20"
              }`}
          >
            <Icon
              name={showToast === "approved" ? "CheckCircle" : "AlertOctagon"}
              size={24}
              className="animate-bounce"
            />
            <span className="font-bold text-lg">
              {showToast === "approved" ? "Invoice Approved!" : "Invoice Rejected"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ApprovalActions;