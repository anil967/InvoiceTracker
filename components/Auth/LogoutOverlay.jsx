"use client";

import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/Icon";

const LogoutOverlay = ({ isVisible }) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z- flex items-center justify-center bg-white/20 backdrop-blur-xl"
                >
                    {/* Animated Background Gradients */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.3, 0.5, 0.3],
                                x: [0, 50, 0],
                                y: [0, -50, 0],
                            }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                            className="absolute -top-[20%] -left-[20%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px]"
                        />
                        <motion.div
                            animate={{
                                scale: [1, 1.3, 1],
                                opacity: [0.3, 0.4, 0.3],
                                x: [0, -70, 0],
                                y: [0, 70, 0],
                            }}
                            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                            className="absolute -bottom-[20%] -right-[20%] w-[60%] h-[60%] bg-accent/20 rounded-full blur-[120px]"
                        />
                    </div>

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="relative z-10 flex flex-col items-center text-center p-12"
                    >
                        {/* Pulsing Icon Container */}
                        <div className="relative mb-8">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl"
                            />
                            <div className="relative w-24 h-24 rounded-3xl bg-linear-to-r from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30 ring-1 ring-white/20">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                >
                                    <Icon name="Zap" className="text-white" size={48} />
                                </motion.div>
                            </div>
                        </div>

                        {/* Premium Text Stacking */}
                        <h2 className="text-4xl font-black tracking-tight text-slate-800 mb-2">
                            Signing Out
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                        </div>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-slate-400"
                        >
                            Securing your session...
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LogoutOverlay;
