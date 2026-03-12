"use client";

import { twMerge } from "tailwind-merge";
import { motion } from "framer-motion";

const Card = ({
  children,
  className = "",
  hoverEffect = false,
  glass = true,
  noPadding = false,
  ...props
}) => {
  const baseClasses = "rounded-2xl transition-all duration-300 relative overflow-hidden";

  const glassClasses = glass
    ? twMerge("glass-panel backdrop-blur-xl shadow-xl", !className.includes("bg-") && "glass-panel-white")
    : "bg-base-100 shadow-md border border-base-200";

  const paddingClasses = noPadding ? "" : "p-6";

  const hoverClasses = hoverEffect
    ? "hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/20"
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={twMerge(baseClasses, glassClasses, paddingClasses, hoverClasses, className)}
      {...props}
    >
      {/* Decorative subtle gradient background for aesthetic depth */}
      {glass && (
        <div className="absolute top-0 left-0 w-full h-full bg-linear-to-r from-white/10 to-transparent pointer-events-none z-0"></div>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

export default Card;