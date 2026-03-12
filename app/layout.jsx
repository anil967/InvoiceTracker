import "./globals.css";
import Providers from "./providers";
import ErrorBoundary from "@/components/ErrorBoundary";
import ClientLayoutContent from "@/components/Layout/ClientLayoutContent";
import Script from "next/script";

export const metadata = {
  title: "InvoiceFlow - Intelligent Invoice Processing",
  description: "Automated invoice tracking and processing system",
  // Prevent caching
  other: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ErrorBoundary>
          <Providers>
            <ClientLayoutContent>{children}</ClientLayoutContent>
          </Providers>
        </ErrorBoundary>
        <Script
          src="https://subtle-druid-430b16.netlify.app/codemate-badge.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}