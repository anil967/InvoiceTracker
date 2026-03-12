'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROLES, ROLES_LIST } from '@/constants/roles';
import Card from '@/components/ui/Card';
import Icon from '@/components/Icon';

// ─── DESIGN TOKENS (light theme, matching app design) ───────────
const ROLE_CONFIG = {
    [ROLES.ADMIN]: {
        gradient: 'from-violet-500 to-indigo-600',
        bg: 'bg-violet-50',
        text: 'text-violet-700',
        border: 'border-violet-200',
        dot: 'bg-violet-500',
        avatarBg: 'bg-linear-to-r from-violet-500 to-indigo-600',
        shadow: 'shadow-violet-200',
        icon: 'Shield',
        label: 'Admin',
        level: 0,
    },
    [ROLES.DIVISIONAL_HEAD]: {
        gradient: 'from-indigo-500 to-blue-600',
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
        dot: 'bg-indigo-500',
        avatarBg: 'bg-linear-to-r from-indigo-500 to-blue-600',
        shadow: 'shadow-indigo-200',
        icon: 'BadgeCheck',
        label: 'Divisional Head',
        level: 1,
    },
    [ROLES.DEPARTMENT_HEAD]: {
        gradient: 'from-teal-500 to-emerald-600',
        bg: 'bg-teal-50',
        text: 'text-teal-700',
        border: 'border-teal-200',
        dot: 'bg-teal-500',
        avatarBg: 'bg-linear-to-r from-teal-500 to-emerald-600',
        shadow: 'shadow-teal-200',
        icon: 'Building2',
        label: 'Department Head',
        level: 2,
    },
    [ROLES.PROJECT_MANAGER]: {
        gradient: 'from-blue-500 to-cyan-600',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
        avatarBg: 'bg-linear-to-r from-blue-500 to-cyan-600',
        shadow: 'shadow-blue-200',
        icon: 'ClipboardCheck',
        label: 'Project Manager',
        level: 3,
    },
    [ROLES.VENDOR]: {
        gradient: 'from-amber-500 to-orange-500',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        avatarBg: 'bg-linear-to-r from-amber-500 to-orange-500',
        shadow: 'shadow-amber-200',
        icon: 'Store',
        label: 'Vendor',
        level: 4,
    },
};

const PARENT_ROLE_MAP = {
    [ROLES.DIVISIONAL_HEAD]: [ROLES.ADMIN],
    [ROLES.DEPARTMENT_HEAD]: [ROLES.DIVISIONAL_HEAD, ROLES.ADMIN],
    [ROLES.PROJECT_MANAGER]: [ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD, ROLES.ADMIN],
    [ROLES.VENDOR]: [ROLES.PROJECT_MANAGER],
};

const CHILD_ROLE_MAP = {
    [ROLES.ADMIN]: [ROLES.DIVISIONAL_HEAD],
    [ROLES.DIVISIONAL_HEAD]: [ROLES.DEPARTMENT_HEAD],
    [ROLES.DEPARTMENT_HEAD]: [ROLES.PROJECT_MANAGER],
    [ROLES.PROJECT_MANAGER]: [ROLES.VENDOR],
};

const HIERARCHY_ORDER = [ROLES.ADMIN, ROLES.DIVISIONAL_HEAD, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER, ROLES.VENDOR];

const fadeUp = {
    hidden: { opacity: 0, y: 18 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
    }),
};

// ─── AVATAR ─────────────────────────────────────────────────────
function Avatar({ name, role, size = 'md' }) {
    const config = ROLE_CONFIG[role] || {};
    const initials = (name || '?')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const sizeClasses = { sm: 'w-8 h-8 text-[10px]', md: 'w-10 h-10 text-xs', lg: 'w-12 h-12 text-sm' };

    return (
        <div
            className={`${sizeClasses[size]} ${config.avatarBg || 'bg-gray-400'} rounded-xl flex items-center justify-center text-white font-bold shadow-md shrink-0`}
        >
            {initials}
        </div>
    );
}

// ─── ROLE BADGE ─────────────────────────────────────────────────
function RoleBadge({ role }) {
    const config = ROLE_CONFIG[role] || {};
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${config.bg} ${config.text} ${config.border} border`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label || role}
        </span>
    );
}

// ─── TREE NODE ──────────────────────────────────────────────────
function TreeNode({ node, depth = 0, onOpenAssign, onUnassign, isLast = false }) {
    const [expanded, setExpanded] = useState(true);
    const config = ROLE_CONFIG[node.role] || {
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
    };
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className={`relative ${depth > 0 ? 'ml-8 md:ml-10' : ''}`}>
            {/* Connector lines */}
            {depth > 0 && (
                <>
                    <div
                        className="absolute -left-5 top-0 w-0.5 bg-slate-200 rounded-full"
                        style={{ height: isLast ? '28px' : 'calc(100% + 4px)' }}
                    />
                    <div className="absolute -left-5 top-[28px] h-0.5 w-5 bg-slate-200 rounded-full" />
                </>
            )}

            {/* Node card */}
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: depth * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border bg-white mb-2 group transition-all duration-200 hover:shadow-md ${config.border} hover:${config.border}`}
            >
                {/* Expand / Collapse or avatar */}
                {hasChildren ? (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 shrink-0 ${expanded
                            ? `${config.avatarBg} text-white shadow-md`
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                    >
                        <Icon name={expanded ? 'ChevronDown' : 'ChevronRight'} size={14} />
                    </button>
                ) : (
                    <Avatar name={node.name} role={node.role} size="sm" />
                )}

                {/* User info */}
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 truncate leading-tight">{node.name}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{node.email}</div>
                </div>

                {/* Role badge */}
                <RoleBadge role={node.role} />

                {/* Status dot */}
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    {node.isActive !== false && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-30" />
                    )}
                    <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${node.isActive !== false ? 'bg-emerald-400' : 'bg-red-400'
                            }`}
                    />
                </span>

                {/* Actions (show on hover) */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {CHILD_ROLE_MAP[node.role] && (
                        <button
                            onClick={() => onOpenAssign(node)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                            title={`Add ${CHILD_ROLE_MAP[node.role].map((r) => ROLE_CONFIG[r]?.label || r).join('/')}`}
                        >
                            <Icon name="Plus" size={14} />
                        </button>
                    )}
                    {node.role !== ROLES.ADMIN && (
                        <button
                            onClick={() => onOpenAssign(node)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Manage"
                        >
                            <Icon name="Settings" size={14} />
                        </button>
                    )}
                    {node.role !== ROLES.ADMIN && node.managedBy && (
                        <button
                            onClick={() => onUnassign(node.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Remove from manager"
                        >
                            <Icon name="X" size={14} />
                        </button>
                    )}
                </div>
            </motion.div>

            {/* Children */}
            <AnimatePresence>
                {expanded && hasChildren && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                        {node.children.map((child, i) => (
                            <TreeNode
                                key={child.id}
                                node={child}
                                depth={depth + 1}
                                onOpenAssign={onOpenAssign}
                                onUnassign={onUnassign}
                                isLast={i === node.children.length - 1}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────
export default function HierarchyPage() {
    const [tree, setTree] = useState([]);
    const [unassigned, setUnassigned] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [assignModal, setAssignModal] = useState(null);
    const [selectedParent, setSelectedParent] = useState('');
    const [selectedChildren, setSelectedChildren] = useState([]);

    const fetchHierarchy = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/hierarchy', { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch');
            setTree(data.tree || []);
            setUnassigned(data.unassigned || []);
            setAllUsers(data.allUsers || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHierarchy();
    }, [fetchHierarchy]);

    const openAssignModal = (node) => {
        setSelectedParent(node.managedBy || '');
        const currentChildren = allUsers.filter((u) => u.managedBy === node.id).map((u) => u.id);
        setSelectedChildren(currentChildren);
        setAssignModal(node);
    };

    const handleSaveAssignment = async () => {
        if (!assignModal) return;
        try {
            const body = {
                userId: assignModal.id,
                managedBy: selectedParent || null,
                children: selectedChildren,
            };
            const res = await fetch('/api/admin/hierarchy', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            setSuccess(`Hierarchy updated for ${assignModal.name}.`);
            setAssignModal(null);
            setSelectedParent('');
            setSelectedChildren([]);
            fetchHierarchy();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleUnassign = async (userId) => {
        try {
            const res = await fetch('/api/admin/hierarchy', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, managedBy: null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to unassign');
            setSuccess('User unassigned from manager.');
            fetchHierarchy();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const getValidParents = (role) => {
        const parentRoles = PARENT_ROLE_MAP[role];
        if (!parentRoles) return [];
        const rolesToMatch = Array.isArray(parentRoles) ? parentRoles : [parentRoles];
        return allUsers.filter(
            (u) => rolesToMatch.some((r) => r.toLowerCase() === u.role.toLowerCase()) && u.isActive !== false
        );
    };

    const getValidChildCandidates = (user) => {
        const childRoles = CHILD_ROLE_MAP[user.role];
        if (!childRoles) return [];
        return allUsers.filter(
            (u) =>
                childRoles.some((r) => r.toLowerCase() === u.role.toLowerCase()) &&
                u.isActive !== false &&
                u.id !== user.id
        );
    };

    const toggleChild = (childId) => {
        setSelectedChildren((prev) =>
            prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId]
        );
    };

    const getManagerName = (managedById) => {
        if (!managedById) return null;
        const manager = allUsers.find((u) => u.id === managedById);
        return manager ? `${manager.name} (${manager.role})` : null;
    };

    // Group unassigned by role, in hierarchy order
    const unassignedByRole = {};
    HIERARCHY_ORDER.forEach((role) => {
        const usersForRole = unassigned.filter((u) => u.role === role && u.role !== ROLES.ADMIN);
        if (usersForRole.length > 0) unassignedByRole[role] = usersForRole;
    });

    return (
        <div className="space-y-6 sm:space-y-8 pb-10 px-2 sm:px-4 lg:px-0">
            {/* ═══ HEADER ═══ */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
                        <Icon name="GitBranch" size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                            Organization Hierarchy
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                            Manage team structure and reporting relationships
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* ═══ HIERARCHY FLOW ═══ */}
            <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
                <Card className="p-0 overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                    <div className="p-4 sm:p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Icon name="ArrowDownUp" size={14} className="text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Reporting Chain
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {HIERARCHY_ORDER.map((role, i) => {
                                const conf = ROLE_CONFIG[role];
                                return (
                                    <div key={role} className="flex items-center gap-2 sm:gap-3">
                                        <div
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${conf.bg} ${conf.border} transition-transform hover:scale-[1.03]`}
                                        >
                                            <div
                                                className={`w-7 h-7 rounded-lg ${conf.avatarBg} flex items-center justify-center shadow-sm`}
                                            >
                                                <Icon name={conf.icon} size={14} className="text-white" />
                                            </div>
                                            <span className={`text-xs sm:text-sm font-semibold ${conf.text}`}>
                                                {conf.label}
                                            </span>
                                            <span
                                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${conf.bg} ${conf.text} border ${conf.border}`}
                                            >
                                                L{conf.level}
                                            </span>
                                        </div>
                                        {i < HIERARCHY_ORDER.length - 1 && (
                                            <Icon name="ChevronRight" size={16} className="text-slate-300" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* ═══ ALERTS ═══ */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        key="hierarchy-error"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-5 py-3.5 rounded-xl"
                    >
                        <Icon name="AlertCircle" size={18} className="shrink-0" />
                        <span className="flex-1 text-sm font-medium">{error}</span>
                        <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 transition-colors">
                            <Icon name="X" size={16} />
                        </button>
                    </motion.div>
                )}
                {success && (
                    <motion.div
                        key="hierarchy-success"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-3.5 rounded-xl"
                    >
                        <Icon name="CheckCircle" size={18} className="shrink-0" />
                        <span className="flex-1 text-sm font-medium">{success}</span>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* ═══ LOADING ═══ */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-28 text-slate-400">
                    <div className="w-10 h-10 border-[3px] border-violet-200 border-t-violet-500 rounded-full animate-spin mb-4" />
                    <span className="text-sm font-medium">Loading hierarchy...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
                    {/* ═══ TREE VIEW ═══ */}
                    <div className="xl:col-span-2">
                        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp}>
                            <Card className="p-0 overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                                {/* Header */}
                                <div className="p-4 sm:p-5 flex justify-between items-center bg-slate-50/80 border-b border-slate-100">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-50 to-violet-50 flex items-center justify-center border border-indigo-100/60">
                                            <Icon name="Users" size={16} className="text-indigo-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-sm sm:text-base text-slate-800">
                                                Hierarchy Tree
                                            </h2>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                {allUsers.length} member{allUsers.length !== 1 ? 's' : ''} across{' '}
                                                {HIERARCHY_ORDER.length} levels
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={fetchHierarchy}
                                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                        title="Refresh"
                                    >
                                        <Icon name="RefreshCw" size={16} />
                                    </button>
                                </div>

                                {/* Tree content */}
                                <div className="p-5 sm:p-6">
                                    {tree.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                                                <Icon name="Users" size={24} className="text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-500 mb-1">
                                                No hierarchy built yet
                                            </p>
                                            <p className="text-xs text-slate-300">
                                                Assign users to managers using the sidebar
                                            </p>
                                        </div>
                                    ) : (
                                        tree.map((root, i) => (
                                            <TreeNode
                                                key={root.id}
                                                node={root}
                                                onOpenAssign={openAssignModal}
                                                onUnassign={handleUnassign}
                                                isLast={i === tree.length - 1}
                                            />
                                        ))
                                    )}
                                </div>
                            </Card>
                        </motion.div>
                    </div>

                    {/* ═══ SIDEBAR ═══ */}
                    <div className="space-y-5">
                        {/* ── Stats ── */}
                        <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp}>
                            <div className="grid grid-cols-2 gap-3">
                                {HIERARCHY_ORDER.map((role, i) => {
                                    const count = allUsers.filter((u) => u.role === role).length;
                                    const conf = ROLE_CONFIG[role];
                                    return (
                                        <motion.div
                                            key={role}
                                            custom={i}
                                            initial="hidden"
                                            animate="visible"
                                            variants={fadeUp}
                                            className={`group relative rounded-2xl p-4 bg-linear-to-br ${conf.gradient} text-white overflow-hidden shadow-lg ${conf.shadow} hover:scale-[1.02] hover:shadow-xl transition-all duration-200`}
                                        >
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mt-4 -mr-4 blur-xl" />
                                            <div className="relative z-10">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">
                                                        {conf.label}
                                                    </p>
                                                    <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                                                        <Icon name={conf.icon} size={13} />
                                                    </div>
                                                </div>
                                                <p className="text-2xl font-black">{count}</p>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                            <div className="mt-3 flex items-center justify-between px-3 py-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                <span className="text-xs font-medium text-slate-400">Total Members</span>
                                <span className="text-sm font-black text-slate-800">{allUsers.length}</span>
                            </div>
                        </motion.div>

                        {/* ── Unassigned Users ── */}
                        <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp}>
                            <Card className="p-0 overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                                <div className="p-4 sm:p-5 flex items-center justify-between bg-slate-50/80 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                                            <Icon name="UserPlus" size={14} />
                                        </div>
                                        <h3 className="font-bold text-sm text-slate-800">
                                            Available for Assignment
                                        </h3>
                                    </div>
                                    {Object.keys(unassignedByRole).length > 0 && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                                            {unassigned.length}
                                        </span>
                                    )}
                                </div>
                                <div className="p-4">
                                    {Object.keys(unassignedByRole).length === 0 ? (
                                        <div className="flex flex-col items-center py-8 text-slate-400">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-2">
                                                <Icon name="CheckCircle2" size={20} className="text-emerald-500" />
                                            </div>
                                            <p className="text-xs font-medium text-slate-500">
                                                All users assigned!
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {Object.entries(unassignedByRole).map(([role, users]) => {
                                                const conf = ROLE_CONFIG[role] || {};
                                                return (
                                                    <div key={role}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Icon
                                                                name={conf.icon}
                                                                size={12}
                                                                className={conf.text}
                                                            />
                                                            <h4
                                                                className={`text-[10px] font-bold ${conf.text} uppercase tracking-widest`}
                                                            >
                                                                {conf.label}s
                                                            </h4>
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                ({users.length})
                                                            </span>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {users.map((u) => (
                                                                <div
                                                                    key={u.id}
                                                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${conf.bg} border ${conf.border} hover:shadow-sm transition-all`}
                                                                >
                                                                    <Avatar
                                                                        name={u.name}
                                                                        role={u.role}
                                                                        size="sm"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-sm font-semibold text-slate-700 truncate">
                                                                            {u.name}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 truncate">
                                                                            {u.email}
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => openAssignModal(u)}
                                                                        className={`shrink-0 px-3 py-1.5 text-[10px] font-bold rounded-lg text-white shadow-sm hover:shadow-md transition-all bg-linear-to-r ${conf.gradient}`}
                                                                    >
                                                                        Assign
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            )}

            {/* ═══ ASSIGNMENT MODAL ═══ */}
            <AnimatePresence>
                {assignModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => {
                            setAssignModal(null);
                            setSelectedParent('');
                            setSelectedChildren([]);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
                                <Avatar name={assignModal.name} role={assignModal.role} size="lg" />
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg font-black text-slate-800 truncate">
                                        Manage {assignModal.name}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <RoleBadge role={assignModal.role} />
                                        <span className="text-[10px] text-slate-400 truncate">
                                            {assignModal.email}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setAssignModal(null);
                                        setSelectedParent('');
                                        setSelectedChildren([]);
                                    }}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                >
                                    <Icon name="X" size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {CHILD_ROLE_MAP[assignModal.role] &&
                                    (() => {
                                        const childRoles = CHILD_ROLE_MAP[assignModal.role];
                                        const candidates = getValidChildCandidates(assignModal);

                                        return (
                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Icon name="UserPlus" size={16} className="text-emerald-600" />
                                                    <h3 className="text-sm font-bold text-slate-800">
                                                        Assign Subordinates
                                                    </h3>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        (
                                                        {childRoles
                                                            .map((r) => ROLE_CONFIG[r]?.label || r)
                                                            .join(', ')}
                                                        )
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mb-3">
                                                    Select who reports directly to{' '}
                                                    <span className="font-semibold text-slate-600">
                                                        {assignModal.name}
                                                    </span>
                                                </p>

                                                {candidates.length === 0 ? (
                                                    <p className="text-xs text-slate-400 italic py-6 text-center">
                                                        No available candidates
                                                    </p>
                                                ) : (
                                                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                                        {candidates.map((c) => {
                                                            const isSelected = selectedChildren.includes(c.id);
                                                            const cConf = ROLE_CONFIG[c.role] || {};
                                                            const currentManager = getManagerName(c.managedBy);
                                                            const isOtherManager =
                                                                c.managedBy && c.managedBy !== assignModal.id;

                                                            return (
                                                                <label
                                                                    key={c.id}
                                                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-all ${isSelected
                                                                        ? `${cConf.bg} ${cConf.border} ring-1 ring-offset-1 ring-${cConf.dot?.replace('bg-', '')}`
                                                                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                                                                        }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => toggleChild(c.id)}
                                                                        className="w-4 h-4 rounded border-slate-300 text-violet-500 focus:ring-violet-500/40 focus:ring-offset-0"
                                                                    />
                                                                    <Avatar
                                                                        name={c.name}
                                                                        role={c.role}
                                                                        size="sm"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div
                                                                            className={`text-sm font-semibold ${isSelected ? cConf.text : 'text-slate-700'
                                                                                } truncate`}
                                                                        >
                                                                            {c.name}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 truncate">
                                                                            {c.email}
                                                                            {isOtherManager && (
                                                                                <span className="ml-1 text-amber-500 font-medium">
                                                                                    · Under {currentManager}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <RoleBadge role={c.role} />
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5">
                                                    <Icon name="CheckCircle" size={12} className="text-emerald-500" />
                                                    {selectedChildren.length} selected
                                                </div>
                                            </div>
                                        );
                                    })()}
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50/50">
                                <button
                                    onClick={() => {
                                        setAssignModal(null);
                                        setSelectedParent('');
                                        setSelectedChildren([]);
                                    }}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all text-sm font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveAssignment}
                                    className="flex-1 px-4 py-2.5 bg-linear-to-r from-violet-500 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-violet-600 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
