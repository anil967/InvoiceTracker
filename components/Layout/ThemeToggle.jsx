"use client";

import { useTheme } from "@/context/ThemeContext";
import Icon from "@/components/Icon";

export default function ThemeToggle({ size = 20, className = "" }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";

    return (
        <button
            onClick={toggleTheme}
            className={`relative p-2 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95
                ${isDark
                    ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                    : "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20"
                } ${className}`}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
            <div className="relative w-[20px] h-[20px] flex items-center justify-center" style={{ width: size, height: size }}>
                <Icon
                    name={isDark ? "Sun" : "Moon"}
                    size={size}
                    className={`transition-transform duration-300 ${isDark ? "rotate-0" : "rotate-0"}`}
                />
            </div>
        </button>
    );
}
