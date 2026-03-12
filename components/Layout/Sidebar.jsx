"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { APP_VERSION } from "@/lib/version";
import { useAuth } from "@/context/AuthContext";
import { canSeeMenuItem, ROLES, getNormalizedRole } from "@/constants/roles";


const SIDEBAR_COLLAPSED_KEY = "invoiceflow-sidebar-collapsed";

const menuItems = [
  { name: "Dashboard", icon: "LayoutDashboard", path: "/dashboard" },
  { name: "Messages", icon: "Mail", path: "/pm/messages" },
  { name: "Approvals", icon: "CheckCircle", path: "/pm/approvals" },
  { name: "PM Approval Queue", icon: "ClipboardCheck", path: "/pm/approval-queue" },
  { name: "Dept Head Approval Queue", icon: "ClipboardList", path: "/dept-head/approval-queue" },
  { name: "Div Head Approval Queue", icon: "BadgeCheck", path: "/div-head/approval-queue" },
  { name: "Configuration", icon: "Settings", path: "/config" },
  { name: "User Management", icon: "Shield", path: "/users" },
  { name: "Audit Logs", icon: "FileText", path: "/audit" },
  { name: "Rate Cards", icon: "Layers", path: "/admin/ratecards" },
  { name: "Hierarchy", icon: "GitBranch", path: "/admin/hierarchy" },
  { name: "Re-check Requests", icon: "AlertCircle", path: "/vendors/rechecks" },
];

const Sidebar = ({ mobileOpen, setMobileOpen }) => {
  const pathname = usePathname();

  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recheckUnreadCount, setRecheckUnreadCount] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored !== null) setCollapsed(JSON.parse(stored));
    } catch (_) { }
  }, []);

  // Fetch unread messages count from the role-appropriate endpoint
  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      try {
        const role = getNormalizedRole(user);
        if (role === ROLES.ADMIN) {
          setUnreadCount(0);
          return;
        }

        let endpoint = '/api/pm/messages?type=inbox';
        if (role === ROLES.DEPARTMENT_HEAD) endpoint = '/api/dept-head/messages?type=inbox';
        else if (role === ROLES.DIVISIONAL_HEAD) endpoint = '/api/div-head/messages?type=inbox';

        const res = await fetch(endpoint, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        console.error('Failed to fetch unread count in sidebar', err);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch re-check unread count for vendor users
  useEffect(() => {
    if (!user) return;
    const role = getNormalizedRole(user);
    if (role !== ROLES.VENDOR) return;

    const fetchRecheckUnread = async () => {
      try {
        const res = await fetch('/api/vendor/rechecks', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setRecheckUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        console.error('Failed to fetch recheck unread count in sidebar', err);
      }
    };

    fetchRecheckUnread();
    const interval = setInterval(fetchRecheckUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(next));
      } catch (_) { }
      return next;
    });
  };

  // Dynamic menu path replacement based on role
  const dynamicMenuItems = menuItems.map(item => {
    if (user) {
      const role = getNormalizedRole(user);

      if (item.name === 'Dashboard') {
        if (role === ROLES.PROJECT_MANAGER) return { ...item, path: '/pm/dashboard' };
        if (role === ROLES.ADMIN) return { ...item, path: '/admin/dashboard' };
        if (role === ROLES.VENDOR) return { ...item, path: '/vendors' };
        if (role === ROLES.DEPARTMENT_HEAD) return { ...item, path: '/dept-head/dashboard' };
        if (role === ROLES.DIVISIONAL_HEAD) return { ...item, path: '/div-head/dashboard' };
      }

      if (item.name === 'Messages') {
        if (role === ROLES.ADMIN) return { ...item, path: '/admin/messages' };
        if (role === ROLES.DEPARTMENT_HEAD) return { ...item, path: '/dept-head/messages' };
        if (role === ROLES.DIVISIONAL_HEAD) return { ...item, path: '/div-head/messages' };
        if ([ROLES.PROJECT_MANAGER, ROLES.VENDOR].includes(role)) {
          return { ...item, path: '/pm/messages' };
        }
      }

      if (item.name === 'Rate Cards') {
        if (role === ROLES.PROJECT_MANAGER) return { ...item, path: '/pm/rate-cards' };
        if (role === ROLES.VENDOR) return { ...item, path: '/vendor/ratecards' };
        // Dept Head and Div Head use the PM rate card view (read-only hierarchy view)
        if (role === ROLES.DEPARTMENT_HEAD || role === ROLES.DIVISIONAL_HEAD)
          return { ...item, path: '/pm/rate-cards' };
      }

      if (item.name === 'Approvals') {
        if (role === ROLES.ADMIN) return { ...item, path: '/approvals' };
      }
    }

    return item;
  });

  const filteredMenuItems = dynamicMenuItems.filter(item => canSeeMenuItem(user, item.name));

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "flex-col h-screen sticky top-0 z-50 pt-6 pb-6 transition-[width,transform] duration-300 ease-in-out",
          // Desktop styles
          "hidden lg:flex pl-6 pr-0",
          !mobileOpen && (collapsed ? "w-22" : "w-72"),
          // Mobile Styles (Drawer mode)
          mobileOpen ? "flex! fixed inset-y-0 left-0 w-[280px] sx:w-80 p-4 lg:p-6 bg-slate-50/10 dark:bg-slate-950/20 backdrop-blur-xl" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="glass-panel h-full rounded-3xl flex flex-col justify-between overflow-hidden p-3 relative border border-white/20 dark:border-white/8 shadow-xl bg-white/80 dark:bg-slate-900/80">

          {/* Brand + Toggle */}
          <div className={clsx("shrink-0 min-h-18 mb-4 relative z-10 flex items-center", collapsed ? "flex-col justify-center gap-2" : "flex-row justify-between gap-2 px-2")}>
            <Link href="/dashboard" className={clsx("flex items-center gap-3 min-w-0", collapsed && "justify-center")}>
              <div className="w-11 h-11 shrink-0 rounded-xl bg-linear-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 ring-1 ring-black/5">
                <Icon name="Zap" className="text-white shrink-0" size={26} strokeWidth={2.5} />
              </div>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-primary to-accent whitespace-nowrap overflow-hidden"
                  >
                    InvoiceFlow
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            {/* Desktop Collapse Button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden lg:block shrink-0 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon name={collapsed ? "PanelRightOpen" : "PanelLeftClose"} size={20} />
            </button>
            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden shrink-0 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-error hover:bg-error/10 transition-colors"
            >
              <Icon name="X" size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto overflow-x-hidden pr-1 scrollbar-hide">
            {filteredMenuItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="block relative group"
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.name : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <div
                    className={clsx(
                      "relative flex items-center rounded-xl transition-colors duration-200",
                      collapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3",
                      isActive
                        ? "text-primary font-semibold"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/30 dark:hover:bg-white/5"
                    )}
                  >
                    <Icon
                      name={item.icon}
                      size={22}
                      className={clsx("shrink-0", isActive ? "text-primary" : "text-gray-400 dark:text-gray-500 group-hover:text-primary transition-colors")}
                    />
                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="truncate flex-1"
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {!collapsed && item.name === 'Messages' && unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-error text-white text-[9px] font-black rounded-lg ml-auto">
                        {unreadCount}
                      </span>
                    )}
                    {!collapsed && item.name === 'Re-check Requests' && recheckUnreadCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-lg ml-auto animate-pulse">
                        {recheckUnreadCount}
                      </span>
                    )}
                    {!collapsed && isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                      />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer: Version + Online Status */}
          <div className="shrink-0 mt-auto pt-4 border-t border-gray-200/30 dark:border-gray-700/30">
            <div className={clsx("flex items-center", collapsed ? "flex-col gap-2 px-0" : "justify-between px-2 gap-2")}>
              {!collapsed && <span className="text-xs font-mono text-gray-400 dark:text-gray-500">v{APP_VERSION}</span>}
              <div className="w-2 h-2 rounded-full bg-success/60 animate-pulse shrink-0" title="System Online" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;