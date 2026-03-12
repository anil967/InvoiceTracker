"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext({ theme: "light", toggleTheme: () => {} });

const STORAGE_KEY = "invoiceflow-theme";

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState("light");
    const [mounted, setMounted] = useState(false);

    // On mount, read from localStorage or system preference
    useEffect(() => {
        let saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
        if (saved === "dark" || saved === "light") {
            setTheme(saved);
        } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
            setTheme("dark");
        }
        setMounted(true);
    }, []);

    // Apply theme to DOM whenever it changes
    useEffect(() => {
        if (!mounted) return;
        const root = document.documentElement;
        root.setAttribute("data-theme", theme);
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    }, [theme, mounted]);

    const toggleTheme = useCallback(() => {
        setTheme(prev => (prev === "dark" ? "light" : "dark"));
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
