"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

/* ── Comprehensive colour‑token map ────────────────────────── */
export interface ThemeTokens {
    // Core surfaces
    pageBg: string;
    headerBg: string;
    headerBorder: string;
    sidebarBg: string;
    sidebarBorder: string;
    cardBg: string;
    cardHoverBg: string;
    cardBorder: string;
    cardHoverBorder: string;
    cardShadow: string;

    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textDim: string;

    // Input / control surfaces
    inputBg: string;
    inputBorder: string;
    inputFocusBorder: string;
    inputPlaceholder: string;

    // Scrollbar
    scrollThumb: string;
    scrollTrack: string;

    // Skeleton
    skeletonStart: string;
    skeletonEnd: string;

    // Popover / dropdown / menu
    menuBg: string;
    menuBorder: string;
    menuShadow: string;

    // Tooltip
    tooltipBg: string;
    tooltipColor: string;

    // Toggle button
    toggleBg: string;
    toggleBorder: string;
    toggleHoverBg: string;

    // Stat pill
    statPillBg: string;
    statPillBorder: string;
    statPillHoverBg: string;
    statPillHoverBorder: string;
    statPillLabelColor: string;

    // Smart-view bar
    smartBarBg: string;

    // Filter tag
    filterTagBg: string;
    filterTagColor: string;

    // Quick-filter badge (inactive)
    badgeInactiveBg: string;
    badgeInactiveColor: string;
    badgeInactiveBorder: string;
    badgeInactiveHoverBg: string;

    // Source row hover
    sourceRowHover: string;
    sourceRowActive: string;

    // Divider
    divider: string;

    // Drawer
    drawerBg: string;
    drawerBorder: string;
    drawerOverlay: string;

    // Empty state
    emptyStateBg: string;

    // Pagination
    paginationVariant: string;
    paginationActiveBg: string;
    paginationActiveColor: string;
    paginationInactiveBg: string;
    paginationInactiveColor: string;
    paginationHoverBg: string;

    // Option bg (selects)
    optionBg: string;

    // Mobile toolbar
    mobileToolbarBg: string;
    mobileToolbarBorder: string;

    // Accent line dot
    dotBg: string;

    // Logo gradient
    logoGradientFrom: string;
    logoGradientTo: string;

    // Job card title colours
    jobTitle: string;
    jobCompany: string;
    jobLocation: string;

    // Bookmark inactive
    bookmarkInactive: string;

    // clear button
    clearBtnBorder: string;
    clearBtnColor: string;
    clearBtnHoverBg: string;

    // Apply button gradient
    applyGradient: string;
    applyHoverGradient: string;

    // Saved button styles
    savedBtnBg: string;
    savedBtnColor: string;
    savedBtnBorder: string;
    savedBtnHoverBg: string;
    savedBtnHoverBorder: string;

    // Buy me a coffee popover
    coffeeBg: string;
    coffeeText: string;
    coffeeSubtext: string;

    // Score label muted
    scoreMuted: string;

    // Stat pill value text
    statPillValueColor: string;

    // Company chip
    companyChipBg: string;
    companyChipBorder: string;
    companyChipColor: string;
    companyChipCountBg: string;
    companyChipCountColor: string;
    companyChipActiveBg: string;
    companyChipActiveColor: string;
    companyChipActiveBorder: string;

    // Switch track (unchecked)
    switchTrackBg: string;

    // Overlay on body for transitions
    transitionOverlay: string;
}

/* ── DARK TOKENS ──────────────────────────────────────────── */
const DARK: ThemeTokens = {
    pageBg: "#0a0a0f",
    headerBg: "rgba(10, 10, 15, 1)",
    headerBorder: "rgba(99, 102, 241, 0.15)",
    sidebarBg: "#12121a",
    sidebarBorder: "#1e1e3a",
    cardBg: "#12121a",
    cardHoverBg: "#161626",
    cardBorder: "#1e1e3a",
    cardHoverBorder: "#2e2e5a",
    cardShadow: "0 8px 30px rgba(0,0,0,0.3)",

    textPrimary: "#e2e8f0",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    textDim: "#4a4a6a",

    inputBg: "#0a0a0f",
    inputBorder: "#2a2a4a",
    inputFocusBorder: "#6366f1",
    inputPlaceholder: "#4a4a6a",

    scrollThumb: "#2a2a4a",
    scrollTrack: "#1a1a2e",

    skeletonStart: "#1e1e3a",
    skeletonEnd: "#2a2a4a",

    menuBg: "#1a1a2e",
    menuBorder: "#2a2a4a",
    menuShadow: "0 8px 30px rgba(0,0,0,0.5)",

    tooltipBg: "#1a1a2e",
    tooltipColor: "#e2e8f0",

    toggleBg: "rgba(18,18,26,0.9)",
    toggleBorder: "#2a2a4a",
    toggleHoverBg: "rgba(30,30,58,0.8)",

    statPillBg: "rgba(18, 18, 26, 0.8)",
    statPillBorder: "#1e1e3a",
    statPillHoverBg: "rgba(30,30,58,0.5)",
    statPillHoverBorder: "rgba(99,102,241,0.3)",
    statPillLabelColor: "#64748b",

    smartBarBg: "rgba(18, 18, 26, 0.95)",

    filterTagBg: "#1e1e3a",
    filterTagColor: "#94a3b8",

    badgeInactiveBg: "#1e1e3a",
    badgeInactiveColor: "#94a3b8",
    badgeInactiveBorder: "#2a2a4a",
    badgeInactiveHoverBg: "#2a2a4a",

    sourceRowHover: "#1e1e3a",
    sourceRowActive: "#1e1e3a",

    divider: "#1e1e3a",

    drawerBg: "#0a0a12",
    drawerBorder: "#1e1e3a",
    drawerOverlay: "rgba(0,0,0,0.6)",

    emptyStateBg: "#12121a",

    paginationVariant: "ghost",
    paginationActiveBg: "#6366f1",
    paginationActiveColor: "white",
    paginationInactiveBg: "transparent",
    paginationInactiveColor: "#94a3b8",
    paginationHoverBg: "#1e1e3a",

    optionBg: "#0a0a0f",

    mobileToolbarBg: "#12121a",
    mobileToolbarBorder: "#1e1e3a",

    dotBg: "#3a3a5a",

    logoGradientFrom: "#e2e8f0",
    logoGradientTo: "#c4b5fd",

    jobTitle: "#f1f5f9",
    jobCompany: "#94a3b8",
    jobLocation: "#64748b",

    bookmarkInactive: "#4a4a6a",

    clearBtnBorder: "#ef4444",
    clearBtnColor: "#ef4444",
    clearBtnHoverBg: "rgba(239,68,68,0.1)",

    applyGradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    applyHoverGradient: "linear-gradient(135deg, #7c7ff7, #a78bfa)",

    savedBtnBg: "rgba(18, 18, 26, 0.9)",
    savedBtnColor: "#e2e8f0",
    savedBtnBorder: "#2a2a4a",
    savedBtnHoverBg: "rgba(30,30,58,0.8)",
    savedBtnHoverBorder: "#6366f1",

    coffeeBg: "#12121f",
    coffeeText: "#e2e8f0",
    coffeeSubtext: "#94a3b8",

    scoreMuted: "#64748b",

    statPillValueColor: "inherit",

    companyChipBg: "rgba(30,30,58,0.5)",
    companyChipBorder: "#2a2a4a",
    companyChipColor: "#94a3b8",
    companyChipCountBg: "rgba(99,102,241,0.15)",
    companyChipCountColor: "#818cf8",
    companyChipActiveBg: "rgba(99,102,241,0.18)",
    companyChipActiveColor: "#a5b4fc",
    companyChipActiveBorder: "#6366f1",

    switchTrackBg: "#2a2a4a",

    transitionOverlay: "rgba(10,10,15,0)",
};

/* ── LIGHT TOKENS ─────────────────────────────────────────── */
const LIGHT: ThemeTokens = {
    pageBg: "#f4f6fa",
    headerBg: "rgba(255, 255, 255, 0.97)",
    headerBorder: "rgba(99, 102, 241, 0.12)",
    sidebarBg: "#ffffff",
    sidebarBorder: "#e2e8f0",
    cardBg: "#ffffff",
    cardHoverBg: "#f8faff",
    cardBorder: "#e2e8f0",
    cardHoverBorder: "#c7d2fe",
    cardShadow: "0 4px 20px rgba(99,102,241,0.08)",

    textPrimary: "#1e293b",
    textSecondary: "#475569",
    textMuted: "#64748b",
    textDim: "#94a3b8",

    inputBg: "#f8fafc",
    inputBorder: "#e2e8f0",
    inputFocusBorder: "#6366f1",
    inputPlaceholder: "#94a3b8",

    scrollThumb: "#c7d2fe",
    scrollTrack: "#f1f5f9",

    skeletonStart: "#e2e8f0",
    skeletonEnd: "#f1f5f9",

    menuBg: "#ffffff",
    menuBorder: "#e2e8f0",
    menuShadow: "0 8px 30px rgba(99,102,241,0.1)",

    tooltipBg: "#1e293b",
    tooltipColor: "#f8fafc",

    toggleBg: "#f1f5f9",
    toggleBorder: "#e2e8f0",
    toggleHoverBg: "#e8ecff",

    statPillBg: "rgba(248, 250, 252, 0.95)",
    statPillBorder: "#e2e8f0",
    statPillHoverBg: "#eef2ff",
    statPillHoverBorder: "rgba(99,102,241,0.3)",
    statPillLabelColor: "#475569",

    smartBarBg: "rgba(255, 255, 255, 0.98)",

    filterTagBg: "#eef2ff",
    filterTagColor: "#475569",

    badgeInactiveBg: "#f1f5f9",
    badgeInactiveColor: "#475569",
    badgeInactiveBorder: "#e2e8f0",
    badgeInactiveHoverBg: "#e8ecff",

    sourceRowHover: "#f1f5f9",
    sourceRowActive: "#eef2ff",

    divider: "#e2e8f0",

    drawerBg: "#ffffff",
    drawerBorder: "#e2e8f0",
    drawerOverlay: "rgba(0,0,0,0.3)",

    emptyStateBg: "#ffffff",

    paginationVariant: "ghost",
    paginationActiveBg: "#6366f1",
    paginationActiveColor: "white",
    paginationInactiveBg: "transparent",
    paginationInactiveColor: "#475569",
    paginationHoverBg: "#eef2ff",

    optionBg: "#ffffff",

    mobileToolbarBg: "#ffffff",
    mobileToolbarBorder: "#e2e8f0",

    dotBg: "#cbd5e1",

    logoGradientFrom: "#1e293b",
    logoGradientTo: "#6366f1",

    jobTitle: "#1e293b",
    jobCompany: "#475569",
    jobLocation: "#64748b",

    bookmarkInactive: "#94a3b8",

    clearBtnBorder: "#ef4444",
    clearBtnColor: "#ef4444",
    clearBtnHoverBg: "rgba(239,68,68,0.06)",

    applyGradient: "linear-gradient(135deg, #6366f1, #818cf8)",
    applyHoverGradient: "linear-gradient(135deg, #818cf8, #a5b4fc)",

    savedBtnBg: "#f8fafc",
    savedBtnColor: "#1e293b",
    savedBtnBorder: "#e2e8f0",
    savedBtnHoverBg: "#eef2ff",
    savedBtnHoverBorder: "#6366f1",

    coffeeBg: "#ffffff",
    coffeeText: "#1e293b",
    coffeeSubtext: "#64748b",

    scoreMuted: "#64748b",

    statPillValueColor: "#1e293b",

    companyChipBg: "#f1f5f9",
    companyChipBorder: "#e2e8f0",
    companyChipColor: "#475569",
    companyChipCountBg: "rgba(99,102,241,0.1)",
    companyChipCountColor: "#6366f1",
    companyChipActiveBg: "#eef2ff",
    companyChipActiveColor: "#4338ca",
    companyChipActiveBorder: "#6366f1",

    switchTrackBg: "#cbd5e1",

    transitionOverlay: "rgba(244,246,250,0)",
};

/* ── Context ──────────────────────────────────────────────── */
interface ThemeModeContextValue {
    isDark: boolean;
    toggleTheme: () => void;
    t: ThemeTokens;
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
    isDark: false,
    toggleTheme: () => { },
    t: LIGHT,
});

export function useThemeMode() {
    return useContext(ThemeModeContext);
}

/* ── Provider ─────────────────────────────────────────────── */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
    const [isDark, setIsDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Hydrate from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("theme-mode");
        if (stored === "dark") setIsDark(true);
        setMounted(true);
    }, []);

    // Sync to <html> and localStorage
    useEffect(() => {
        if (!mounted) return;
        document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
        localStorage.setItem("theme-mode", isDark ? "dark" : "light");

        // Also set CSS vars for scrollbar / global surfaces
        const root = document.documentElement;
        const tokens = isDark ? DARK : LIGHT;
        root.style.setProperty("--page-bg", tokens.pageBg);
        root.style.setProperty("--scroll-thumb", tokens.scrollThumb);
        root.style.setProperty("--scroll-track", tokens.scrollTrack);
        root.style.setProperty("--text-primary", tokens.textPrimary);

        // Smooth body bg transition
        document.body.style.transition = "background-color 0.4s ease, color 0.4s ease";
        document.body.style.backgroundColor = tokens.pageBg;
        document.body.style.color = tokens.textPrimary;
    }, [isDark, mounted]);

    const toggleTheme = useCallback(() => {
        setIsDark((prev) => !prev);
    }, []);

    const t = isDark ? DARK : LIGHT;

    return (
        <ThemeModeContext.Provider value={{ isDark, toggleTheme, t }}>
            {children}
        </ThemeModeContext.Provider>
    );
}
