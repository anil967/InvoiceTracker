"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Icon from "@/components/Icon";
import clsx from "clsx";

const safeDate = (value) => {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
};
const formatDate = (d) => {
  const date = safeDate(d);
  try {
    return date.toISOString().split("T")[0];
  } catch {
    return "—";
  }
};

const AuditTrail = ({ invoice }) => {
  const timeline = useMemo(() => {
    if (!invoice) return [];

    const baseDate = safeDate(invoice.date || invoice.receivedAt || invoice.created_at);
    const baseTime = baseDate.getTime();
    const steps = [
      {
        id: "step-1",
        title: "Invoice Received",
        description: "Document uploaded via portal",
        date: formatDate(new Date(baseTime - 172800000)),
        status: "completed",
        icon: "FileInput",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500",
      },
      {
        id: "step-2",
        title: "Digitization Complete",
        description: "OCR extraction and validation",
        date: formatDate(new Date(baseTime - 86400000)),
        status: "completed",
        icon: "ScanLine",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
        borderColor: "border-purple-500",
      },
      {
        id: "step-3",
        title: "Three-Way Match",
        description: "Automated verification against PO & GR",
        date: invoice.date || formatDate(invoice.receivedAt) || "—",
        status: "completed",
        icon: "GitMerge",
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500",
      },
      {
        id: "step-4",
        title: "Pending Approval",
        description: "Awaiting manager sign-off",
        date: invoice.status === "PENDING_APPROVAL" ? "Today" : (invoice.date || formatDate(invoice.receivedAt) || "—"),
        status: invoice.status === "PENDING_APPROVAL" ? "current" : "completed",
        icon: "Clock",
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning",
      },
    ];

    const finalStatuses = ["APPROVED", "REJECTED", "PAID"];
    if (finalStatuses.includes(invoice.status)) {
      steps[3].status = "completed";
      const isApproved = invoice.status === "APPROVED" || invoice.status === "PAID";
      steps.push({
        id: "step-5",
        title: isApproved ? (invoice.status === "PAID" ? "Paid" : "Approved") : "Rejected",
        description: isApproved ? "Payment scheduled" : "Returned to vendor",
        date: "Today",
        status: "completed",
        icon: isApproved ? "CheckCircle" : "XCircle",
        color: isApproved ? "text-success" : "text-error",
        bgColor: isApproved ? "bg-success/10" : "bg-error/10",
        borderColor: isApproved ? "border-success" : "border-error",
      });
    }

    return steps;
  }, [invoice]);

  if (!invoice) return null;

  return (
    <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-6 border border-white/50 dark:border-slate-700/50 shadow-sm">
      <h3 className="font-bold text-gray-800 dark:text-slate-100 mb-6 flex items-center gap-2">
        <Icon name="History" size={20} className="text-primary" />
        Audit Trail
      </h3>

      <div className="relative pl-4 space-y-8">
        {/* Continuous Line */}
        <div className="absolute top-2 left-[27px] w-0.5 h-[calc(100%-40px)] bg-gray-200 dark:bg-slate-700 -z-10"></div>

        {timeline.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative flex gap-4"
          >
            {/* Icon Node */}
            <div
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 ring-4 ring-white dark:ring-slate-900 z-10 transition-colors duration-300",
                step.status === "current" ? "bg-white dark:bg-slate-800 border-2 animate-pulse" : step.bgColor,
                step.status === "current" ? step.borderColor : "border-transparent",
                step.color
              )}
            >
              <Icon name={step.icon} size={14} />
            </div>

            {/* Content */}
            <div className="flex-1 pt-1">
              <div className="flex justify-between items-start">
                <h4
                  className={clsx(
                    "font-bold text-sm",
                    step.status === "current" ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-slate-300"
                  )}
                >
                  {step.title}
                </h4>
                <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500 bg-white/50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded">
                  {step.date}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AuditTrail;