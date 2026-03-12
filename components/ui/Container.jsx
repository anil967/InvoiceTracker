"use client";

// Optional helper for consistent max-width layouts if needed inside pages
export default function Container({ children, className = "" }) {
  return (
    <div className={`max-w-7xl mx-auto w-full ${className}`}>
      {children}
    </div>
  );
}