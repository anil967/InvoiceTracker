"use client";

import Icon from "@/components/Icon";
import clsx from "clsx";

const STAGES = [
    { key: 'VENDER', label: 'Vendor', icon: 'User' },
    { key: 'FM', label: 'Finance', icon: 'Calculator' },
    { key: 'PM', label: 'Project Mgr', icon: 'Briefcase' }
];

const ApprovalTracker = ({ invoice }) => {
    // Determine the current stage status
    const getStageStatus = (stageKey) => {
        if (stageKey === 'VENDER') return 'COMPLETED'; // Submitted is always completed here

        if (stageKey === 'FM') {
            if (invoice.financeApproval?.status === 'APPROVED') return 'COMPLETED';
            if (invoice.financeApproval?.status === 'REJECTED') return 'REJECTED';
            return 'PENDING';
        }

        if (stageKey === 'PM') {
            if (invoice.pmApproval?.status === 'APPROVED') return 'COMPLETED';
            if (invoice.pmApproval?.status === 'REJECTED') return 'REJECTED';
            if (invoice.financeApproval?.status === 'APPROVED') return 'ACTIVE';
            return 'PENDING';
        }

        return 'PENDING';
    };

    // Helper to determine active stage
    const isActive = (stageKey) => {
        const stageStatus = getStageStatus(stageKey);
        if (stageKey === 'FM' && stageStatus === 'PENDING') return true;
        return stageStatus === 'ACTIVE';
    };

    return (
        <div className="flex items-center justify-between w-full px-2 py-4">
            {STAGES.map((stage, idx) => {
                const status = getStageStatus(stage.key);
                const active = isActive(stage.key);

                return (
                    <div key={stage.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center relative gap-1.5">
                            <div className={clsx(
                                "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10",
                                status === 'COMPLETED' ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" :
                                    status === 'REJECTED' ? "bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20" :
                                        active ? "bg-indigo-50 border-indigo-500 text-indigo-600 animate-pulse" :
                                            "bg-slate-50 border-slate-200 text-slate-400"
                            )}>
                                {status === 'COMPLETED' ? (
                                    <Icon name="Check" size={18} strokeWidth={3} />
                                ) : status === 'REJECTED' ? (
                                    <Icon name="X" size={18} strokeWidth={3} />
                                ) : (
                                    <Icon name={stage.icon} size={16} />
                                )}
                            </div>
                            <span className={clsx(
                                "text-[10px] font-black uppercase tracking-tighter whitespace-nowrap",
                                status === 'COMPLETED' ? "text-emerald-600" :
                                    status === 'REJECTED' ? "text-rose-600" :
                                        active ? "text-indigo-600" : "text-slate-400"
                            )}>
                                {stage.label}
                            </span>
                        </div>
                        {idx < STAGES.length - 1 && (
                            <div className="flex-1 h-0.5 bg-slate-100 mx-2 -mt-4 relative overflow-hidden">
                                {status === 'COMPLETED' && (
                                    <div className="absolute inset-0 bg-emerald-500 transition-all duration-700" />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ApprovalTracker;
