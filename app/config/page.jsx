"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { toast } from "sonner";
import api from "@/lib/axios";

export default function ConfigurationPage() {
    const [settings, setSettings] = useState({
        emailNotifications: true,
        autoBackup: true,
        sapIntegration: true,
        ringiIntegration: true,
        sharepointIntegration: true,
        smtpIntegration: true,
        matchTolerance: 5,
        ocrEngine: "mindee",
        auditRetentionYears: 7
    });
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState({});
    const [testResults, setTestResults] = useState({});
    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get("/api/config");
            if (res.data) {
                setSettings(prev => ({ ...prev, ...res.data }));
            }
        } catch (error) {
            console.error("Failed to fetch configuration", error);
            if (error.response?.status !== 404) {
                toast.error("Failed to load configuration");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleTestConnection = async (integration) => {
        try {
            setTesting(prev => ({ ...prev, [integration]: true }));
            setTestResults(prev => ({ ...prev, [integration]: null }));

            const res = await api.post("/api/integrations/test", { integration });

            setTestResults(prev => ({
                ...prev,
                [integration]: {
                    status: res.data.status,
                    message: res.data.message
                }
            }));

            if (res.data.status === 'connected') {
                toast.success(`${integration} connected successfully`);
            } else if (res.data.status === 'not_configured') {
                toast.warning(res.data.message);
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            console.error(`Failed to test ${integration}`, error);
            setTestResults(prev => ({
                ...prev,
                [integration]: {
                    status: 'error',
                    message: error.response?.data?.message || "Connection failed"
                }
            }));
            toast.error(`Failed to connect to ${integration}`);
        } finally {
            setTesting(prev => ({ ...prev, [integration]: false }));
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-gray-900 to-gray-600">
                        System Configuration
                    </h1>
                    <p className="text-gray-500 mt-2">Application settings, integrations, and system preferences</p>
                </div>
            </div>

            {/* Matching & OCR Settings */}
            <section className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl p-8">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Icon name="GitMerge" size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">OCR Settings</h2>
                </div>

                <div className="space-y-5">


                    <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl">
                        <div>
                            <h3 className="font-semibold text-gray-900">OCR Engine</h3>
                            <p className="text-sm text-gray-500">Document intelligence provider</p>
                        </div>
                        <select
                            value={settings.ocrEngine}
                            onChange={(e) => setSettings({ ...settings, ocrEngine: e.target.value })}
                            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="mindee">MINDEE</option>
                        </select>
                    </div>
                </div>
            </section>

            {/* Integrations */}
            <section className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl p-8">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                        <Icon name="Share2" size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Integrations</h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* SAP */}
                    <div className="p-6 border border-gray-100 rounded-2xl bg-linear-to-br from-white to-gray-50">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#008FD3]/10 flex items-center justify-center text-[#008FD3]">
                                    <Icon name="Database" size={20} />
                                </div>
                                <span className="font-bold text-gray-800">SAP ERP</span>
                            </div>
                            {testResults['SAP'] ? (
                                <span className={`px-2 py-1 rounded-md text-xs font-medium border ${testResults['SAP'].status === 'connected'
                                    ? 'bg-green-50 text-green-700 border-green-100'
                                    : 'bg-red-50 text-red-700 border-red-100'
                                    }`}>
                                    {testResults['SAP'].status === 'connected' ? 'Connected' : 'Error'}
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-100 flex items-center gap-1.5 transition-all">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Disconnected
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-4">PO retrieval, vendor invoice creation, payment trigger, status sync</p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleTestConnection('SAP')}
                                disabled={testing['SAP']}
                                className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                            >
                                {testing['SAP'] && <Icon name="Loader" size={14} className="animate-spin" />}
                                {testing['SAP'] ? 'Testing...' : 'Test Connection'}
                            </button>
                            <span className="text-gray-300">|</span>
                            <button className="text-sm text-gray-500 hover:text-gray-700">Configure</button>
                        </div>
                        {testResults['SAP'] && testResults['SAP'].message && (
                            <p className={`text-xs mt-3 ${testResults['SAP'].status === 'connected' ? 'text-green-600' : 'text-red-500'
                                }`}>
                                {testResults['SAP'].message}
                            </p>
                        )}
                    </div>

                    {/* Ringi Portal */}
                    <div className="p-6 border border-gray-100 rounded-2xl bg-linear-to-br from-white to-gray-50">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <Icon name="FileCheck" size={20} />
                                </div>
                                <span className="font-bold text-gray-800">Ringi Portal</span>
                            </div>
                            {testResults['Ringi'] ? (
                                <span className={`px-2 py-1 rounded-md text-xs font-medium border ${testResults['Ringi'].status === 'connected'
                                    ? 'bg-green-50 text-green-700 border-green-100'
                                    : 'bg-red-50 text-red-700 border-red-100'
                                    }`}>
                                    {testResults['Ringi'].status === 'connected' ? 'Connected' : 'Error'}
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-100 flex items-center gap-1.5 transition-all">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Disconnected
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Annexure retrieval, approval status updates</p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleTestConnection('Ringi')}
                                disabled={testing['Ringi']}
                                className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                            >
                                {testing['Ringi'] && <Icon name="Loader" size={14} className="animate-spin" />}
                                {testing['Ringi'] ? 'Testing...' : 'Test Connection'}
                            </button>
                            <span className="text-gray-300">|</span>
                            <button className="text-sm text-gray-500 hover:text-gray-700">Configure</button>
                        </div>
                        {testResults['Ringi'] && testResults['Ringi'].message && (
                            <p className={`text-xs mt-3 ${testResults['Ringi'].status === 'connected' ? 'text-green-600' : 'text-red-500'
                                }`}>
                                {testResults['Ringi'].message}
                            </p>
                        )}
                    </div>

                    {/* SharePoint */}
                    <div className="p-6 border border-gray-100 rounded-2xl bg-linear-to-br from-white to-gray-50">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                    <Icon name="FolderOpen" size={20} />
                                </div>
                                <span className="font-bold text-gray-800">SharePoint</span>
                            </div>
                            {testResults['SharePoint'] ? (
                                <span className={`px-2 py-1 rounded-md text-xs font-medium border ${testResults['SharePoint'].status === 'connected'
                                    ? 'bg-green-50 text-green-700 border-green-100'
                                    : 'bg-red-50 text-red-700 border-red-100'
                                    }`}>
                                    {testResults['SharePoint'].status === 'connected' ? 'Connected' : 'Error'}
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-100 flex items-center gap-1.5 transition-all">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Disconnected
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Document ingestion, metadata management</p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleTestConnection('SharePoint')}
                                disabled={testing['SharePoint']}
                                className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                            >
                                {testing['SharePoint'] && <Icon name="Loader" size={14} className="animate-spin" />}
                                {testing['SharePoint'] ? 'Testing...' : 'Test Connection'}
                            </button>
                            <span className="text-gray-300">|</span>
                            <button className="text-sm text-gray-500 hover:text-gray-700">Configure</button>
                        </div>
                        {testResults['SharePoint'] && testResults['SharePoint'].message && (
                            <p className={`text-xs mt-3 ${testResults['SharePoint'].status === 'connected' ? 'text-green-600' : 'text-red-500'
                                }`}>
                                {testResults['SharePoint'].message}
                            </p>
                        )}
                    </div>

                    {/* SMTP */}
                    <div className="p-6 border border-gray-100 rounded-2xl bg-linear-to-br from-white to-gray-50">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                                    <Icon name="Mail" size={20} />
                                </div>
                                <span className="font-bold text-gray-800">SMTP Server</span>
                            </div>
                            {testResults['SMTP'] ? (
                                <span className={`px-2 py-1 rounded-md text-xs font-medium border ${testResults['SMTP'].status === 'connected'
                                    ? 'bg-green-50 text-green-700 border-green-100'
                                    : 'bg-red-50 text-red-700 border-red-100'
                                    }`}>
                                    {testResults['SMTP'].status === 'connected' ? 'Connected' : 'Error'}
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-100 flex items-center gap-1.5 transition-all">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Disconnected
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Email notifications for workflow approvals</p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleTestConnection('SMTP')}
                                disabled={testing['SMTP']}
                                className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                            >
                                {testing['SMTP'] && <Icon name="Loader" size={14} className="animate-spin" />}
                                {testing['SMTP'] ? 'Testing...' : 'Test Connection'}
                            </button>
                            <span className="text-gray-300">|</span>
                            <button className="text-sm text-gray-500 hover:text-gray-700">Configure</button>
                        </div>
                        {testResults['SMTP'] && testResults['SMTP'].message && (
                            <p className={`text-xs mt-3 ${testResults['SMTP'].status === 'connected' ? 'text-green-600' : 'text-red-500'
                                }`}>
                                {testResults['SMTP'].message}
                            </p>
                        )}
                    </div>
                </div>
            </section>


        </div>
    );
}
