"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROLES } from "@/constants/roles";
import { startVersionCheck, autoUpdateOnVersionChange } from "@/lib/version";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const router = useRouter();

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/me', {
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });

                if (!res.ok) {
                    // Start fresh if auth check fails
                    console.log("Auth checks failed:", res.status, res.statusText);
                    setUser(null);
                    return;
                }

                const contentType = res.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const data = await res.json();
                    if (data.user) {
                        setUser(data.user);
                    } else {
                        setUser(null);
                    }
                } else {
                    console.error("Received non-JSON response from /api/auth/me");
                    setUser(null);
                }
            } catch (error) {
                console.error("Session check failed", error);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();

        // Defer first version check so fetch has a valid origin (avoids "Failed to fetch" on fast load)
        const versionCheckTimer = setTimeout(() => {
            autoUpdateOnVersionChange();
        }, 500);

        // Continue periodic checks (uses default 30s interval from startVersionCheck)
        const cleanup = startVersionCheck();
        return () => {
            clearTimeout(versionCheckTimer);
            cleanup?.();
        };
    }, []);

    const login = async (email, password) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            setUser(data.user);
            router.push(data.user?.role === ROLES.VENDOR ? "/vendors" : "/dashboard");
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const signup = async (name, email, password, role = ROLES.FINANCE_USER, pmId = null) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role, pmId }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Signup failed');
            }

            setUser(data.user);
            router.push(data.user?.role === ROLES.VENDOR ? "/vendors" : "/dashboard");
        } catch (error) {
            console.error("Signup failed", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        // Trigger premium logout UI
        setIsLoggingOut(true);

        // Short delay to allow overlay to fade in and feel "premium"
        setTimeout(() => {
            if (typeof window !== 'undefined') {
                window.location.href = "/login";
            }
        }, 800);

        // Fire logout API in background
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
            .catch(error => console.error("Logout API error:", error));
    };

    const switchRole = (newRole) => {
        if (!user) return;
        const updatedUser = { ...user, role: newRole };
        setUser(updatedUser);
        // Optional: Update localStorage if we want it to persist across soft reloads, 
        // but typically role switching is a temporary admin action.
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, logout, switchRole, setAuth: setUser, isLoading, isLoggingOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
