"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Icon from "@/components/Icon";
import { getAuditLogs, getNotifications } from "@/lib/api";

const NotificationLog = ({ relatedEntityId }) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            if (!relatedEntityId) {
                setLoading(false);
                return;
            }
            try {
                const [auditLogs, emailNotifications] = await Promise.all([
                    getAuditLogs(relatedEntityId),
                    getNotifications(relatedEntityId),
                ]);

                const auditEntries = (auditLogs || []).map((log, index) => ({
                    id: `audit-${log.timestamp}-${index}`,
                    type: "AUDIT",
                    subject: `${log.action} – ${log.username}`,
                    details: log.details || "",
                    timestamp: new Date(log.timestamp).getTime(),
                    status: "LOGGED",
                }));

                const emailEntries = (emailNotifications || []).map((n, index) => ({
                    id: `email-${n.sent_at}-${n._id || index}`,
                    type: "EMAIL",
                    subject: n.subject || "Notification",
                    details: n.message ? `${n.recipient_email} – ${n.notification_type || ""}` : n.recipient_email,
                    timestamp: new Date(n.sent_at).getTime(),
                    status: n.status === "SENT" ? "SENT" : "FAILED",
                }));

                const merged = [...auditEntries, ...emailEntries]
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 15);

                setEntries(merged);
            } catch (error) {
                console.error("Failed to load activity log", error);
                setEntries([]);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
        const interval = setInterval(fetchAll, 30000);
        return () => clearInterval(interval);
    }, [relatedEntityId]);

    return (
        <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-sm">Activity &amp; Notifications</h3>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">
                    Live
                </span>
            </div>
            <div className="divide-y max-h-[300px] overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-400 text-xs">Loading...</div>
                ) : entries.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-xs">No activity or emails yet</div>
                ) : (
                    entries.map((n) => (
                        <div
                            key={n.id}
                            className="p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors group"
                        >
                            <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                                {n.type === "EMAIL" ? (
                                    <Icon name="Mail" size={14} />
                                ) : (
                                    <Icon name="Activity" size={14} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] font-semibold text-slate-500 uppercase">
                                        {n.type}
                                    </span>
                                    <span className="text-[9px] text-slate-400">
                                        {new Date(n.timestamp).toLocaleString([], {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-gray-800 mt-0.5">{n.subject}</p>
                                {n.details && (
                                    <p className="text-[10px] text-gray-500 line-clamp-2" title={n.details}>
                                        {n.details}
                                    </p>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <span
                                    className={`text-[9px] font-bold flex items-center justify-end gap-1 ${
                                        n.status === "SENT" ? "text-green-600" : n.status === "FAILED" ? "text-amber-600" : "text-slate-400"
                                    }`}
                                >
                                    <Icon name="Check" size={8} /> {n.status}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
};

export default NotificationLog;
