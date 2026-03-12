// lib/version.js
/**
 * App versioning for cache busting and update detection
 * Uses server-side version headers instead of localStorage
 */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.89';

/**
 * Check if client version matches server version
 * Used to detect when app needs refresh
 */
export const checkVersion = async () => {
    if (typeof window === 'undefined') return true;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`${window.location.origin}/api/version?t=${Date.now()}`, {
            signal: controller.signal,
            credentials: 'same-origin',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn('Version check failed with status:', response.status);
            return true; // Don't block on error
        }

        const data = await response.json();
        const serverVersion = data.version;
        const clientVersion = APP_VERSION;

        if (clientVersion !== serverVersion) {
            // Version mismatch - trigger reload
            console.log(`Version mismatch: client=${clientVersion}, server=${serverVersion}`);
            return false;
        }

        return true;
    } catch (error) {
        // Network errors (offline, CORS, blocked, aborted) - fail open so app keeps working
        if (error?.name === 'AbortError' || error?.message === 'Failed to fetch' || error?.name === 'TypeError') {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Version check skipped (network unavailable or aborted)');
            }
            return true;
        }
        console.error('Version check failed:', error);
        return true; // Don't block on error
    }
};

/**
 * Force reload if version mismatch detected
 */
/**
 * Clears all site data to fix version conflicts
 */
const clearSiteData = async () => {
    try {
        console.log('🧹 [Version] Clearing site data (localStorage, sessionStorage, cookies, caches)...');

        // 1. Clear Local/Session Storage
        if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
        }

        // 2. Clear Cookies (simple ones, not HttpOnly)
        // CRITICAL: We MUST preserve the version_reset_lock to prevent infinite reload loops
        document.cookie.split(";").forEach((c) => {
            const cookieName = c.trim().split("=")[0];
            if (cookieName !== 'version_reset_lock') {
                document.cookie = cookieName +
                    "=;expires=" + new Date(0).toUTCString() + ";path=/";
            }
        });

        // 3. Clear Cache Storage (Service Workers)
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        // 4. Unregister Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
        }

        console.log('✅ [Version] Site data cleared successfully.');
    } catch (e) {
        console.error('❌ [Version] Error clearing site data:', e);
    }
};

/**
 * Check for version mismatch and prompt user to reload (MANUAL reload)
 * Protected by a "prompt lock" cookie to prevent spamming
 */
export const autoUpdateOnVersionChange = async () => {
    if (typeof window === 'undefined') return;

    try {
        const isUpToDate = await checkVersion();

        if (!isUpToDate) {
            console.log('🔔 [Version] New version detected. Silent update pending.');
            // Silent update or just log it - popups are annoying users
        }
    } catch (error) {
        console.error('❌ [Version] Error during version check:', error);
    }
};

/**
 * Start periodic version checking
 */
export const startVersionCheck = (intervalMs = 60000) => { // Check every 60 seconds
    if (typeof window === 'undefined') return;

    // DON'T check immediately - wait for first interval
    // This prevents reload loop on initial page load
    const interval = setInterval(autoUpdateOnVersionChange, intervalMs);

    // Also check when tab becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            autoUpdateOnVersionChange();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
};
