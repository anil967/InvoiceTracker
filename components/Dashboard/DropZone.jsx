"use client";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/Icon";
import { ingestInvoice } from "@/lib/api";

const DropZone = ({ onUploadComplete, uploadMetadata = {}, theme = "light" }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const progressCancelRef = useRef(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    const total = acceptedFiles.length;

    const runSmoothProgress = (fromPercent, toPercent, durationMs = 1000) => {
      progressCancelRef.current = false;
      const start = Date.now();
      const tick = () => {
        if (progressCancelRef.current) return;
        const elapsed = Date.now() - start;
        const t = Math.min(elapsed / durationMs, 1);
        const eased = t * (2 - t);
        const value = fromPercent + (toPercent - fromPercent) * eased;
        setUploadProgress((p) => Math.max(p, Math.round(value)));
        if (t < 1) setTimeout(tick, 60);
      };
      tick();
    };

    try {
      for (let i = 0; i < total; i++) {
        const file = acceptedFiles[i];
        const segmentStart = 5 + (i / total) * 85;
        const segmentEnd = 5 + ((i + 1) / total) * 85;
        setUploadProgress(Math.round(segmentStart));

        const uploadPromise = ingestInvoice(file, uploadMetadata);
        runSmoothProgress(segmentStart, segmentEnd - 1, 1500);
        await uploadPromise;

        progressCancelRef.current = true;
        setUploadProgress(Math.round(segmentEnd));
      }

      progressCancelRef.current = true;
      runSmoothProgress(90, 100, 500);
      await new Promise((r) => setTimeout(r, 500));
      setUploadProgress(100);
      setUploadSuccess(true);

      if (onUploadComplete) onUploadComplete();

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadSuccess(false);
      }, 1500);
    } catch (error) {
      progressCancelRef.current = true;
      console.error("Upload failed:", error);
      alert(`Upload failed: ${error.message}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onUploadComplete, uploadMetadata]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv']
    },
    maxFiles: 5,
    noClick: false
  });

  const isDark = theme === "dark";

  return (
    <div className="w-full h-full min-h-[280px] sm:min-h-[320px]">
      <div
        {...getRootProps()}
        className={`
          relative w-full h-full rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-8 sm:p-10
          ${isDragActive
            ? "border-indigo-500 bg-indigo-50 shadow-2xl shadow-indigo-200 scale-[0.99]"
            : isDark
              ? "border-white/30 hover:border-white/50 bg-linear-to-r from-white/10 to-white/5 hover:from-white/15 hover:to-white/10"
              : "border-indigo-100/50 hover:border-indigo-300 bg-linear-to-r from-white/50 via-indigo-50/10 to-purple-50/20 hover:from-white/80 hover:via-indigo-50/40 hover:to-purple-50/50 shadow-xl shadow-indigo-100/30"
          }
          ${isDragReject ? "border-red-400 bg-red-50/50" : ""}
          backdrop-blur-md cursor-pointer overflow-hidden group
        `}
      >
        <input {...getInputProps()} />

        {/* Animated background gradient orbs */}
        {!isDark && !isUploading && (
          <>
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-linear-to-r from-indigo-200/40 to-purple-200/30 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-linear-to-r from-blue-200/30 to-indigo-200/20 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
          </>
        )}

        <AnimatePresence mode="wait">
          {isUploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center w-full z-10"
            >
              {uploadSuccess ? (
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 rounded-full bg-linear-to-r from-emerald-400 to-green-500 flex items-center justify-center mb-5 mx-auto shadow-xl shadow-emerald-200"
                  >
                    <Icon name="Check" size={48} className="text-white" />
                  </motion.div>
                  <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Uploaded!</h3>
                  <p className={`mt-2 font-semibold ${isDark ? 'text-white/80' : 'text-gray-600'}`}>Processing your invoices...</p>
                </div>
              ) : (
                <div className="w-full max-w-sm text-center">
                  <div className="w-20 h-20 bg-linear-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-5 mx-auto shadow-xl shadow-indigo-200 animate-pulse">
                    <Icon name="UploadCloud" size={40} className="text-white" />
                  </div>
                  <h3 className={`text-xl font-black mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Uploading Files...</h3>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                    <motion.div
                      className="h-full bg-linear-to- from-indigo-500 via-purple-500 to-indigo-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, uploadProgress)}%` }}
                      transition={{ type: "tween", duration: 0.35 }}
                    />
                  </div>
                  <p className={`text-sm mt-3 font-bold ${isDark ? 'text-white/80' : 'text-indigo-600'}`}>{Math.min(100, Math.round(uploadProgress))}%</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center z-20 relative"
            >
              {/* Main Upload Icon */}
              <motion.div
                className={`
                  w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center transition-all duration-300 relative
                  ${isDragActive
                    ? "bg-linear-to-r from-indigo-500 to-purple-600 text-white shadow-2xl shadow-indigo-300 scale-110"
                    : isDark
                      ? "bg-linear-to-r from-white/20 to-white/10 text-white shadow-xl"
                      : "bg-linear-to-r from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-200"
                  }
                `}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Icon name="CloudUpload" size={44} className={isDragActive ? "animate-bounce" : ""} />
                {/* Pulse ring */}
                <div className="absolute inset-0 rounded-3xl border-2 border-indigo-400/50 animate-ping opacity-30" />
              </motion.div>

              <h3 className={`text-2xl font-black mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {isDragActive ? "Drop files here!" : "Upload Invoices"}
              </h3>
              <p className={`mb-2 max-w-sm mx-auto font-medium leading-relaxed ${isDark ? 'text-white/90' : 'text-gray-700'}`}>
                Drag & drop your invoices here, or click to browse files
              </p>
              <p className={`mb-6 text-xs uppercase tracking-wider font-bold ${isDark ? 'text-white/60' : 'text-indigo-500'}`}>
                PDF • Word • Excel • CSV • JPG • PNG
              </p>

              <motion.button
                type="button"
                className={`
                  btn rounded-full px-10 py-3 font-bold text-sm tracking-wide transition-all shadow-lg
                  ${isDark
                    ? 'bg-white text-indigo-600 hover:bg-white/90 shadow-white/20'
                    : 'bg-linear-to- from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-indigo-300'
                  }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon name="FolderOpen" size={18} className="mr-2" />
                Browse Files
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Premium decorative icons */}
        {!isUploading && (
          <>
            <motion.div
              className={`absolute top-8 left-8 pointer-events-none ${isDark ? 'text-white/15' : 'text-indigo-200'}`}
              initial={{ rotate: 12, opacity: 0.5 }}
              whileHover={{ rotate: 20, scale: 1.1 }}
            >
              <Icon name="FileText" size={56} />
            </motion.div>
            <motion.div
              className={`absolute top-12 right-12 pointer-events-none ${isDark ? 'text-white/10' : 'text-purple-200'}`}
              initial={{ rotate: -8, opacity: 0.4 }}
            >
              <Icon name="Receipt" size={40} />
            </motion.div>
            <motion.div
              className={`absolute bottom-8 right-8 pointer-events-none ${isDark ? 'text-white/15' : 'text-indigo-200'}`}
              initial={{ rotate: -12, opacity: 0.5 }}
            >
              <Icon name="Image" size={52} />
            </motion.div>
            <motion.div
              className={`absolute bottom-12 left-12 pointer-events-none ${isDark ? 'text-white/10' : 'text-purple-200'}`}
              initial={{ rotate: 15, opacity: 0.4 }}
            >
              <Icon name="FileSpreadsheet" size={36} />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

DropZone.displayName = "DropZone";

export default DropZone;