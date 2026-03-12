"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/Icon";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // UI Stages: 'EMAIL' (enter email) -> 'RESET' (enter OTP and new password)
    const [stage, setStage] = useState('EMAIL');
    const [otpTimer, setOtpTimer] = useState(0);

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());

    useEffect(() => {
        let timer;
        if (otpTimer > 0) {
            timer = setInterval(() => {
                setOtpTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [otpTimer]);

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setError("");

        if (!email) {
            setError("Please enter your email address");
            return;
        }
        if (!isValidEmail(email)) {
            setError("Please enter a valid email address");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/otp/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() })
            });
            const data = await res.json();

            if (res.ok) {
                setStage('RESET');
                setOtpTimer(60);
                setSuccess("A verification code has been sent to your email.");
            } else {
                setError(data.error || "Failed to send reset code");
            }
        } catch (err) {
            setError("An error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!otp || !newPassword || !confirmPassword) {
            setError("Please fill in all fields");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/password/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    otp: otp.trim(),
                    newPassword
                })
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess("Password reset successful! Redirecting to login...");
                setTimeout(() => {
                    router.push("/login?reset=success");
                }, 2000);
            } else {
                setError(data.error || "Reset failed. Please check your code.");
            }
        } catch (err) {
            setError("An error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#F8F9FC] dark:bg-slate-900">
            {/* Dynamic Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-200/30 dark:bg-blue-900/20 rounded-full blur-[120px] animate-pulse delay-1000" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md p-8"
            >
                <div className="glass-panel p-8 rounded-3xl shadow-2xl border border-white/50 dark:border-slate-700/50 backdrop-blur-xl bg-white/40 dark:bg-slate-800/60">

                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-tr from-primary to-accent mb-4 shadow-lg shadow-primary/30">
                            <Icon name="Lock" className="text-white" size={32} />
                        </div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-primary to-accent">
                            {stage === 'EMAIL' ? 'Forgot Password?' : 'Reset Password'}
                        </h1>
                        <p className="text-gray-500 dark:text-slate-400 mt-2">
                            {stage === 'EMAIL'
                                ? 'No worries, we\'ll send you reset instructions.'
                                : 'Enter the code sent to your email.'}
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {stage === 'EMAIL' ? (
                            <motion.form
                                key="email-form"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleRequestOtp}
                                className="space-y-6"
                            >
                                {error && (
                                    <div className="bg-error/10 text-error text-sm p-3 rounded-xl text-center font-medium">
                                        <p>{error}</p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-900 dark:text-slate-50 ml-1">Email</label>
                                    <div className="relative">
                                        <Icon name="Mail" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="input w-full pl-11 bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all text-gray-900 dark:text-slate-50 placeholder:text-gray-500 dark:placeholder:text-slate-400"
                                            placeholder="name@company.com"
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="btn btn-primary w-full text-white rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all transform hover:scale-[1.02]"
                                >
                                    {isLoading ? <span className="loading loading-spinner loading-sm"></span> : "Send Reset Code"}
                                </button>

                                <div className="text-center">
                                    <Link href="/login" className="text-sm text-primary font-bold hover:underline inline-flex items-center gap-2">
                                        <Icon name="ArrowLeft" size={14} /> Back to Sign In
                                    </Link>
                                </div>
                            </motion.form>
                        ) : (
                            <motion.form
                                key="reset-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleResetPassword}
                                className="space-y-4"
                            >
                                {error && (
                                    <div className="bg-error/10 text-error text-sm p-3 rounded-xl text-center font-medium">
                                        <p>{error}</p>
                                    </div>
                                )}
                                {success && (
                                    <div className="bg-green-100/50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm p-3 rounded-xl text-center font-medium">
                                        <p>{success}</p>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-gray-900 dark:text-slate-50 ml-1">Reset Code</label>
                                        {otpTimer > 0 ? (
                                            <span className="text-xs text-gray-400 dark:text-slate-600">Resend in {otpTimer}s</span>
                                        ) : (
                                            <button type="button" onClick={handleRequestOtp} className="text-xs text-primary font-bold hover:underline">
                                                Resend
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Icon name="Key" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400" />
                                        <input
                                            type="text"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="input w-full pl-11 bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all text-gray-900 dark:text-slate-50 placeholder:text-gray-500 dark:placeholder:text-slate-400 tracking-widest font-mono"
                                            placeholder="123456"
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-900 dark:text-slate-50 ml-1">New Password</label>
                                    <div className="relative">
                                        <Icon name="Lock" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400" />
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="input w-full pl-11 bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all text-gray-900 dark:text-slate-50 placeholder:text-gray-500 dark:placeholder:text-slate-400"
                                            placeholder="••••••••"
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-900 dark:text-slate-50 ml-1">Confirm New Password</label>
                                    <div className="relative">
                                        <Icon name="Lock" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400" />
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="input w-full pl-11 bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all text-gray-900 dark:text-slate-50 placeholder:text-gray-500 dark:placeholder:text-slate-400"
                                            placeholder="••••••••"
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="btn btn-primary w-full text-white rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all transform hover:scale-[1.02] mt-2"
                                >
                                    {isLoading ? <span className="loading loading-spinner loading-sm"></span> : "Reset Password"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setStage('EMAIL')}
                                    className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 block mx-auto py-1"
                                >
                                    Change Email?
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                            Remembered your password?{" "}
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
