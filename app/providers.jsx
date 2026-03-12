"use client";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "sonner";

export default function Providers({ children }) {
    return (
        <ThemeProvider>
            <AuthProvider>
                <Toaster richColors position="top-right" />
                {children}
            </AuthProvider>
        </ThemeProvider>
    );
}
