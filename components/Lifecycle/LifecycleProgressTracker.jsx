"use client";

import clsx from "clsx";
import Icon from "@/components/Icon";

/**
 * Lifecycle Progress Tracker Component
 *
 * Professional, compact display of invoice workflow stages with:
 * - Circular numbered stages (①—⑦)
 * - Checkmarks for completed stages
 * - Highlighted active stage
 * - Connectors between stages
 * - Real-time status updates
 *
 * @param {Object} invoice - Invoice with approval data
 * @param {Object} options - Styling options
 */
export default function LifecycleProgressTracker({ invoice, options = {} }) {
    const {
        className = "",
        showConnectorLines = true,
        highlightActive = true,
        showProgressBar = true
    } = options;

    const lifecycleStages = [
        { id: "submitted", label: "Submitted", icon: "CheckCircle" },
        { id: "pm-approval", label: "PM Review", icon: "CheckCircle" },
        { id: "pm-approved", label: "Approved ✓", icon: "CheckCircle" },
        { id: "dept-head-review", label: "Dept Review", icon: "CheckCircle" },
        { id: "dept-head-approved", label: "Dept Approved ✓", icon: "CheckCircle" },
        { id: "div-head-review", label: "Div Review", icon: "CheckCircle" },
        { id: "div-head-approved", label: "Final ✓", icon: "CheckCircle" }
    ];

    const circularNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦"];

    const getStageStatus = (stageId) => {
        const status = invoice?.status || "";
        const pmApproval = invoice?.pmApproval?.status || "";
        const deptHeadApproval = invoice?.deptHeadApproval?.status || "";
        const divHeadApproval = invoice?.divHeadApproval?.status || "";

        if (stageId === "submitted") return { completed: true, active: false };

        if (stageId === "pm-approval") {
            const isActive = status === "Pending PM Approval" || !pmApproval || pmApproval === "PENDING";
            const isCompleted = pmApproval === "APPROVED" || status === "PM Rejected";
            return { completed: isCompleted, active: isActive ? !isCompleted : false };
        }

        if (stageId === "pm-approved") {
            if (pmApproval === "APPROVED") return { completed: true, active: false };
            if (pmApproval === "REJECTED") return { rejected: true, message: "Rejected" };
            return { completed: false, active: false };
        }

        if (stageId === "dept-head-review") {
            if (pmApproval !== "APPROVED") return { completed: false, active: false };
            const isActive = status === "Pending Dept Head Review" || !deptHeadApproval || deptHeadApproval === "PENDING";
            const isCompleted = deptHeadApproval === "APPROVED" || deptHeadApproval === "REJECTED" ||
                status === "Dept Head Rejected" || status === "More Info Needed";
            return { completed: isCompleted, active: isActive ? !isCompleted : false };
        }

        if (stageId === "dept-head-approved") {
            if (pmApproval !== "APPROVED") return { completed: false, active: false };
            if (deptHeadApproval === "APPROVED") return { completed: true, active: false };
            if (deptHeadApproval === "REJECTED") return { rejected: true, message: "Rejected" };
            if (status === "More Info Needed") return { pendingInfo: true, message: "Needs Info" };
            return { completed: false, active: false };
        }

        if (stageId === "div-head-review") {
            if (pmApproval !== "APPROVED" || deptHeadApproval !== "APPROVED") return { completed: false, active: false };
            const isActive = status === "Pending Div Head Review" || !divHeadApproval || divHeadApproval === "PENDING";
            const isCompleted = divHeadApproval === "APPROVED" || divHeadApproval === "REJECTED" ||
                status === "Div Head Rejected" || status === "Div Head Approved";
            return { completed: isCompleted, active: isActive ? !isCompleted : false };
        }

        if (stageId === "div-head-approved") {
            if (pmApproval !== "APPROVED" || deptHeadApproval !== "APPROVED") return { completed: false, active: false };
            if (divHeadApproval === "APPROVED" || status === "Div Head Approved") return { completed: true, active: false };
            if (divHeadApproval === "REJECTED") return { rejected: true, message: "Rejected" };
            return { completed: false, active: false };
        }

        return { completed: false, active: false };
    };

    const calculateProgress = () => {
        const completed = lifecycleStages.filter(s => getStageStatus(s.id).completed).length;
        return Math.round((completed / lifecycleStages.length) * 100);
    };

    const stageElements = lifecycleStages.map((stage, index) => {
        const status = getStageStatus(stage.id);
        const stageNumber = circularNumbers[index];
        const isCompleted = status.completed;
        const isActive = status.active && highlightActive;
        const isRejected = status.rejected;

        return {
            index,
            stageNumber,
            stage,
            status,
            isCompleted,
            isActive,
            isRejected
        };
    });

    const stagesRender = stageElements.flatMap((item, index) => {
        const elements = [];

        const iconColor = item.isCompleted ? "#10B981" : item.isActive ? "#FFA500" : item.isRejected ? "#DC143C" : "#647A78";
        const iconBg = item.isCompleted ? "bg-emerald-400/30" : item.isActive ? "bg-amber-400/30" : item.isRejected ? "bg-rose-400/30" : "bg-slate-400/30";

        elements.push(
            <div key={item.stage.id} className={`${iconBg} rounded-lg flex flex-col gap-0.25 w-12 shrink-0 border border-slate-300/30`}>
                <div className={`p-1.5 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                    <span className={`text-[9px] font-black tracking-tight ${iconBg === "bg-emerald-400/30" ? "text-emerald-600" : iconBg === "bg-amber-400/30" ? "text-amber-600" : iconBg === "bg-rose-400/30" ? "text-rose-600" : "text-slate-600"}`}>
                        {item.stageNumber}
                    </span>
                </div>

                {item.isCompleted && (
                    <Icon name={item.stage.icon} size={10} className="m-0.25" />
                )}

                {item.isActive && highlightActive && (
                    <Icon name="Star" size={10} className="m-0.25" />
                )}

                <span className={`text-[8px] font-semibold ${item.isCompleted ? "text-emerald-600" : item.isActive ? "text-amber-600" : "text-slate-500"}`}>
                    {item.stage.label}
                </span>

                {item.status.message && (
                    <span className={`text-[7px] font-medium ${item.isRejected ? "text-rose-500" : "text-blue-500"}`}>
                        {item.status.message}
                    </span>
                )}
            </div>
        );

        if (showConnectorLines && index < lifecycleStages.length - 1) {
            elements.push(
                <Icon key={`${item.stage.id}-connector`} name="ArrowRight" size={8} className="m-0.25" />
            );
        }

        return elements;
    });

    const progress = calculateProgress();

    return (
        <div className={clsx("rounded-xl border border-slate-300/60 overflow-hidden flex row gap-0.5 shrink-0", className)}>
            {stagesRender}
        </div>
    );
}

