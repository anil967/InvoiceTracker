"use client";

import { useAuth } from "@/context/AuthContext";
import { ROLES, getNormalizedRole } from "@/constants/roles";
import Icon from "@/components/Icon";

const RoleSwitcher = () => {
    const { user, switchRole } = useAuth();

    const role = getNormalizedRole(user);
    if (!user || role !== ROLES.ADMIN) return null;

    // Allow Admins to switch to any role for testing
    // Allow PMs to switch to Finance roles if needed (optional logic)

    return (
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
            {[ROLES.ADMIN].map((role) => (
                <button
                    key={role}
                    onClick={() => switchRole && switchRole(role)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${getNormalizedRole(user) === role
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-105"
                        : "text-slate-400 hover:text-indigo-600 hover:bg-white"
                        }`}
                    title={`Role: ${role}`}
                >
                    <Icon
                        name="Shield"
                        size={12}
                    />
                    {role.replace('_', ' ')}
                </button>
            ))}
        </div>
    );
};

export default RoleSwitcher;
