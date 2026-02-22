// ─── Helper Functions ────────────────────────────────────────
import { CURRENCY_SYMBOLS } from "./constants";

export function getScoreColor(score: number): string {
    if (score >= 85) return "#22c55e";
    if (score >= 70) return "#eab308";
    if (score >= 50) return "#f97316";
    return "#6366f1";
}

export function getScoreLabel(score: number): string {
    if (score >= 85) return "Hot";
    if (score >= 70) return "Strong";
    if (score >= 50) return "Good";
    return "Match";
}

export function timeAgo(dateStr: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
}

export function getFreshnessBadge(dateStr: string): { label: string; color: string; bg: string } | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffDays === 0) return { label: "Today", color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
    if (diffDays <= 3) return { label: `${diffDays}d ago`, color: "#22c55e", bg: "rgba(34,197,94,0.08)" };
    if (diffDays <= 7) return { label: `${diffDays}d ago`, color: "#eab308", bg: "rgba(234,179,8,0.08)" };
    return null;
}

export function getSourceBadge(source: string): string {
    const map: Record<string, string> = {
        greenhouse: "#22c55e", lever: "#a78bfa", adzuna: "#3b82f6", jsearch: "#f97316",
        remoteok: "#14b8a6", ashby: "#10b981",
        serp: "#ef4444", serp_greenhouse: "#16a34a", serp_lever: "#7c3aed",
        serp_indeed: "#6366f1", serp_linkedin: "#0ea5e9", serp_workable: "#14b8a6",
        serp_adzuna: "#2563eb",
    };
    return map[source] || "#64748b";
}

export function formatLPA(val: number | null): string {
    if (!val) return "";
    if (val >= 100) return `${(val / 100).toFixed(1)}Cr`;
    return `${val.toFixed(1)}L`;
}

export function lpaToOriginal(lpa: number, currency: string, rates: Record<string, number>): string {
    const sym = CURRENCY_SYMBOLS[currency] || currency;
    if (currency === "INR" || !currency) return `₹${formatLPA(lpa)}`;
    const rate = rates[currency];
    if (!rate) return "";
    // rates are INR-based: 1 INR = rate units of currency
    // So INR amount × rate = original currency amount
    const original = (lpa * 100000) * rate;
    if (original >= 1000000) return `${sym}${(original / 1000000).toFixed(1)}M`;
    if (original >= 1000) return `${sym}${Math.round(original / 1000)}K`;
    return `${sym}${Math.round(original)}`;
}

export function getSourceConfidence(source: string): { label: string; pct: number; color: string } {
    if (source === "greenhouse" || source === "lever") return { label: "Direct ATS", pct: 100, color: "#22c55e" };
    if (source === "ashby") return { label: "Direct ATS", pct: 95, color: "#10b981" };
    if (source === "remoteok") return { label: "Remote Board", pct: 90, color: "#14b8a6" };
    if (source === "adzuna") return { label: "Aggregator", pct: 85, color: "#3b82f6" };
    if (source === "jsearch") return { label: "Multi-board", pct: 80, color: "#f97316" };
    if (source.startsWith("serp_")) return { label: "Search", pct: 90, color: "#a78bfa" };
    if (source === "serp") return { label: "Google", pct: 75, color: "#ef4444" };
    return { label: "Unknown", pct: 50, color: "#64748b" };
}

export function truncateText(text: string, max: number): { display: string; isTruncated: boolean } {
    if (!text || text.length <= max) return { display: text || "", isTruncated: false };
    return { display: text.slice(0, max) + "...", isTruncated: true };
}
