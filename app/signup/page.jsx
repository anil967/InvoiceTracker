"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Icon from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/constants/roles";

export default function SignupPage() {
    const { signup, isLoading } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [role] = useState(ROLES.VENDOR);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!name || !email || !password) {
            setError("Please fill in all fields");
            return;
        }

        try {
            await signup(name, email, password, role);
        } catch (err) {
            setError(err.message || "Failed to create account");
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#F8F9FC] dark:bg-slate-900">
            {/* Dynamic Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-200/30 dark:bg-blue-900/20 rounded-full blur-[120px] animate-pulse delay-1000" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md p-8"
            >
                <div className="glass-panel p-8 rounded-3xl shadow-2xl border border-white/50 dark:border-slate-700/50 backdrop-blur-xl bg-white/40 dark:bg-slate-800/60">

                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-primary to-accent">
                            Create Account
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">Join InvoiceFlow today</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-error/10 text-error text-sm p-3 rounded-xl text-center font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 ml-1">Full Name</label>
                            <div className="relative">
                                <Icon name="User" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="input w-full pl-11 bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all text-slate-900 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 ml-1">Email</label>
                            <div className="relative">
                                <Icon name="Mail" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input w-full pl-11 bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all text-slate-900 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 ml-1">Password</label>
                            <div className="relative">
                                <Icon name="Lock" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input w-full pl-11 pr-11 bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all text-slate-900 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                                    placeholder="Create a strong password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    tabIndex={-1}
                                >
                                    <Icon name={showPassword ? "EyeOff" : "Eye"} size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-100 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
                            <p className="flex gap-2">
                                <Icon name="Info" size={18} className="shrink-0 mt-0.5" />
                                <span>
                                    You will be signed up as a <strong>Vendor</strong>. Project Manager and Finance User accounts require Admin approval.
                                </span>
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn btn-primary w-full text-white rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all transform hover:scale-[1.02] mt-2"
                        >
                            {isLoading ? <span className="loading loading-spinner loading-sm"></span> : "Sign Up"}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Already have an account?{" "}
                            <Link href="/login" className="text-primary font-bold hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
