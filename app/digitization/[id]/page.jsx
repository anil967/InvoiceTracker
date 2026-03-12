"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getInvoiceStatus } from "@/lib/api";
import OCRScanner from "@/components/Digitization/OCRScanner";
import ValidationForm from "@/components/Digitization/ValidationForm";
import Icon from "@/components/Icon";
import Link from "next/link";
import { motion } from "framer-motion";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const foundInvoice = await getInvoiceStatus(params.id);

        if (!foundInvoice) {
          router.push("/digitization");
          return;
        }

        setInvoice(foundInvoice);
      } catch (error) {
        console.error("Failed to fetch invoice:", error);
        router.push("/digitization");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchInvoice();
    }
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <span className="loading loading-infinity loading-lg text-primary mb-4"></span>
          <p className="text-gray-500">Retrieving document context...</p>
        </div>
      </div>
    );
  }

  // Final guard to prevent crashes during redirect transition
  if (!invoice) return null;

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto space-y-4">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/digitization" className="hover:text-primary transition-colors flex items-center gap-1">
          <Icon name="ArrowLeft" size={14} /> Back to List
        </Link>
        <span>/</span>
        <span className="font-semibold text-gray-700">{invoice?.id || '...'}</span>
        <span>/</span>
        <span className="text-primary">Validation</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full pb-6">
        {/* Left Panel: OCR Scanner Visual */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="h-full min-h-[500px] lg:h-auto"
        >
          <div className="h-full flex flex-col">
            <div className="bg-white/40 backdrop-blur-md p-3 rounded-t-xl border border-white/50 border-b-0 flex justify-between items-center">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Icon name="FileText" size={18} />
                Original Document
              </h3>
              <div className="flex gap-2">
                <span className="badge badge-sm badge-ghost">PDF</span>
                <span className="badge badge-sm badge-ghost">1.2 MB</span>
              </div>
            </div>
            <div className="flex-1 relative">
              <OCRScanner
                imageUrl={invoice.fileUrl || "https://picsum.photos/600/800"}
                isScanning={invoice.status === 'DIGITIZING' || invoice.status === 'RECEIVED'}
              />
            </div>
          </div>
        </motion.div>

        {/* Right Panel: Validation Form */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="h-full"
        >
          <ValidationForm invoice={invoice} />
        </motion.div>
      </div>
    </div>
  );
}