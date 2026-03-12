"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const Background3D = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 z- overflow-hidden bg-base-100">
      {/* Primary Gradient Mesh */}
      <div className="absolute inset-0 bg-linear-to-br from-indigo-50 via-purple-50 to-pink-50 opacity-60 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-950 dark:opacity-80"></div>

      {/* Floating Orb 1 - Top Left */}
      <motion.div
        className="absolute -top-20 -left-20 w-160 h-160 rounded-full bg-purple-300/30 dark:bg-purple-700/15 blur-3xl"
        animate={{
          x: mousePosition.x * 30,
          y: mousePosition.y * 30,
        }}
        transition={{ type: "spring", stiffness: 50, damping: 20 }}
      />

      {/* Floating Orb 2 - Bottom Right */}
      <motion.div
        className="absolute top-1/2 -right-20 w-120 h-120 rounded-full bg-blue-300/20 dark:bg-blue-700/10 blur-3xl"
        animate={{
          x: mousePosition.x * -40,
          y: mousePosition.y * -40,
        }}
        transition={{ type: "spring", stiffness: 40, damping: 20 }}
      />

      {/* Floating Orb 3 - Center dynamic */}
      <motion.div
        className="absolute bottom-0 left-1/3 w-100 h-100 rounded-full bg-pink-300/20 dark:bg-pink-800/10 blur-3xl"
        animate={{
          x: mousePosition.x * 20,
          y: mousePosition.y * 20,
          scale: [1, 1.1, 1],
        }}
        transition={{ 
            x: { type: "spring", stiffness: 30, damping: 20 },
            y: { type: "spring", stiffness: 30, damping: 20 },
            scale: { duration: 5, repeat: Infinity, repeatType: "reverse" }
        }}
      />
      
      {/* Grid Overlay for depth */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04] pointer-events-none"
        style={{
            backgroundImage: `radial-gradient(#444 1px, transparent 1px)`,
            backgroundSize: "40px 40px"
        }}
      ></div>
    </div>
  );
};

export default Background3D;