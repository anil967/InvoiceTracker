"use client";

import Link from "next/link";

import { motion } from "framer-motion";
import Icon from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { ROLES, getNormalizedRole } from "@/constants/roles";
import ThemeToggle from "@/components/Layout/ThemeToggle";

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const role = getNormalizedRole(user);
  const isVendor = role === ROLES.VENDOR;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden aurora-background-pattern">

      {/* Top Navigation for public access */}
      <nav className="absolute top-0 left-0 w-full z-20 flex justify-between items-center p-6 px-8">
        <div className="text-xl font-black bg-clip-text text-transparent bg-linear-to-r from-primary to-accent">
          InvoiceFlow
        </div>
        <div className="flex gap-3 items-center">
          <ThemeToggle size={18} />
          {!isLoading && user ? (
            <Link href="/dashboard">
              <button className="btn btn-primary btn-sm md:btn-md rounded-full px-6 text-white shadow-lg shadow-primary/20">{isVendor ? "Vendor Hub" : "Dashboard"}</button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <button className="btn btn-ghost hover:bg-white/50 dark:hover:bg-white/10 rounded-full px-6 dark:text-slate-200">Login</button>
              </Link>
              <Link href="/signup">
                <button className="btn btn-primary btn-sm md:btn-md rounded-full px-6 text-white shadow-lg shadow-primary/20">Sign Up</button>
              </Link>
            </>
          )}
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center relative z-10 w-full px-6 pt-20 pb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-4xl"
        >
          <div className="inline-flex items-center justify-center p-3 mb-8 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-white/10">
            <div className="p-3 bg-linear-to-tr from-primary to-accent rounded-xl shadow-lg mr-4">
              <Icon name="Zap" className="text-white w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black bg-clip-text text-transparent bg-linear-to-r from-slate-800 to-slate-600 dark:from-sky-800 dark:to-sky-100 tracking-tight">
              InvoiceFlow
            </h1>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-slate-700 dark:text-slate-200 mb-6">
            Intelligent Invoice Processing
          </h2>

          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Experience the future of financial workflows. seamless digitization,
            AI-powered extraction, and 3-way matching.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href={!isLoading && user ? "/dashboard" : "/signup"}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn btn-primary btn-lg rounded-full px-10 shadow-xl shadow-primary/30 border-none bg-linear-to-r from-primary to-accent text-white font-bold text-lg group"
              >
                {!isLoading && user ? (isVendor ? "Enter Vendor Hub" : "Enter Dashboard") : "Get Started"}
                <Icon name="ArrowRight" className="ml-2 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </main>

    </div>
  );
}