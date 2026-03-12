"use client";

import { motion } from "framer-motion";
import Icon from "@/components/Icon";

const SyncIndicator = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 bg-white/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/50 shadow-sm"
    >
      <div className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
      </div>
      
      <div className="flex flex-col leading-none">
        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">System Status</span>
        <span className="text-sm font-bold text-gray-800 flex items-center gap-1">
          SAP Connected
          <Icon name="Database" size={12} className="text-emerald-600 ml-1" />
        </span>
      </div>

      <div className="h-6 w-px bg-gray-300 mx-1"></div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 font-mono">Ping: 24ms</span>
        <Icon name="Activity" size={14} className="text-emerald-500" />
      </div>
    </motion.div>
  );
};

export default SyncIndicator;