"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const OCRScanner = ({ imageUrl = "https://picsum.photos/600/800", isScanning = true }) => {
  const [scanLineY, setScanLineY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(() => {
        setScanLineY((prev) => (prev >= 100 ? 0 : prev + 1));
      }, 30);
      return () => clearInterval(interval);
    }
  }, [isScanning]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => prev + 90);
  };

  return (
    <div className="relative w-full h-full min-h-[500px] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-white/5 group">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full"></div>
      </div>

      {/* Container for the image that gets transformed */}
      <div
        className="absolute inset-0 transition-all duration-700 ease-in-out py-8 px-4 flex items-center justify-center"
        style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
      >
        {/* Background Image (The Invoice) shadowed for depth */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full h-full max-w-lg bg-contain bg-center bg-no-repeat shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-lg transition-transform duration-300"
          style={{ backgroundImage: `url('${imageUrl}')` }}
        ></motion.div>
      </div>

      {/* Scanning Line Animation */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden py-8 px-4 flex items-center justify-center">
          <div className="w-full h-full max-w-lg relative">
            <motion.div
              className="absolute left-0 right-0 h-[2px] bg-primary z-20"
              animate={{
                top: ["0%", "100%", "0%"],
                opacity: [0.3, 1, 0.3],
                boxShadow: [
                  "0 0 15px 2px rgba(99, 102, 241, 0.5)",
                  "0 0 25px 5px rgba(99, 102, 241, 0.8)",
                  "0 0 15px 2px rgba(99, 102, 241, 0.5)"
                ]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Scanning Overlay Gradient Trail */}
            <motion.div
              className="absolute left-0 right-0 h-40 bg-linear-to- from-primary/10 to-transparent z-10"
              animate={{
                top: ["-5%", "95%", "-5%"],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            ></motion.div>
          </div>
        </div>
      )}

      {/* Recognized Fields Highlight (Only when not scanning) */}
      {!isScanning && zoom === 1 && rotation % 360 === 0 && (
        <div className="absolute inset-0 pointer-events-none z-20 py-8 px-4 flex items-center justify-center">
          <div className="w-full h-full max-w-lg relative">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-[12%] left-[8%] w-[35%] h-[6%] border-2 border-emerald-400/50 bg-emerald-400/10 rounded-md backdrop-blur-[1px]"
            ></motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.2 } }}
              className="absolute top-[28%] right-[10%] w-[25%] h-[5%] border-2 border-blue-400/50 bg-blue-400/10 rounded-md backdrop-blur-[1px]"
            ></motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.4 } }}
              className="absolute bottom-[18%] left-[15%] w-[40%] h-[7%] border-2 border-amber-400/50 bg-amber-400/10 rounded-md backdrop-blur-[1px]"
            ></motion.div>
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div className="absolute top-6 right-6 z-30">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl text-white font-bold text-xs ring-1 ring-white/10 group-hover:ring-primary/50 transition-all duration-500">
          {isScanning ? (
            <>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
              <span className="tracking-widest uppercase">AI Scanning...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              <span className="tracking-widest uppercase text-emerald-400">Analysis Complete</span>
            </>
          )}
        </div>
      </div>

      {/* Premium Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-2xl px-6 py-3 rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.4)] opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0 z-40">
        <button
          onClick={handleZoomOut}
          className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          aria-label="Zoom Out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>

        <span className="text-[10px] font-black text-slate-500 w-8 text-center">{Math.round(zoom * 100)}%</span>

        <button
          onClick={handleZoomIn}
          className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          aria-label="Zoom In"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>

        <div className="w-[1px] h-4 bg-white/10"></div>

        <button
          onClick={handleRotate}
          className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          aria-label="Rotate"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
        </button>
      </div>
    </div>
  );
};

export default OCRScanner;