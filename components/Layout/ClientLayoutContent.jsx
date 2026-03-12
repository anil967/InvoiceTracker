"use client";

import { useAuth } from "@/context/AuthContext";
import LogoutOverlay from "@/components/Auth/LogoutOverlay";
import GlassLayout from "@/components/Layout/GlassLayout";

export default function ClientLayoutContent({ children }) {
    const { isLoggingOut } = useAuth();

    return (
        <>
            <LogoutOverlay isVisible={isLoggingOut} />
            <GlassLayout>
                {children}
            </GlassLayout>
        </>
    );
}
