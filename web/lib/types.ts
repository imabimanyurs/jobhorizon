// ─── Shared Types ────────────────────────────────────────────

export interface Job {
    id: string;
    title: string;
    company: string;
    location: string;
    remote: number;
    apply_url: string;
    source: string;
    posted_date: string;
    match_score: number;
    saved: number;
    created_at: string;
    country: string;
    state: string;
    city: string;
    is_india: number;
    is_faang: number;
    salary_min_lpa: number | null;
    salary_max_lpa: number | null;
    salary_currency: string;
    source_type: string;
    visa_sponsored: number;
    has_equity: number;
}

export interface Stats {
    total: number;
    today: number;
    by_source: Record<string, number>;
    india: number;
    remote: number;
    faang: number;
    with_salary: number;
}

export type AppStatus = "" | "saved" | "applied" | "interviewing" | "rejected" | "offer";

export const APP_STATUSES: { value: AppStatus; label: string; icon: string; color: string }[] = [
    { value: "", label: "Not tracked", icon: "\u25CB", color: "#4a4a6a" },
    { value: "saved", label: "Saved", icon: "🔖", color: "#6366f1" },
    { value: "applied", label: "Applied", icon: "\u2192", color: "#3b82f6" },
    { value: "interviewing", label: "Interviewing", icon: "\u260E", color: "#eab308" },
    { value: "rejected", label: "Rejected", icon: "\u2717", color: "#ef4444" },
    { value: "offer", label: "Offer!", icon: "\u2605", color: "#22c55e" },
];
