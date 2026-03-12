"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Icon from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ROLES } from "@/constants/roles";

export default function LoginPage() {
    const { login, setAuth, isLoading: authLoading } = useAuth();
    const router = useRouter(); // Helper to redirect after OTP login
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false); // Local loading state for OTP actions

    // OTP State
    const [isOtpMode, setIsOtpMode] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [otpTimer, setOtpTimer] = useState(0);

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());

    const handleSendOtp = async (e) => {
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
                setOtpSent(true);
                setOtpTimer(60); // 60s cooldown
                const timer = setInterval(() => {
                    setOtpTimer((prev) => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                setError(data.error || "Failed to send OTP");
            }
        } catch (err) {
            setError("An error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError("");

        if (!otpCode) {
            setError("Please enter the OTP");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), otp: otpCode })
            });
            const data = await res.json();

            if (res.ok && data.user) {
                // Update AuthContext state immediately with the user data
                setAuth(data.user);

                // Log OTP verification success
                console.log(`[OTP Login] Verification successful for user: ${data.user.email}, role: ${data.user.role}`);

                // Success! Redirect based on role
                router.push(data.user?.role === ROLES.VENDOR ? "/vendors" : "/dashboard");
            } else {
                // Log OTP verification failure for debugging
                console.error(`[OTP Login] Verification failed:`, data);
                setError(data.error || "Invalid OTP");
            }
        } catch (err) {
            setError("Verification failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (isOtpMode) {
            if (!otpSent) return handleSendOtp(e);
            return handleVerifyOtp(e);
        }

        // Standard Password Login
        if (!email || !password) {
            setError("Please fill in all fields");
            return;
        }
        if (!isValidEmail(email)) {
            setError("Please enter a valid email address");
            return;
        }

        try {
            await login(email.trim(), password);
        } catch (err) {
            setError(err.message || "Login failed. Please try again.");
        }
    };

    const toggleMode = () => {
        setIsOtpMode(!isOtpMode);
        setError("");
        setOtpSent(false);
        setOtpCode("");
    };

    const loadingState = isLoading || authLoading;

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
                            <Icon name="Zap" className="text-white" size={32} />
                        </div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-primary to-accent">
                            Welcome Back
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">Sign in to InvoiceFlow</p>
                    </div>

                    <div className="flex bg-gray-100/50 dark:bg-slate-800/40 p-1 rounded-xl mb-6">
                        <button
                            type="button"
                            onClick={() => !loadingState && !otpSent && isOtpMode && toggleMode()}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${!isOtpMode ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100'}`}
                            disabled={loadingState || otpSent}
                        >
                            Password
                        </button>
                        <button
                            type="button"
                            onClick={() => !loadingState && !isOtpMode && toggleMode()}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${isOtpMode ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100'}`}
                            disabled={loadingState}
                        >
                            One-Time Code
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-error/10 text-error text-sm p-3 rounded-xl text-center font-medium">
                                <p>{error}</p>
                            </div>
                        )}

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
                                    disabled={loadingState || (isOtpMode && otpSent)}
                                />
                            </div>
                        </div>

                        {!isOtpMode ? (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">Password</label>
                                    <Link href="/forgot-password" size="sm" className="text-xs text-primary font-bold hover:underline">
                                        Forgot Password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Icon name="Lock" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="input w-full pl-11 pr-11 bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all text-slate-900 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                                        placeholder="••••••••"
                                        disabled={loadingState}
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
                        ) : (
                            otpSent && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 ml-1">One-Time Code</label>
                                        {otpTimer > 0 ? (
                                            <span className="text-xs text-slate-400 dark:text-slate-600 font-mono">Resend in {otpTimer}s</span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleSendOtp}
                                                className="text-xs text-primary font-bold hover:underline"
                                            >
                                                Resend Code
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Icon name="Key" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                                        <input
                                            type="text"
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="input w-full pl-11 bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all text-slate-900 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-400 tracking-widest font-mono text-lg"
                                            placeholder="123456"
                                            disabled={loadingState}
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2">
                                        Sent to <span className="font-semibold">{email}</span>. <button type="button" onClick={() => { setOtpSent(false); setOtpCode(""); }} className="text-primary hover:underline">Change?</button>
                                    </p>
                                </div>
                            )
                        )}

                        <button
                            type="submit"
                            disabled={loadingState}
                            className="btn btn-primary w-full text-white rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all transform hover:scale-[1.02]"
                        >
                            {loadingState ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : isOtpMode ? (
                                otpSent ? "Verify & Sign In" : "Send One-Time Code"
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Don't have an account?{" "}
                            <Link href="/signup" className="text-primary font-bold hover:underline">
                                Sign up
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
