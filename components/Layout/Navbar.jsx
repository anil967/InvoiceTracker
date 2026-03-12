"use client";

import Icon from "@/components/Icon";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canSeeMenuItem } from "@/constants/roles";

const Navbar = ({ onMenuClick }) => {
  const pathname = usePathname();
  const { user } = useAuth();

  const isVendorPage = pathname === "/vendors";

  // Even on vendor page, we might want the burger menu if the user has a sidebar
  if (isVendorPage && user) {
    return (
      <header className="navbar w-full p-0 min-h-[4rem] relative z-50 lg:hidden">
        <div className="flex-1 flex items-center px-4">
          <button
            className="p-2 -ml-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors active:scale-95"
            onClick={onMenuClick}
            aria-label="Open Menu"
          >
            <Icon name="Menu" size={24} />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="navbar w-full p-0 min-h-[4rem] relative z-50">
      <div className="flex-1 flex items-center lg:hidden px-4 gap-2">
        <button
          className="p-2 -ml-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors active:scale-95"
          onClick={onMenuClick}
          aria-label="Open Menu"
        >
          <Icon name="Menu" size={24} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-linear-to-r from-primary to-accent flex items-center justify-center shadow-md">
            <Icon name="Zap" className="text-white" size={18} strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold bg-clip-text text-transparent bg-linear-to- from-primary to-accent">InvoiceFlow</span>
        </Link>
      </div>
      <div className="flex-1 hidden lg:flex px-4" />
    </header>
  );
};

export default Navbar;