'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Icon from '@/components/Icon';

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-24 h-24 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-8"
            >
                <Icon name="FileQuestion" size={48} />
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl font-black text-slate-800 mb-4"
            >
                404 - Page Not Found
            </motion.h1>

            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-slate-500 max-w-md mb-10 font-medium"
            >
                Oops! The page you're looking for doesn't exist or has been moved.
                Let's get you back on track.
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <Link href="/">
                    <button className="h-12 px-8 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2">
                        <Icon name="Home" size={18} />
                        Back to Dashboard
                    </button>
                </Link>
            </motion.div>

            {/* Decorative Blur */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[500px] h-[500px] bg-indigo-400/10 blur-[120px] rounded-full" />
        </div>
    );
}
