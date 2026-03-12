"use client";

import Icon from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { getNormalizedRole } from "@/constants/roles";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/Layout/ThemeToggle";

const accentMap = {
  purple: {
    gradient: "from-purple-600 to-indigo-600 shadow-purple-500/20",
    badge: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/40",
  },
  teal: {
    gradient: "from-teal-600 to-emerald-600 shadow-teal-500/20",
    badge: "text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-950/40",
  },
  amber: {
    gradient: "from-amber-500 to-orange-500 shadow-amber-500/20",
    badge: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40",
  },
  blue: {
    gradient: "from-blue-600 to-indigo-600 shadow-blue-500/20",
    badge: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40",
  },
  slate: {
    gradient: "from-slate-600 to-slate-700 shadow-slate-500/20",
    badge: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800",
  },
  indigo: {
    gradient: "from-indigo-600 to-indigo-700 shadow-indigo-500/20",
    badge: "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40",
  },
};

export default function PageHeader({
  title,
  subtitle,
  icon = "LayoutDashboard",
  accent = "purple",
  roleLabel,
  actions,
  showSignout = true,
}) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const accentStyle = accentMap[accent] || accentMap.purple;
  const gradientClass =
    typeof accentStyle === "string" ? accentStyle : accentStyle.gradient;

  const displayRole = (() => {
    if (roleLabel) return roleLabel;
    const normalizedRole = getNormalizedRole(user);
    const role = normalizedRole || '';
    const r = role.toLowerCase().replace(/\s/g, '');
    if (['pm', 'projectmanager'].includes(r)) return "Project Manager";
    if (r === 'admin') return "System Administrator";
    if (['departmenthead', 'depthead'].includes(r)) return "Department Head";
    if (['divisionalhead', 'divhead'].includes(r)) return "Divisional Head";
    return role || "User";
  })();

  return (
    <header className="border-b border-slate-200/80 dark:border-slate-700/50 shadow-sm py-4 mb-8 px-4 md:px-6 rounded-t-3xl sticky top-0 z-40 backdrop-blur-md bg-white/90 dark:bg-slate-900/90">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* LEFT SECTION */}
        <div className="flex items-center gap-4 w-full md:flex-1 min-w-0">
          <div
            className={`p-3 bg-linear-to-br ${gradientClass} rounded-2xl shadow-lg shrink-0 border-2 border-white/20`}
          >
            <Icon name={icon} className="text-white w-6 h-6" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight truncate leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {actions && (
            <div className="flex items-center gap-2 lg:gap-3">
              {actions}
            </div>
          )}

          {/* Theme Toggle */}
          <ThemeToggle size={18} />

          {user && (
            <div className="dropdown dropdown-end">
              {/* AVATAR BUTTON */}
              <label
                tabIndex={0}
                className="group cursor-pointer flex items-center gap-3 pl-3 pr-1 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl transition-all hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95"
              >
                <div className="hidden sm:block text-right pr-1">
                  <p className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider leading-none">
                    {user.name}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight mt-1">
                    {displayRole}
                  </p>
                </div>

                <div
                  className={`w-10 h-10 rounded-xl bg-linear-to-br ${gradientClass} shadow-md flex items-center justify-center text-white font-black text-xs uppercase border-2 border-white dark:border-slate-700`}
                >
                  {user.name?.charAt(0) || "U"}
                </div>
              </label>

              {/* DROPDOWN */}
              <ul
                tabIndex={0}
                className="dropdown-content z-60 mt-4 shadow-2xl bg-white dark:bg-slate-800 rounded-3xl w-64 border border-slate-100 dark:border-slate-700 p-2"
              >
                {/* USER INFO */}
                <li className="px-3 py-4 border-b border-slate-50 dark:border-slate-700 mb-1">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-linear-to-br ${gradientClass} flex items-center justify-center text-white font-black text-sm uppercase shadow-lg`}
                    >
                      {user.name?.charAt(0) || "U"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-800 dark:text-slate-100 text-sm tracking-tight truncate">
                        {user.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                        {user.email || displayRole}
                      </p>
                    </div>
                  </div>
                </li>

                {showSignout && (
                  <>
                    {/* SIGN OUT */}
                    <li>
                      <button
                        onClick={() => {
                          logout();
                          router.push("/login");
                        }}
                        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600"
                      >
                        <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest leading-none">
                          Sign Out
                        </span>
                        <div
                          className={`w-8 h-8 rounded-lg bg-linear-to-br ${gradientClass} flex items-center justify-center shrink-0`}
                        >
                          <Icon name="LogOut" size={16} className="text-white" />
                        </div>
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
