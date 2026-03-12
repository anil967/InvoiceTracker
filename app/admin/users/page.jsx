'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROLES, ROLES_LIST } from '@/constants/roles';

export default function UserManagementPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: ROLES.FINANCE_USER,
        department: '',
        managedBy: ''
    });

    const [projects, setProjects] = useState([]);
    const [managers, setManagers] = useState([]); // Potential managers for the selected role

    useEffect(() => {
        fetchUsers();
        fetchProjects();
    }, [filterRole, filterStatus, searchTerm]);

    // Fetch potential managers when role changes
    useEffect(() => {
        const managerRoleMap = {
            [ROLES.FINANCE_USER]: ROLES.ADMIN,
            [ROLES.PROJECT_MANAGER]: ROLES.FINANCE_USER,
            [ROLES.VENDOR]: ROLES.PROJECT_MANAGER
        };
        const managerRole = managerRoleMap[formData.role];
        if (managerRole && (showCreateModal || editingUser)) {
            const filtered = users.filter(u => u.role === managerRole && u.isActive !== false);
            setManagers(filtered);
        } else {
            setManagers([]);
        }
    }, [formData.role, users, showCreateModal, editingUser]);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/admin/projects', { cache: 'no-store' });
            const data = await res.json();
            if (res.ok) setProjects(data.projects || []);
        } catch (err) {
            console.error('Error fetching projects:', err);
        }
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterRole) params.set('role', filterRole);
            if (filterStatus) params.set('status', filterStatus);
            if (searchTerm) params.set('search', searchTerm);
            const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json();
            if (res.ok) {
                setUsers(data.users || []);
            } else {
                setError(data.error || 'Failed to fetch users');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setShowCreateModal(false);
            setFormData({ name: '', email: '', password: '', role: ROLES.FINANCE_USER, department: '', managedBy: '' });
            fetchUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/admin/users/${editingUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setEditingUser(null);
            fetchUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleToggleStatus = async (user) => {
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !user.isActive })
            });
            if (!res.ok) throw new Error('Failed to update status');
            fetchUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    const openEditModal = (user) => {
        setFormData({
            name: user.name,
            email: user.email,
            password: '',
            role: user.role,
            department: user.department || '',
            managedBy: user.managedBy || ''
        });
        setEditingUser(user);
    };

    // Helper to find manager name
    const getManagerName = (managedById) => {
        if (!managedById) return null;
        const manager = users.find(u => u.id === managedById);
        return manager ? manager.name : null;
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
                    <p className="text-gray-400">Create, edit, and manage system users</p>
                </motion.div>

                {/* Filters & Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/10"
                >
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex flex-wrap gap-4">
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">All Roles</option>
                                {ROLES_LIST.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <button
                            onClick={() => {
                                setFormData({ name: '', email: '', password: '', role: ROLES.FINANCE_USER, department: '', managedBy: '' });
                                setShowCreateModal(true);
                            }}
                            className="px-6 py-2 bg-linear-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/25"
                        >
                            + Create User
                        </button>
                    </div>
                </motion.div>

                {/* Error Display */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6"
                        >
                            {error}
                            <button onClick={() => setError(null)} className="float-right">×</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Users Table */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
                >
                    {loading ? (
                        <div className="p-12 text-center text-gray-400">Loading users...</div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase">Role</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase">Managed By</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {users.map((user, idx) => (
                                    <motion.tr
                                        key={user.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4 text-white font-medium">{user.name}</td>
                                        <td className="px-6 py-4 text-gray-300">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.role === 'Admin' ? 'bg-purple-500/20 text-purple-300' :
                                                user.role === 'PM' ? 'bg-blue-500/20 text-blue-300' :
                                                    user.role === 'Finance User' ? 'bg-green-500/20 text-green-300' :
                                                        'bg-orange-500/20 text-orange-300'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300 text-sm">
                                            {getManagerName(user.managedBy) || <span className="text-gray-500 italic">—</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.isActive !== false ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                                                }`}>
                                                {user.isActive !== false ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 hover:underline"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(user)}
                                                    className={`px-3 py-1 text-sm ${user.isActive !== false ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'
                                                        } hover:underline`}
                                                >
                                                    {user.isActive !== false ? 'Deactivate' : 'Activate'}
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {!loading && users.length === 0 && (
                        <div className="p-12 text-center text-gray-400">No users found</div>
                    )}
                </motion.div>

                {/* Create/Edit Modal */}
                <AnimatePresence>
                    {(showCreateModal || editingUser) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto"
                            onClick={() => { setShowCreateModal(false); setEditingUser(null); }}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-slate-800/90 backdrop-blur-xl rounded-2xl p-8 w-full max-w-md border border-white/20 my-8"
                            >
                                <h2 className="text-2xl font-bold text-white mb-6">
                                    {editingUser ? 'Edit User' : 'Create New User'}
                                </h2>
                                <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                            disabled={!!editingUser}
                                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required={!editingUser}
                                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        >
                                            {ROLES_LIST.map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Manager dropdown (for non-Admin roles) */}
                                    {formData.role !== ROLES.ADMIN && managers.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-1">Manager</label>
                                            <select
                                                value={formData.managedBy}
                                                onChange={(e) => setFormData({ ...formData, managedBy: e.target.value })}
                                                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="">-- No manager --</option>
                                                {managers.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-gray-400 mt-1 italic">
                                                {formData.role === ROLES.FINANCE_USER && 'Finance Users are managed by Admins'}
                                                {formData.role === ROLES.PROJECT_MANAGER && 'PMs are managed by Finance Users'}
                                                {formData.role === ROLES.VENDOR && 'Vendors are managed by PMs'}
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Department</label>
                                        <input
                                            type="text"
                                            value={formData.department}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => { setShowCreateModal(false); setEditingUser(null); }}
                                            className="flex-1 px-4 py-2 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2 bg-linear-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
                                        >
                                            {editingUser ? 'Update' : 'Create'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
