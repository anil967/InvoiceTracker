"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES, getNormalizedRole } from "@/constants/roles";

const PUBLIC_PATHS = ["/login", "/signup", "/"];

export default function RouteGuard({ children }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        // Wait for auth verification to complete
        if (isLoading) return;

        const path = pathname.split('?')[0];

        // Check if path is public
        const isPublicPath = PUBLIC_PATHS.includes(path);

        if (!user && !isPublicPath) {
            // User is not logged in and trying to access restricted page
            setAuthorized(false);
            router.push("/login");
        } else if (user && isPublicPath && path !== "/") {
            // User is logged in and trying to access login/signup -> redirect to app
            setAuthorized(true);
            const role = getNormalizedRole(user);
            router.push(role === ROLES.VENDOR ? "/vendors" : "/dashboard");
        } else {
            setAuthorized(true);
        }
    }, [user, isLoading, pathname, router]);

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F8F9FC]">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    // If not authorized yet (and not redirected), don't show content
    // This prevents flash of protected content
    // validation happens in useEffect, so we might need a better guard state 
    // relying on useEffect might cause a split second render of children.
    // Ideally, valid user check happens faster or we show loader until `authorized` is set.

    return authorized ? children : null;
}
