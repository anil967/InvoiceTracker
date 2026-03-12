"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ theme: "light", setTheme: () => {} });

const STORAGE_KEY = "invoiceflow-vendor-theme";

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState("light");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const value = stored === "dark" || stored === "light" ? stored : "light";
        setThemeState(value);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {}
    }, [theme, mounted]);

    const setTheme = (value) => setThemeState(value === "dark" ? "dark" : "light");
    const toggleTheme = () => setThemeState((t) => (t === "dark" ? "light" : "dark"));

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            <div data-theme={theme} className={theme === "dark" ? "dark" : ""}>
                {children}
            </div>
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) return { theme: "light", setTheme: () => {}, toggleTheme: () => {} };
    return ctx;
}
