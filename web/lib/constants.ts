// ─── Design Tokens & Constants ───────────────────────────────

export const CARD_HEIGHT = "130px";
export const TITLE_MAX_CHARS = 67;
export const LOCATION_MAX_CHARS = 67;
export const PER_PAGE = 30;
export const TOOLTIP_DELAY = 400;

export const COLORS = {
    indigo: "#6366f1",
    indigoHover: "#5558e6",
    indigoGlow: "rgba(99, 102, 241, 0.15)",
    bg: "#0a0a0f",
    cardBg: "#12121f",
    cardBorder: "#1e1e3a",
    sidebarBg: "#0d0d18",
    textPrimary: "#f1f5f9",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    textDim: "#4a4a6a",
    danger: "#ef4444",
    success: "#22c55e",
    warning: "#eab308",
    cyan: "#06b6d4",
    pink: "#ec4899",
    purple: "#a78bfa",
    orange: "#fb923c",
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: "$", GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$", SGD: "S$", INR: "₹",
};

export const BADGE_STYLES = {
    faang: { bg: "rgba(234, 179, 8, 0.1)", color: "#eab308", border: "1px solid rgba(234, 179, 8, 0.2)" },
    highPay: { bg: "rgba(34, 197, 94, 0.1)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.2)" },
    remote: { bg: "rgba(139, 92, 246, 0.1)", color: "#a78bfa", border: "1px solid rgba(139, 92, 246, 0.15)" },
    india: { bg: "rgba(249, 115, 22, 0.08)", color: "#fb923c", border: "1px solid rgba(249, 115, 22, 0.15)" },
    visa: { bg: "rgba(6, 182, 212, 0.1)", color: "#06b6d4", border: "1px solid rgba(6, 182, 212, 0.15)" },
    equity: { bg: "rgba(236, 72, 153, 0.1)", color: "#ec4899", border: "1px solid rgba(236, 72, 153, 0.15)" },
    today: { bg: "rgba(34, 197, 94, 0.1)", color: "#22c55e" },
    thisWeek: { bg: "rgba(234, 179, 8, 0.08)", color: "#eab308" },
};
