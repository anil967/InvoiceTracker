"use client";

import React, { useState, useEffect, useRef } from 'react';
import Icon from '@/components/Icon';

// Mammoth browser build served locally from /public
const MAMMOTH_SRC = '/mammoth.browser.min.js';

/**
 * Load mammoth.js via script tag (guaranteed browser-compatible)
 */
function useMammoth() {
    const [ready, setReady] = useState(false);
    const loadingRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (window.mammoth) { setReady(true); return; }
        if (loadingRef.current) return;
        loadingRef.current = true;

        const script = document.createElement('script');
        script.src = MAMMOTH_SRC;
        script.async = true;
        script.onload = () => setReady(true);
        script.onerror = () => console.error('Failed to load mammoth.js from CDN');
        document.head.appendChild(script);
    }, []);

    return ready;
}

/**
 * DocumentViewer - Handles previews for various file types
 */
const DocumentViewer = ({
    invoiceId,
    docId,
    fileName = "",
    spreadsheetData = null,
    customFileUrl = null,
    fileUrl: legacyFileUrl = null, // Backward compatibility
    forceSpreadsheet = false,
    onLoadingComplete = () => { }
}) => {
    const [wordHtml, setWordHtml] = useState(null);
    const [wordLoading, setWordLoading] = useState(false);
    const [wordError, setWordError] = useState(false);
    const [localSpreadsheetData, setLocalSpreadsheetData] = useState(null);
    const mammothReady = useMammoth();

    const name = (fileName || "").toLowerCase();

    const isSpreadsheet = forceSpreadsheet || name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv');
    const isDocx = name.endsWith('.docx');
    const isDocLegacy = name.endsWith('.doc') && !isDocx;
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(name);

    const fileUrl = customFileUrl || legacyFileUrl
        || (docId ? `/api/documents/${docId}/file` : null)
        || (invoiceId && invoiceId !== 'undefined' ? `/api/invoices/${invoiceId}/file` : null);

    // Self-fetch spreadsheet preview for additional documents
    useEffect(() => {
        if (!isSpreadsheet || !customFileUrl) return;
        // Extract document ID from URL like /api/documents/{id}/file
        const match = customFileUrl.match(/\/api\/documents\/([^/]+)\/file/);
        if (!match) return;

        let cancelled = false;
        setLocalSpreadsheetData(null);

        (async () => {
            try {
                const res = await fetch(`/api/documents/${match[1]}/preview`);
                if (!res.ok) throw new Error(`Preview fetch failed: ${res.status}`);
                const json = await res.json();
                if (!cancelled && Array.isArray(json.data)) {
                    setLocalSpreadsheetData(json.data);
                    onLoadingComplete();
                }
            } catch (err) {
                console.error("Document spreadsheet preview error:", err);
            }
        })();

        return () => { cancelled = true; };
    }, [isSpreadsheet, customFileUrl]);

    // Convert .docx to HTML once mammoth is loaded
    useEffect(() => {
        if (!isDocx || (!invoiceId && !customFileUrl) || !mammothReady) return;
        if (typeof window === 'undefined' || !window.mammoth) return;

        let cancelled = false;
        setWordLoading(true);
        setWordError(false);
        setWordHtml(null);

        (async () => {
            try {
                const res = await fetch(fileUrl);
                if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                const arrayBuffer = await res.arrayBuffer();
                const result = await window.mammoth.convertToHtml({ arrayBuffer });
                if (!cancelled) {
                    setWordHtml(result.value);
                    onLoadingComplete();
                }
            } catch (err) {
                console.error("Word conversion error:", err);
                if (!cancelled) setWordError(true);
            } finally {
                if (!cancelled) setWordLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [isDocx, invoiceId, customFileUrl, mammothReady]);

    // ── 1. Spreadsheet ──
    const effectiveSpreadsheetData = spreadsheetData || localSpreadsheetData;
    if (isSpreadsheet && Array.isArray(effectiveSpreadsheetData) && effectiveSpreadsheetData.length > 0) {
        return (
            <div className="bg-white p-6 min-h-full">
                <div className="overflow-x-auto border rounded-xl shadow-sm">
                    <table className="table table-compact w-full text-xs">
                        <thead className="bg-gray-50">
                            <tr className="border-b border-gray-200">
                                {effectiveSpreadsheetData[0]?.map((cell, i) => (
                                    <th key={i} className="font-black text-gray-500 uppercase tracking-widest border-r border-gray-200 last:border-0 py-3 px-4">
                                        {cell || `Col ${i + 1}`}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {effectiveSpreadsheetData.slice(1).map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    {row.map((cell, j) => (
                                        <td key={j} className="border-r border-gray-100 last:border-0 whitespace-nowrap px-4 py-2 text-gray-600">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {effectiveSpreadsheetData.length >= 100 && (
                    <p className="mt-4 text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest">
                        Showing first 100 rows
                    </p>
                )}
            </div>
        );
    }

    // ── 2. Image ──
    if (isImage) {
        return (
            <div className="flex items-center justify-center min-h-full p-4 bg-gray-100/50">
                <img
                    src={fileUrl}
                    alt={fileName}
                    className="max-w-full max-h-[80vh] shadow-2xl rounded-lg object-contain bg-white"
                    onLoad={() => onLoadingComplete()}
                />
            </div>
        );
    }

    // ── 3. Word (.docx) ──
    if (isDocx) {
        if (wordLoading || (!wordHtml && !wordError && mammothReady)) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                        Converting Document...
                    </p>
                </div>
            );
        }
        if (!mammothReady) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                        Loading Preview Engine...
                    </p>
                </div>
            );
        }
        if (wordError) {
            return renderFallback("This Word document could not be converted for preview.");
        }
        if (wordHtml) {
            return (
                <div className="bg-white min-h-full w-full overflow-auto">
                    <div
                        className="max-w-3xl mx-auto p-8 sm:p-12"
                        style={{
                            lineHeight: 1.8,
                            fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
                            fontSize: '14px',
                            color: '#334155'
                        }}
                        dangerouslySetInnerHTML={{ __html: wordHtml }}
                    />
                </div>
            );
        }
        return null;
    }

    // ── 4. Legacy .doc or fallback ──
    if (isDocLegacy || (isSpreadsheet && !spreadsheetData)) {
        return renderFallback("This file format cannot be rendered directly in the browser.");
    }

    // ── 5. PDF / others ──
    if (!fileUrl) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white text-slate-400 gap-3">
                <Icon name="FileX" size={40} />
                <p className="text-xs font-bold uppercase tracking-widest">No preview available</p>
            </div>
        );
    }
    return (
        <iframe
            src={fileUrl}
            title="Document Preview"
            className="w-full h-full min-h-[70vh] border-0 bg-white"
            onLoad={() => onLoadingComplete()}
        />
    );

    function renderFallback(message) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] h-full p-12 text-center space-y-6 bg-white">
                <div className="w-24 h-24 rounded-[2.5rem] bg-amber-50 text-amber-500 flex items-center justify-center shadow-inner">
                    <Icon name="AlertCircle" size={48} />
                </div>
                <div className="max-w-md">
                    <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Preview Unavailable</h4>
                    <p className="text-sm font-medium text-slate-500 mt-2 leading-relaxed">
                        {message} Please download the file to view its contents.
                    </p>
                </div>
                <a
                    href={fileUrl}
                    download
                    className="inline-flex items-center gap-3 h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 transition-all active:scale-95"
                >
                    <Icon name="Download" size={20} /> Download for Viewing
                </a>
            </div>
        );
    }
};

export default DocumentViewer;
