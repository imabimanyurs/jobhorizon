"use client";

import { useState, useEffect, useCallback, useMemo, memo, Suspense } from "react";
import {
  Box,
  Flex,
  Text,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Button,
  Badge,
  HStack,
  VStack,
  IconButton,
  Select,
  Switch,
  FormControl,
  FormLabel,
  Tooltip,
  useToast,
  Tag,
  TagLabel,
  TagCloseButton,
  Divider,
  Link,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  useDisclosure,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Job, Stats, AppStatus, APP_STATUSES } from "@/lib/types";
import { TITLE_MAX_CHARS, LOCATION_MAX_CHARS, PER_PAGE, TOOLTIP_DELAY, COLORS, BADGE_STYLES } from "@/lib/constants";
import {
  getScoreColor, getScoreLabel, timeAgo, getFreshnessBadge,
  getSourceBadge, formatLPA, lpaToOriginal, getSourceConfidence, truncateText,
} from "@/lib/helpers";
import JobCardSkeleton from "@/app/components/JobCardSkeleton";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionBox = motion.create(Box as any);

// ─── Icons (inline SVG) ──────────────────────────────────────
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const BookmarkIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const BriefcaseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const FireIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 23c-3.6 0-8-3.1-8-9.3C4 8.4 9.4 2 12 1c2.6 1 8 7.4 8 12.7C20 19.9 15.6 23 12 23z" />
  </svg>
);
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

// ─── Main Export with Suspense wrapper ─────────────────────────
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <Box h="100vh" bg="#0a0a0f" display="flex" alignItems="center" justifyContent="center">
        <Text color="#64748b">Loading...</Text>
      </Box>
    }>
      <Dashboard />
    </Suspense>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────
function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState<{ last_run: string | null; new_jobs: number; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [indiaOnly, setIndiaOnly] = useState(false);
  const [faangOnly, setFaangOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [source, setSource] = useState("");
  const [country, setCountry] = useState("");
  const [minSalary, setMinSalary] = useState(0);
  const [minSalaryPreview, setMinSalaryPreview] = useState(0);
  const [maxSalary, setMaxSalary] = useState(0);
  const [maxSalaryPreview, setMaxSalaryPreview] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedFilter, setSavedFilter] = useState(false);
  const [todayOnly, setTodayOnly] = useState(false);
  const [maxDaysAgo, setMaxDaysAgo] = useState(0);
  const [maxDaysPreview, setMaxDaysPreview] = useState(0);
  const [sortBy, setSortBy] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [smartView, setSmartView] = useState(true); // Default ON
  const [jobStatuses, setJobStatuses] = useState<Record<string, AppStatus>>({});
  const [visaOnly, setVisaOnly] = useState(false);
  const [equityOnly, setEquityOnly] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);
  const filterDrawer = useDisclosure();
  const advancedDrawer = useDisclosure();
  const perPage = PER_PAGE;
  const toast = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Derive savedIds from jobStatuses (not from stale "savedJobs" key)
    const stored = localStorage.getItem("jobStatuses");
    if (stored) {
      try {
        const statuses: Record<string, AppStatus> = JSON.parse(stored);
        const ids = new Set<string>();
        Object.entries(statuses).forEach(([id, s]) => { if (s !== "") ids.add(id); });
        setSavedIds(ids);
      } catch { }
    }
    const preset = localStorage.getItem("filterPreset");
    if (preset) {
      try {
        const p = JSON.parse(preset);
        if (p.remoteOnly) setRemoteOnly(true);
        if (p.indiaOnly) setIndiaOnly(true);
        if (p.minScore) setMinScore(p.minScore);
        if (p.source) setSource(p.source);
        if (p.country) setCountry(p.country);
        if (p.minSalary) setMinSalary(p.minSalary);
        if (p.keyword) { setKeyword(p.keyword); setSearchInput(p.keyword); }
      } catch { }
    }
  }, []);

  // Hydrate filters from URL params on mount (#12)
  useEffect(() => {
    const sp = searchParams;
    if (sp.get("keyword")) { setKeyword(sp.get("keyword")!); setSearchInput(sp.get("keyword")!); }
    if (sp.get("remote") === "true") setRemoteOnly(true);
    if (sp.get("india") === "true") setIndiaOnly(true);
    if (sp.get("faang") === "true") setFaangOnly(true);
    if (sp.get("country")) setCountry(sp.get("country")!);
    if (sp.get("source")) setSource(sp.get("source")!);
    if (sp.get("visa") === "true") setVisaOnly(true);
    if (sp.get("equity") === "true") setEquityOnly(true);
    if (sp.get("min_score")) setMinScore(parseInt(sp.get("min_score")!) || 0);
    if (sp.get("company")) { setCompanySearch(sp.get("company")!); setCompanyInput(sp.get("company")!); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load application statuses from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("jobStatuses");
    if (stored) {
      try { setJobStatuses(JSON.parse(stored)); } catch { }
    }
  }, []);

  // Fetch exchange rates once
  useEffect(() => {
    fetch("/api/rates")
      .then((r) => r.json())
      .then((data) => {
        if (data.rates) setExchangeRates(data.rates);
      })
      .catch(() => { });
  }, []);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        min_score: minScore.toString(),
      });
      if (remoteOnly) params.set("remote", "true");
      if (indiaOnly) params.set("india", "true");
      if (faangOnly) params.set("faang", "true");
      if (todayOnly) params.set("today", "true");
      if (maxDaysAgo > 0) params.set("max_days_ago", maxDaysAgo.toString());
      if (smartView) params.set("smart_view", "true");
      if (keyword) params.set("keyword", keyword);
      if (source) params.set("source", source);
      if (country) params.set("country", country);
      if (minSalary > 0) params.set("min_salary", minSalary.toString());
      if (maxSalary > 0) params.set("max_salary", maxSalary.toString());
      if (sortBy) params.set("sort_by", sortBy);
      else if (!smartView) params.set("sort_by", ""); // default non-smart sort
      if (companySearch) params.set("company", companySearch);
      if (visaOnly) params.set("visa", "true");
      if (equityOnly) params.set("equity", "true");

      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();

      if (data.error) {
        toast({ title: "Error loading jobs", description: data.error, status: "error", duration: 4000, position: "top-right" });
        return;
      }

      let filteredJobs = data.jobs || [];
      if (savedFilter) {
        filteredJobs = filteredJobs.filter((j: Job) => savedIds.has(j.id));
      }

      setJobs(filteredJobs);
      setTotal(savedFilter ? filteredJobs.length : data.total || 0);
    } catch {
      toast({ title: "Connection error", description: "Could not reach the API.", status: "warning", duration: 5000, position: "top-right" });
    } finally {
      setLoading(false);
    }
  }, [page, keyword, remoteOnly, indiaOnly, faangOnly, todayOnly, maxDaysAgo, minScore, source, country, savedFilter, savedIds, minSalary, maxSalary, sortBy, companySearch, smartView, visaOnly, equityOnly, toast]);

  // Sync filters to URL (#12)
  useEffect(() => {
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (remoteOnly) params.set("remote", "true");
    if (indiaOnly) params.set("india", "true");
    if (faangOnly) params.set("faang", "true");
    if (country) params.set("country", country);
    if (source) params.set("source", source);
    if (visaOnly) params.set("visa", "true");
    if (equityOnly) params.set("equity", "true");
    if (minScore > 0) params.set("min_score", minScore.toString());
    if (companySearch) params.set("company", companySearch);
    const qs = params.toString();
    const newUrl = qs ? `/?${qs}` : "/";
    window.history.replaceState(null, "", newUrl);
  }, [keyword, remoteOnly, indiaOnly, faangOnly, country, source, visaOnly, equityOnly, minScore, companySearch]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs?action=stats");
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.total !== undefined && !data.error) setStats(data);
    } catch { }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Fetch last run timestamp
  useEffect(() => {
    fetch("/api/jobs?action=last_run")
      .then(r => r.json())
      .then(data => { if (data) setLastRun(data); })
      .catch(() => { });
  }, []);

  // Track unique visitor
  useEffect(() => {
    fetch("/api/visitors", { method: "POST" })
      .then(r => r.json())
      .then(data => { if (data.count) setVisitorCount(data.count); })
      .catch(() => { });
  }, []);

  const handleSearch = () => { setPage(1); setKeyword(searchInput); };

  // Application tracker
  const updateJobStatus = (jobId: string, status: AppStatus) => {
    setJobStatuses((prev) => {
      const next = { ...prev };
      if (status === "") {
        delete next[jobId];
      } else {
        next[jobId] = status;
      }
      localStorage.setItem("jobStatuses", JSON.stringify(next));
      const newSavedIds = new Set<string>();
      Object.entries(next).forEach(([id, s]) => { if (s !== "") newSavedIds.add(id); });
      setSavedIds(newSavedIds);
      return next;
    });
  };

  const toggleSave = useCallback(async (jobId: string) => {
    const current = jobStatuses[jobId] || "";
    if (current === "") {
      updateJobStatus(jobId, "saved");
      toast({ title: "Job saved!", status: "success", duration: 1500, position: "top-right" });
    } else {
      updateJobStatus(jobId, "");
      toast({ title: "Removed from tracked", status: "info", duration: 1500, position: "top-right" });
    }
    // Server-side persist (#4)
    try {
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, action: current === "" ? "save" : "unsave" }),
      });
    } catch { /* silent fallback */ }
  }, [jobStatuses, toast]);

  const clearFilters = () => {
    setKeyword(""); setSearchInput(""); setRemoteOnly(false); setIndiaOnly(false);
    setFaangOnly(false); setTodayOnly(false); setMaxDaysAgo(0); setMaxDaysPreview(0); setMinScore(0); setSource(""); setCountry(""); setMinSalary(0); setMinSalaryPreview(0); setMaxSalary(0); setMaxSalaryPreview(0);
    setSavedFilter(false); setSortBy(""); setCompanySearch(""); setCompanyInput(""); setSmartView(false); setVisaOnly(false); setEquityOnly(false); setPage(1);
  };

  const savePreset = () => {
    const preset = { remoteOnly, indiaOnly, faangOnly, minScore, source, country, minSalary, keyword };
    localStorage.setItem("filterPreset", JSON.stringify(preset));
    toast({ title: "Filter preset saved!", description: "Will auto-apply on next visit.", status: "success", duration: 2000, position: "top-right" });
  };

  const totalPages = useMemo(() => Math.ceil(total / perPage), [total, perPage]);
  const hasFilters = useMemo(() =>
    keyword || remoteOnly || indiaOnly || faangOnly || minScore > 0 || source || country ||
    minSalary > 0 || maxSalary > 0 || savedFilter || todayOnly || maxDaysAgo > 0 || sortBy || companySearch ||
    visaOnly || equityOnly,
    [keyword, remoteOnly, indiaOnly, faangOnly, minScore, source, country, minSalary, maxSalary, savedFilter, todayOnly, maxDaysAgo, sortBy, companySearch, visaOnly, equityOnly]
  );

  // Dynamic filtered stats (#13)
  const filteredCounts = useMemo(() => ({
    showing: jobs.length,
    total,
    remote: jobs.filter((j: Job) => j.remote === 1).length,
    faang: jobs.filter((j: Job) => j.is_faang === 1).length,
    withVisa: jobs.filter((j: Job) => j.visa_sponsored === 1).length,
    withEquity: jobs.filter((j: Job) => j.has_equity === 1).length,
  }), [jobs, total]);

  // ─── Sidebar content for mobile drawers ──────────────────────
  const filterSidebarContent = (
    <VStack spacing={4} align="stretch">
      <InputGroup size="sm">
        <InputLeftElement pointerEvents="none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        </InputLeftElement>
        <Input placeholder="Search jobs..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { handleSearch(); } }}
          bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px"
          _focus={{ borderColor: "#6366f1", boxShadow: "0 0 0 1px #6366f1" }} _placeholder={{ color: "#4a4a6a" }} />
      </InputGroup>
      <VStack spacing={2} align="stretch">
        {([
          ["Remote Only", remoteOnly, (v: boolean) => { setRemoteOnly(v); setPage(1); }, "purple"],
          ["India Only", indiaOnly, (v: boolean) => { setIndiaOnly(v); setPage(1); }, "orange"],
          ["FAANG / Big Tech", faangOnly, (v: boolean) => { setFaangOnly(v); setPage(1); }, "yellow"],
          ["Posted Today", todayOnly, (v: boolean) => { setTodayOnly(v); setPage(1); }, "green"],
          ["Visa Sponsored", visaOnly, (v: boolean) => { setVisaOnly(v); setPage(1); }, "cyan"],
          ["Has Equity", equityOnly, (v: boolean) => { setEquityOnly(v); setPage(1); }, "pink"],
        ] as [string, boolean, (v: boolean) => void, string][]).map(([label, checked, onChange, scheme]) => (
          <FormControl key={label} display="flex" alignItems="center" justifyContent="space-between">
            <FormLabel mb="0" fontSize="sm" color="#94a3b8" fontWeight={500}>{label}</FormLabel>
            <Switch isChecked={checked} onChange={(e) => onChange(e.target.checked)} colorScheme={scheme} size="md" />
          </FormControl>
        ))}
      </VStack>
      <Select size="sm" bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px" value={source}
        onChange={(e) => { setSource(e.target.value); setPage(1); }} _focus={{ borderColor: "#6366f1" }}>
        <option value="" style={{ background: "#0a0a0f" }}>All Sources</option>
        {stats && Object.entries(stats.by_source).map(([s]) => (
          <option key={s} value={s} style={{ background: "#0a0a0f" }}>{s}</option>
        ))}
      </Select>
      <Select size="sm" bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px" value={country}
        onChange={(e) => { setCountry(e.target.value); setPage(1); }} _focus={{ borderColor: "#6366f1" }}>
        <option value="" style={{ background: "#0a0a0f" }}>All Countries</option>
        {["US", "IN", "GB", "CA", "DE", "NL", "FR", "AU", "SG", "IE", "NZ"].map(c => (
          <option key={c} value={c} style={{ background: "#0a0a0f" }}>{c}</option>
        ))}
      </Select>
      {hasFilters && (
        <Button size="sm" variant="outline" borderColor="#ef4444" color="#ef4444" onClick={clearFilters} _hover={{ bg: "rgba(239,68,68,0.1)" }}>Clear All Filters</Button>
      )}
    </VStack>
  );

  const advancedSidebarContent = (
    <VStack spacing={5} align="stretch">
      <Box>
        <Flex justify="space-between" mb={2}>
          <Text fontSize="xs" color="#64748b" fontWeight={600}>Posted Within</Text>
          <Text fontSize="xs" color="#22c55e" fontWeight={700}>{maxDaysPreview === 0 ? "All time" : maxDaysPreview === 1 ? "Today" : `${maxDaysPreview} days`}</Text>
        </Flex>
        <Slider min={0} max={30} step={1} value={maxDaysPreview} onChange={(v) => setMaxDaysPreview(v)} onChangeEnd={(v) => { setMaxDaysAgo(v); setPage(1); }} colorScheme="green">
          <SliderTrack bg="#1e1e3a" h="6px" borderRadius="3px"><SliderFilledTrack bg="linear-gradient(90deg, #22c55e, #16a34a)" /></SliderTrack>
          <SliderThumb boxSize={4} bg="#22c55e" borderColor="#16a34a" borderWidth={2} />
        </Slider>
      </Box>
      <Box>
        <Flex justify="space-between" mb={2}>
          <Text fontSize="xs" color="#64748b" fontWeight={600}>Min Salary (LPA)</Text>
          <Text fontSize="xs" color="#6366f1" fontWeight={700}>{minSalaryPreview > 0 ? `${minSalaryPreview}+ LPA` : "Any"}</Text>
        </Flex>
        <Slider min={0} max={100} step={5} value={minSalaryPreview} onChange={(v) => setMinSalaryPreview(v)} onChangeEnd={(v) => { setMinSalary(v); setPage(1); }} colorScheme="purple">
          <SliderTrack bg="#1e1e3a" h="6px" borderRadius="3px"><SliderFilledTrack bg="linear-gradient(90deg, #6366f1, #8b5cf6)" /></SliderTrack>
          <SliderThumb boxSize={4} bg="#6366f1" borderColor="#8b5cf6" borderWidth={2} />
        </Slider>
      </Box>
      <Box>
        <Flex justify="space-between" mb={2}>
          <Text fontSize="xs" color="#64748b" fontWeight={600}>Max Salary (LPA)</Text>
          <Text fontSize="xs" color="#22d3ee" fontWeight={700}>{maxSalaryPreview > 0 ? `≤${maxSalaryPreview} LPA` : "No cap"}</Text>
        </Flex>
        <Slider min={0} max={100} step={5} value={maxSalaryPreview} onChange={(v) => setMaxSalaryPreview(v)} onChangeEnd={(v) => { setMaxSalary(v); setPage(1); }} colorScheme="cyan">
          <SliderTrack bg="#1e1e3a" h="6px" borderRadius="3px"><SliderFilledTrack bg="linear-gradient(90deg, #22d3ee, #06b6d4)" /></SliderTrack>
          <SliderThumb boxSize={4} bg="#22d3ee" borderColor="#06b6d4" borderWidth={2} />
        </Slider>
      </Box>
      <Box>
        <Text fontSize="xs" color="#64748b" mb={1.5} fontWeight={600}>Min Match Score</Text>
        <Select size="sm" bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px" value={minScore} onChange={(e) => { setMinScore(Number(e.target.value)); setPage(1); }}>
          <option value="0" style={{ background: "#0a0a0f" }}>Any score</option>
          <option value="50" style={{ background: "#0a0a0f" }}>50+</option>
          <option value="70" style={{ background: "#0a0a0f" }}>70+</option>
          <option value="90" style={{ background: "#0a0a0f" }}>90+</option>
        </Select>
      </Box>
      <Box>
        <Text fontSize="xs" color="#64748b" mb={1.5} fontWeight={600}>Sort By</Text>
        <Select size="sm" bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
          <option value="" style={{ background: "#0a0a0f" }}>Newest First</option>
          <option value="score" style={{ background: "#0a0a0f" }}>Match Score</option>
          <option value="salary" style={{ background: "#0a0a0f" }}>Salary (High→Low)</option>
          <option value="date" style={{ background: "#0a0a0f" }}>Date Posted</option>
          <option value="smart" style={{ background: "#0a0a0f" }}>Smart Rank</option>
        </Select>
      </Box>
      <Box>
        <Text fontSize="xs" color="#64748b" mb={1.5} fontWeight={600}>Company</Text>
        <Input size="sm" placeholder="e.g. Google, Meta..." value={companyInput}
          onChange={(e) => setCompanyInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setCompanySearch(companyInput); setPage(1); } }}
          onBlur={() => { if (companyInput !== companySearch) { setCompanySearch(companyInput); setPage(1); } }}
          bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px"
          _focus={{ borderColor: "#6366f1" }} _placeholder={{ color: "#4a4a6a" }} />
      </Box>
      <Box>
        <Text fontSize="xs" color="#64748b" mb={2} fontWeight={600}>Quick Filters</Text>
        <Flex gap={1.5} flexWrap="wrap">
          {["senior", "staff", "lead", "principal", "intern", "junior", "manager"].map((tag) => (
            <Badge key={tag} px={2.5} py={1} borderRadius="full" fontSize="10px" fontWeight={600} cursor="pointer" transition="all 0.15s"
              bg={keyword === tag ? "#6366f1" : "#1e1e3a"} color={keyword === tag ? "white" : "#94a3b8"}
              border="1px solid" borderColor={keyword === tag ? "#6366f1" : "#2a2a4a"}
              _hover={{ bg: keyword === tag ? "#5558e6" : "#2a2a4a", borderColor: "#6366f1" }}
              onClick={() => { if (keyword === tag) { setKeyword(""); setSearchInput(""); } else { setKeyword(tag); setSearchInput(tag); } setPage(1); }}
            >{tag}</Badge>
          ))}
        </Flex>
      </Box>
    </VStack>
  );

  return (
    <Box h="100vh" bg="#0a0a0f" overflow="hidden" display="flex" flexDirection="column">
      {/* ─── Header ─────────────────────────────────────── */}
      <Box
        as="header"
        position="relative"
        zIndex={100}
        bg="rgba(10, 10, 15, 1)"
        borderBottom="1px solid"
        borderColor="rgba(99, 102, 241, 0.15)"
        px={{ base: 3, md: 6 }}
        py={3}
        flexShrink={0}
      >
        <Flex maxW="1600px" mx="auto" align="center" justify="space-between">
          {/* ─── Left: Logo ─── */}
          <HStack spacing={{ base: 2, md: 3 }} flexShrink={0} minW={0}>
            <Box
              w={{ base: "32px", md: "40px" }} h={{ base: "32px", md: "40px" }} borderRadius="12px"
              bg="linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)"
              display="flex" alignItems="center" justifyContent="center"
              boxShadow="0 0 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
              transition="all 0.3s ease"
              _hover={{ boxShadow: "0 0 32px rgba(99,102,241,0.6)", transform: "scale(1.05)" }}
            >
              <Image src="/icon/suitcase.png" alt="JobHorizon" width={24} height={24} />
            </Box>
            <Box>
              <HStack spacing={1.5} align="baseline">
                <Heading size={{ base: "sm", md: "md" }} fontWeight={800} letterSpacing="-0.03em"
                  bgGradient="linear(to-r, #e2e8f0, #c4b5fd)"
                  bgClip="text"
                >JobHorizon</Heading>
                <Box w="6px" h="6px" borderRadius="full" bg="#22c55e" boxShadow="0 0 8px rgba(34,197,94,0.6)" />
              </HStack>
              <Text fontSize={{ base: "8px", md: "10px" }} color="#64748b" mt={0.5} letterSpacing="0.04em" textTransform="uppercase" display={{ base: "none", sm: "block" }}>
                Intelligent Job Aggregator
              </Text>
            </Box>
          </HStack>

          {/* ─── Center: Stats + Last Updated ─── */}
          {stats && (
            <HStack spacing={1} display={{ base: "none", lg: "flex" }} flex={1} justify="center">
              <StatPill label="Total" value={stats.total.toLocaleString()} color="#e2e8f0" icon="📊" />
              <StatPill label="New Today" value={`+${stats.today}`} color="#22c55e" icon="🆕" />
              <StatPill label="India" value={stats.india.toString()} color="#f97316" icon="🇮🇳" />
              <StatPill label="Remote" value={stats.remote.toString()} color="#8b5cf6" icon="🏠" />
              <StatPill label="FAANG" value={stats.faang.toString()} color="#eab308" icon="⭐" />
              <StatPill label="Salary" value={stats.with_salary.toString()} color="#22d3ee" icon="💰" />
              {lastRun && lastRun.last_run && (
                <Tooltip
                  label={`Last scraped: ${new Date(lastRun.last_run).toLocaleString()} — ${lastRun.new_jobs} new jobs added`}
                  placement="bottom" hasArrow bg="#1a1a2e" color="#e2e8f0" fontSize="xs" px={3} py={2} borderRadius="8px" maxW="300px"
                >
                  <Box>
                    <StatPill label="Last Updated" value={timeAgo(lastRun.last_run)} color="#22c55e" icon="🔄" />
                  </Box>
                </Tooltip>
              )}
            </HStack>
          )}

          {/* ─── Right: Visitors + Saved ─── */}
          <HStack spacing={2} flexShrink={0}>
            {/* Desktop: Visitors pill with Buy Me a Coffee popover on HOVER */}
            <Popover trigger="hover" placement="bottom-end" openDelay={200} closeDelay={400}>
              <PopoverTrigger>
                <Box cursor="pointer" display={{ base: "none", md: "block" }}>
                  <StatPill label="Visitors" value={visitorCount > 0 ? visitorCount.toLocaleString() : "—"} color="#ec4899" icon="👥" />
                </Box>
              </PopoverTrigger>
              <PopoverContent
                bg="#12121f" border="1px solid #2a2a4a" borderRadius="14px"
                w="240px" boxShadow="0 8px 32px rgba(0,0,0,0.5)" _focus={{ outline: "none" }}
              >
                <PopoverArrow bg="#12121f" borderColor="#2a2a4a" />
                <PopoverBody p={4}>
                  <Box textAlign="center">
                    <Text fontWeight={700} fontSize="sm" mb={1.5} color="#e2e8f0">Thanks for visiting! 🎉</Text>
                    <Text fontSize="xs" color="#94a3b8" mb={3} lineHeight="1.5">
                      JobHorizon is free &amp; open source.<br />If it helped you, consider supporting:
                    </Text>
                    <Link
                      href="https://www.buymeacoffee.com/rsabimanyu"
                      isExternal
                      _hover={{ textDecoration: "none" }}
                    >
                      <Flex
                        align="center" justify="center" gap={1.5}
                        bg="linear-gradient(135deg, #ffdd00, #f7a800)"
                        color="#1a1a2e" borderRadius="10px"
                        px={4} py={2} fontWeight={700} fontSize="xs"
                        transition="all 0.2s"
                        _hover={{ transform: "scale(1.05)", boxShadow: "0 0 16px rgba(255,221,0,0.5)" }}
                      >
                        <Text fontSize="md">☕</Text>
                        <Text>Buy Me a Coffee</Text>
                      </Flex>
                    </Link>
                  </Box>
                </PopoverBody>
              </PopoverContent>
            </Popover>

            {/* Mobile: Visitors button with Buy Me a Coffee popover on CLICK */}
            <Popover trigger="click" placement="bottom-end" openDelay={0} closeDelay={300}>
              <PopoverTrigger>
                <Button display={{ base: "flex", md: "none" }} size="xs" variant="unstyled" alignItems="center"
                  bg="rgba(18,18,26,0.9)" border="1px solid #2a2a4a" borderRadius="8px" px={2} py={1} h="auto"
                  color="#ec4899" fontSize="10px" fontWeight={700}
                >👥 {visitorCount > 0 ? visitorCount : ""}</Button>
              </PopoverTrigger>
              <PopoverContent
                bg="#12121f" border="1px solid #2a2a4a" borderRadius="14px"
                w="240px" boxShadow="0 8px 32px rgba(0,0,0,0.5)" _focus={{ outline: "none" }}
              >
                <PopoverArrow bg="#12121f" borderColor="#2a2a4a" />
                <PopoverBody p={4}>
                  <Box textAlign="center">
                    <Text fontWeight={700} fontSize="sm" mb={1.5} color="#e2e8f0">Thanks for visiting! 🎉</Text>
                    <Text fontSize="xs" color="#94a3b8" mb={3} lineHeight="1.5">
                      JobHorizon is free &amp; open source.<br />If it helped you, consider supporting:
                    </Text>
                    <Link
                      href="https://www.buymeacoffee.com/rsabimanyu"
                      isExternal
                      _hover={{ textDecoration: "none" }}
                    >
                      <Flex
                        align="center" justify="center" gap={1.5}
                        bg="linear-gradient(135deg, #ffdd00, #f7a800)"
                        color="#1a1a2e" borderRadius="10px"
                        px={4} py={2} fontWeight={700} fontSize="xs"
                        transition="all 0.2s"
                        _hover={{ transform: "scale(1.05)", boxShadow: "0 0 16px rgba(255,221,0,0.5)" }}
                      >
                        <Text fontSize="md">☕</Text>
                        <Text>Buy Me a Coffee</Text>
                      </Flex>
                    </Link>
                  </Box>
                </PopoverBody>
              </PopoverContent>
            </Popover>

            {/* Saved Jobs Button */}
            <Button
              size={{ base: "xs", md: "md" }}
              variant="unstyled"
              display="flex" alignItems="center"
              bg={savedFilter ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(18, 18, 26, 0.9)"}
              color={savedFilter ? "white" : "#e2e8f0"}
              borderRadius={{ base: "8px", md: "12px" }}
              border="1px solid"
              borderColor={savedFilter ? "#8b5cf6" : "#2a2a4a"}
              px={{ base: 2, md: 4 }} py={{ base: 1, md: 2.5 }} h={{ base: "auto", md: "42px" }}
              fontSize={{ base: "10px", md: "sm" }} fontWeight={700}
              letterSpacing="0.02em"
              boxShadow={savedFilter ? "0 0 20px rgba(99,102,241,0.4)" : "none"}
              _hover={{
                bg: savedFilter ? "linear-gradient(135deg, #7c7ff7, #a78bfa)" : "rgba(30,30,58,0.8)",
                borderColor: savedFilter ? "#a78bfa" : "#6366f1",
                transform: "scale(1.03)",
              }}
              transition="all 0.2s ease"
              onClick={() => { setSavedFilter(!savedFilter); setPage(1); }}
              leftIcon={savedFilter ? <Text fontSize={{ base: "10px", md: "sm" }}>🏠</Text> : <BookmarkIcon filled={false} />}
              position="relative"
            >
              {savedFilter ? "Home" : "Saved"}
              {!savedFilter && savedIds.size > 0 && (
                <Badge
                  ml={1} bg="#ef4444" color="white" borderRadius="full"
                  fontSize="8px" minW="16px" h="16px" display="flex" alignItems="center" justifyContent="center"
                  boxShadow="0 0 8px rgba(239,68,68,0.4)"
                >{savedIds.size}</Badge>
              )}
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* ─── Mobile Toolbar ────────────────────────────── */}
      <Flex display={{ base: "flex", lg: "none" }} px={3} pt={2} pb={1} gap={1.5}>
        <Button flex={1} size="xs" leftIcon={<Text fontSize="xs">⚙️</Text>}
          bg="#12121a" border="1px solid #2a2a4a" color="#94a3b8" borderRadius="8px"
          _hover={{ bg: "#1e1e3a" }} onClick={filterDrawer.onOpen} fontSize="10px" fontWeight={600} h="32px"
        >Filters{hasFilters ? " ●" : ""}</Button>
        <Button flex={1} size="xs" leftIcon={<Text fontSize="xs">📊</Text>}
          bg="#12121a" border="1px solid #2a2a4a" color="#94a3b8" borderRadius="8px"
          _hover={{ bg: "#1e1e3a" }} onClick={advancedDrawer.onOpen} fontSize="10px" fontWeight={600} h="32px"
        >Advanced</Button>
        {stats && (
          <>
            <Flex flex={1} direction="column" align="center" justify="center" bg="#12121a" border="1px solid #1e1e3a" borderRadius="8px" h="32px" px={1}>
              <Text fontSize="8px" color="#64748b" fontWeight={600} lineHeight={1}>TOTAL</Text>
              <Text fontSize="11px" color="#e2e8f0" fontWeight={700} lineHeight={1.2}>{stats.total.toLocaleString()}</Text>
            </Flex>
            <Flex flex={1} direction="column" align="center" justify="center" bg="#12121a" border="1px solid #1e1e3a" borderRadius="8px" h="32px" px={1}>
              <Text fontSize="8px" color="#64748b" fontWeight={600} lineHeight={1}>TODAY</Text>
              <Text fontSize="11px" color="#22c55e" fontWeight={700} lineHeight={1.2}>+{stats.today}</Text>
            </Flex>
          </>
        )}
      </Flex>

      {/* ─── Mobile Drawers ───────────────────────────────── */}
      <Drawer isOpen={filterDrawer.isOpen} placement="left" onClose={filterDrawer.onClose} size="xs">
        <DrawerOverlay bg="rgba(0,0,0,0.6)" />
        <DrawerContent bg="#0a0a12" borderRight="1px solid #1e1e3a">
          <DrawerCloseButton color="#94a3b8" />
          <DrawerHeader color="#e2e8f0" fontSize="md" borderBottom="1px solid #1e1e3a">Filters</DrawerHeader>
          <DrawerBody px={4} py={4}>
            {filterSidebarContent}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <Drawer isOpen={advancedDrawer.isOpen} placement="right" onClose={advancedDrawer.onClose} size="xs">
        <DrawerOverlay bg="rgba(0,0,0,0.6)" />
        <DrawerContent bg="#0a0a12" borderLeft="1px solid #1e1e3a">
          <DrawerCloseButton color="#94a3b8" />
          <DrawerHeader color="#e2e8f0" fontSize="md" borderBottom="1px solid #1e1e3a">Advanced</DrawerHeader>
          <DrawerBody px={4} py={4}>
            {advancedSidebarContent}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* ─── Main Layout ────────────────────────────────── */}
      <Flex maxW="1600px" mx="auto" px={{ base: 2, md: 4 }} py={{ base: 2, md: 4 }} gap={5} direction={{ base: "column", lg: "row" }} flex={1} overflow="hidden">
        {/* ─── Sidebar ──────────────────────────────────── */}
        <Box
          w="260px"
          flexShrink={0}
          display={{ base: "none", lg: "block" }}
          overflowY="auto"
          css={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { background: '#2a2a4a', borderRadius: '4px' } }}
        >
          <VStack spacing={5} bg="#12121a" border="1px solid #1e1e3a" borderRadius="16px" p={5} align="stretch">
            <Flex justify="space-between" align="center">
              <Heading size="xs" color="#94a3b8" textTransform="uppercase" letterSpacing="0.08em">Filters</Heading>
              <Button size="xs" variant="ghost" color="#6366f1" onClick={savePreset} _hover={{ bg: "#1e1e3a" }}>
                Save Preset
              </Button>
            </Flex>

            {/* Search */}
            <InputGroup size="sm">
              <InputLeftElement pointerEvents="none" color="#64748b"><SearchIcon /></InputLeftElement>
              <Input
                placeholder="Search jobs..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px"
                _focus={{ borderColor: "#6366f1", boxShadow: "0 0 0 1px #6366f1" }}
                _hover={{ borderColor: "#3a3a5a" }}
                _placeholder={{ color: "#4a4a6a" }}
              />
            </InputGroup>

            {/* Quick Toggles */}
            <VStack spacing={3} align="stretch">
              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel htmlFor="remote-toggle" mb="0" fontSize="sm" color="#94a3b8" fontWeight={500}>
                  Remote Only
                </FormLabel>
                <Switch id="remote-toggle" isChecked={remoteOnly} onChange={(e) => { setRemoteOnly(e.target.checked); setPage(1); }} colorScheme="purple" size="md" />
              </FormControl>

              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel htmlFor="india-toggle" mb="0" fontSize="sm" color="#94a3b8" fontWeight={500}>
                  India Only
                </FormLabel>
                <Switch id="india-toggle" isChecked={indiaOnly} onChange={(e) => { setIndiaOnly(e.target.checked); setPage(1); }} colorScheme="orange" size="md" />
              </FormControl>

              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel htmlFor="faang-toggle" mb="0" fontSize="sm" color="#94a3b8" fontWeight={500}>
                  FAANG / Big Tech
                </FormLabel>
                <Switch id="faang-toggle" isChecked={faangOnly} onChange={(e) => { setFaangOnly(e.target.checked); setPage(1); }} colorScheme="yellow" size="md" />
              </FormControl>

              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel htmlFor="today-toggle" mb="0" fontSize="sm" color="#94a3b8" fontWeight={500}>
                  Posted Today
                </FormLabel>
                <Switch id="today-toggle" isChecked={todayOnly} onChange={(e) => { setTodayOnly(e.target.checked); setPage(1); }} colorScheme="green" size="md" />
              </FormControl>
            </VStack>

            {/* Source Filter */}
            <Box>
              <Text fontSize="xs" color="#64748b" mb={1.5} fontWeight={600}>Source</Text>
              <Select
                size="sm" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}
                bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px" _focus={{ borderColor: "#6366f1" }}
              >
                <option value="">All Sources</option>
                <option value="greenhouse">Greenhouse</option>
                <option value="lever">Lever</option>
                <option value="adzuna">Adzuna</option>
                <option value="jsearch">JSearch</option>
                <option value="serp">SerpAPI</option>
              </Select>
            </Box>

            {/* Country Filter */}
            <Box>
              <Text fontSize="xs" color="#64748b" mb={1.5} fontWeight={600}>Country</Text>
              <Select
                size="sm" value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}
                bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px" _focus={{ borderColor: "#6366f1" }}
              >
                <option value="">All Countries</option>
                <option value="IN">🇮🇳 India</option>
                <option value="US">🇺🇸 United States</option>
                <option value="GB">🇬🇧 United Kingdom</option>
                <option value="CA">🇨🇦 Canada</option>
                <option value="DE">🇩🇪 Germany</option>
                <option value="NL">🇳🇱 Netherlands</option>
                <option value="IE">🇮🇪 Ireland</option>
                <option value="FR">🇫🇷 France</option>
                <option value="NZ">🇳🇿 New Zealand</option>
                <option value="MY">🇲🇾 Malaysia</option>
                <option value="JP">🇯🇵 Japan</option>
                <option value="SG">🇸🇬 Singapore</option>
                <option value="AU">🇦🇺 Australia</option>
              </Select>
            </Box>

            {/* Perks Filters */}
            <VStack spacing={3} align="stretch">
              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel htmlFor="visa-toggle" mb="0" fontSize="sm" color="#94a3b8" fontWeight={500}>
                  Visa Sponsored
                </FormLabel>
                <Switch id="visa-toggle" isChecked={visaOnly} onChange={(e) => { setVisaOnly(e.target.checked); setPage(1); }} colorScheme="cyan" size="md" />
              </FormControl>

              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel htmlFor="equity-toggle" mb="0" fontSize="sm" color="#94a3b8" fontWeight={500}>
                  Has Equity/Stock
                </FormLabel>
                <Switch id="equity-toggle" isChecked={equityOnly} onChange={(e) => { setEquityOnly(e.target.checked); setPage(1); }} colorScheme="pink" size="md" />
              </FormControl>
            </VStack>

            {/* Active Filters */}
            {hasFilters && (
              <Box>
                <HStack mb={2} justify="space-between">
                  <Text fontSize="xs" color="#64748b" fontWeight={600}>Active Filters</Text>
                  <Button size="xs" variant="ghost" color="#ef4444" onClick={clearFilters} _hover={{ bg: "#1a0a0a" }}>Clear all</Button>
                </HStack>
                <Flex gap={1.5} flexWrap="wrap">
                  {keyword && <FilterTag label={`"${keyword}"`} onRemove={() => { setKeyword(""); setSearchInput(""); setPage(1); }} />}
                  {remoteOnly && <FilterTag label="Remote" onRemove={() => { setRemoteOnly(false); setPage(1); }} />}
                  {indiaOnly && <FilterTag label="India" onRemove={() => { setIndiaOnly(false); setPage(1); }} />}
                  {faangOnly && <FilterTag label="FAANG" onRemove={() => { setFaangOnly(false); setPage(1); }} />}
                  {savedFilter && <FilterTag label="Saved" onRemove={() => { setSavedFilter(false); setPage(1); }} />}
                  {todayOnly && <FilterTag label="Today" onRemove={() => { setTodayOnly(false); setPage(1); }} />}
                  {maxDaysAgo > 0 && <FilterTag label={`≤${maxDaysAgo}d`} onRemove={() => { setMaxDaysAgo(0); setPage(1); }} />}
                  {minScore > 0 && <FilterTag label={`Score ${minScore}+`} onRemove={() => { setMinScore(0); setPage(1); }} />}
                  {source && <FilterTag label={source} onRemove={() => { setSource(""); setPage(1); }} />}
                  {country && <FilterTag label={country} onRemove={() => { setCountry(""); setPage(1); }} />}
                  {minSalary > 0 && <FilterTag label={`${minSalary}+ LPA`} onRemove={() => { setMinSalary(0); setPage(1); }} />}
                  {sortBy && <FilterTag label={`Sort: ${sortBy}`} onRemove={() => { setSortBy(""); setPage(1); }} />}
                  {companySearch && <FilterTag label={`Co: ${companySearch}`} onRemove={() => { setCompanySearch(""); setCompanyInput(""); setPage(1); }} />}
                  {visaOnly && <FilterTag label="Visa" onRemove={() => { setVisaOnly(false); setPage(1); }} />}
                  {equityOnly && <FilterTag label="Equity" onRemove={() => { setEquityOnly(false); setPage(1); }} />}
                </Flex>
              </Box>
            )}

            {/* Sources */}
            {stats && (
              <>
                <Divider borderColor="#1e1e3a" />
                <Box>
                  <Text fontSize="xs" color="#64748b" mb={2} fontWeight={600}>Sources</Text>
                  <VStack align="stretch" spacing={1.5}>
                    {(() => {
                      const entries = Object.entries(stats.by_source);
                      const visible = sourcesExpanded ? entries : entries.slice(0, 3);
                      return (
                        <>
                          {visible.map(([src, count]) => (
                            <Flex
                              key={src} justify="space-between" align="center" fontSize="sm"
                              cursor="pointer" px={1.5} py={0.5} borderRadius="6px" transition="all 0.1s"
                              _hover={{ bg: "#1e1e3a" }}
                              onClick={() => { setSource(source === src ? "" : src); setPage(1); }}
                              bg={source === src ? "#1e1e3a" : "transparent"}
                            >
                              <HStack spacing={2}>
                                <Box w="8px" h="8px" borderRadius="full" bg={getSourceBadge(src)} />
                                <Text color="#94a3b8" textTransform="capitalize" fontSize="xs">{src.replace("serp_", "serp:")}</Text>
                              </HStack>
                              <Text color="#e2e8f0" fontWeight={600} fontSize="xs">{count}</Text>
                            </Flex>
                          ))}
                          {entries.length > 3 && (
                            <Flex
                              align="center" justify="center" cursor="pointer" py={1} borderRadius="6px"
                              _hover={{ bg: "#1e1e3a" }} transition="all 0.15s"
                              onClick={() => setSourcesExpanded(!sourcesExpanded)}
                            >
                              <Text fontSize="xs" color="#6366f1" fontWeight={600}>
                                {sourcesExpanded ? "Show less" : `View more (${entries.length - 3})`}
                              </Text>
                              <Box ml={1} color="#6366f1" transform={sourcesExpanded ? "rotate(180deg)" : "rotate(0deg)"} transition="transform 0.2s">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
                              </Box>
                            </Flex>
                          )}
                        </>
                      );
                    })()}
                  </VStack>
                </Box>
              </>
            )}
          </VStack>
        </Box>

        {/* ─── Job List ─────────────────────────────────── */}
        <Box flex={1} display="flex" flexDirection="column" overflow="hidden" maxW="100%" minW={0}>
          {/* Smart View Bar */}
          <Flex
            justify="space-between" align="center" mb={{ base: 2, md: 4 }} p={{ base: 2, md: 3 }}
            bg="rgba(18, 18, 26, 0.95)" border="1px solid" borderRadius={{ base: "10px", md: "12px" }}
            borderColor={smartView ? "rgba(34, 197, 94, 0.3)" : "#1e1e3a"}
            transition="all 0.2s ease"
            flexShrink={0}
          >
            <HStack spacing={{ base: 1.5, md: 3 }}>
              <HStack
                spacing={{ base: 1.5, md: 2 }} cursor="pointer"
                onClick={() => { setSmartView(!smartView); setPage(1); }}
              >
                <Box
                  w={{ base: "24px", md: "32px" }} h={{ base: "24px", md: "32px" }} borderRadius="8px" display="flex" alignItems="center" justifyContent="center"
                  bg={smartView ? "rgba(34, 197, 94, 0.15)" : "#1e1e3a"}
                  border="1px solid"
                  borderColor={smartView ? "rgba(34, 197, 94, 0.3)" : "#2a2a4a"}
                  transition="all 0.2s ease" fontSize={{ base: "12px", md: "16px" }} flexShrink={0}
                >
                  {smartView ? "🧠" : "📋"}
                </Box>
                <Box>
                  <Text fontSize={{ base: "xs", md: "sm" }} fontWeight={600} color={smartView ? "#22c55e" : "#94a3b8"} whiteSpace="nowrap">
                    {smartView ? "Smart View" : "All Jobs"}
                  </Text>
                  <Text fontSize={{ base: "8px", md: "10px" }} color="#64748b" mt={-0.5} display={{ base: "none", sm: "block" }}>
                    {smartView ? "Score≥70 · Fresh · High signal" : "Showing everything"}
                  </Text>
                </Box>
              </HStack>
              <Switch
                isChecked={smartView}
                onChange={(e) => { setSmartView(e.target.checked); setPage(1); }}
                colorScheme="green" size={{ base: "sm", md: "md" }}
              />
            </HStack>
            <HStack spacing={{ base: 1, md: 3 }} flexShrink={0}>
              <Text fontSize={{ base: "xs", md: "sm" }} color="#64748b" whiteSpace="nowrap">
                {loading ? "..." : (
                  <>
                    <Text as="span" color="#e2e8f0" fontWeight={700}>{total.toLocaleString()}</Text> jobs
                  </>
                )}
              </Text>
              {totalPages > 1 && (
                <HStack spacing={{ base: 0, md: 1 }}>
                  <Button size="xs" variant="ghost" color="#94a3b8" isDisabled={page <= 1} onClick={() => setPage(page - 1)} _hover={{ bg: "#1e1e3a" }} px={{ base: 1, md: 2 }} fontSize={{ base: "10px", md: "xs" }} minW="auto">Prev</Button>
                  <Text fontSize={{ base: "9px", md: "xs" }} color="#64748b">{page}/{totalPages}</Text>
                  <Button size="xs" variant="ghost" color="#94a3b8" isDisabled={page >= totalPages} onClick={() => setPage(page + 1)} _hover={{ bg: "#1e1e3a" }} px={{ base: 1, md: 2 }} fontSize={{ base: "10px", md: "xs" }} minW="auto">Next</Button>
                </HStack>
              )}
            </HStack>
          </Flex>

          {/* Scrollable job cards area */}
          <Box flex={1} overflowY="auto" pr={{ base: 0, md: 3 }} css={{ '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-thumb': { background: '#2a2a4a', borderRadius: '6px' }, '&::-webkit-scrollbar-track': { background: 'transparent' } }}>
            {loading ? (
              <VStack spacing={3} align="stretch">
                {Array.from({ length: 6 }).map((_, i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </VStack>
            ) : jobs.length === 0 ? (
              <Flex justify="center" align="center" flex={1} w="100%" bg="#12121a" borderRadius="14px" border="1px solid #1e1e3a" p={5}>
                <VStack spacing={4} py={12} px={6} textAlign="center">
                  <Text fontSize="4xl">{savedFilter ? "🔖" : hasFilters ? "🔍" : "📭"}</Text>
                  <Text color="#e2e8f0" fontWeight={600} fontSize="lg">
                    {savedFilter ? "No saved jobs yet" : hasFilters ? "No jobs match your filters" : "No jobs found"}
                  </Text>
                  <Text color="#64748b" fontSize="sm" maxW="320px">
                    {savedFilter
                      ? "Browse jobs and click the bookmark icon to save them here for quick access."
                      : hasFilters
                        ? "Try adjusting your search criteria or removing some filters to see more results."
                        : "Jobs will appear here once data is available. Check back soon!"}
                  </Text>
                  {savedFilter ? (
                    <Button size="sm" bg="linear-gradient(135deg, #6366f1, #8b5cf6)" color="white" borderRadius="10px" _hover={{ opacity: 0.9 }}
                      onClick={() => { setSavedFilter(false); setPage(1); }}
                    >Browse Jobs</Button>
                  ) : hasFilters ? (
                    <Button size="sm" variant="outline" borderColor="#2a2a4a" color="#94a3b8" borderRadius="10px" onClick={clearFilters} _hover={{ bg: "#1e1e3a", borderColor: "#6366f1" }}>Clear Filters</Button>
                  ) : null}
                </VStack>
              </Flex>
            ) : (
              <AnimatePresence mode="popLayout">
                <VStack spacing={3} align="stretch">
                  {jobs.map((job, index) => (
                    <MotionBox
                      key={job.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                    >
                      <JobCard
                        job={job}
                        isSaved={savedIds.has(job.id)}
                        onToggleSave={() => toggleSave(job.id)}
                        rates={exchangeRates}
                        showTracker={savedFilter}
                        status={(jobStatuses[job.id] || "") as AppStatus}
                        onStatusChange={(s: AppStatus) => updateJobStatus(job.id, s)}
                      />
                    </MotionBox>
                  ))}
                </VStack>
              </AnimatePresence>
            )}

            {totalPages > 1 && !loading && (
              <Flex justify="center" mt={6} mb={4} gap={2}>
                <Button size="sm" variant="outline" borderColor="#2a2a4a" color="#94a3b8" isDisabled={page <= 1} onClick={() => setPage(page - 1)} _hover={{ bg: "#1e1e3a", borderColor: "#6366f1" }}>
                  Prev
                </Button>
                <HStack spacing={1}>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pageNum = page <= 3 ? i + 1 : page - 2 + i;
                    if (pageNum > totalPages || pageNum < 1) return null;
                    return (
                      <Button key={pageNum} size="sm" variant={pageNum === page ? "solid" : "ghost"}
                        bg={pageNum === page ? "#6366f1" : "transparent"} color={pageNum === page ? "white" : "#94a3b8"}
                        onClick={() => setPage(pageNum)} _hover={{ bg: pageNum === page ? "#6366f1" : "#1e1e3a" }} minW={{ base: "30px", md: "36px" }} fontSize={{ base: "xs", md: "sm" }}
                      >{pageNum}</Button>
                    );
                  })}
                </HStack>
                <Button size="sm" variant="outline" borderColor="#2a2a4a" color="#94a3b8" isDisabled={page >= totalPages} onClick={() => setPage(page + 1)} _hover={{ bg: "#1e1e3a", borderColor: "#6366f1" }}>
                  Next
                </Button>
              </Flex>
            )}
          </Box>
        </Box>

        {/* ─── Right Sidebar ─────────────────────────────── */}
        <Box
          w="270px"
          flexShrink={0}
          display={{ base: "none", lg: "block" }}
          overflowY="auto"
          css={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { background: '#2a2a4a', borderRadius: '4px' } }}
        >
          <VStack spacing={5} bg="#12121a" border="1px solid #1e1e3a" borderRadius="16px" p={5} align="stretch">
            <Heading size="xs" color="#94a3b8" textTransform="uppercase" letterSpacing="0.08em">Advanced</Heading>

            {/* ─── Date Range Slider ─── */}
            <Box>
              <Flex justify="space-between" mb={2}>
                <Text fontSize="xs" color="#64748b" fontWeight={600}>Posted Within</Text>
                <Text fontSize="xs" color="#22c55e" fontWeight={700}>
                  {maxDaysPreview === 0 ? "All time" : maxDaysPreview === 1 ? "Today" : `${maxDaysPreview} days`}
                </Text>
              </Flex>
              <Slider
                min={0} max={30} step={1} value={maxDaysPreview}
                onChange={(val) => setMaxDaysPreview(val)}
                onChangeEnd={(val) => { setMaxDaysAgo(val); setPage(1); }}
                colorScheme="green"
              >
                <SliderTrack bg="#1e1e3a" h="6px" borderRadius="3px">
                  <SliderFilledTrack bg="linear-gradient(90deg, #22c55e, #16a34a)" />
                </SliderTrack>
                <SliderThumb boxSize={4} bg="#22c55e" borderColor="#16a34a" borderWidth={2} />
              </Slider>
              <Flex justify="space-between" mt={1}>
                <Text fontSize="10px" color="#4a4a6a">All</Text>
                <Text fontSize="10px" color="#4a4a6a">7d</Text>
                <Text fontSize="10px" color="#4a4a6a">14d</Text>
                <Text fontSize="10px" color="#4a4a6a">21d</Text>
                <Text fontSize="10px" color="#4a4a6a">30d</Text>
              </Flex>
            </Box>

            {/* ─── Salary Range ─── */}
            <Box>
              <Flex justify="space-between" mb={2}>
                <Text fontSize="xs" color="#64748b" fontWeight={600}>Min Salary (LPA)</Text>
                <Text fontSize="xs" color="#6366f1" fontWeight={700}>
                  {minSalaryPreview > 0 ? `${minSalaryPreview}+ LPA` : "Any"}
                </Text>
              </Flex>
              <Slider
                min={0} max={100} step={5} value={minSalaryPreview}
                onChange={(val) => setMinSalaryPreview(val)}
                onChangeEnd={(val) => { setMinSalary(val); setPage(1); }}
                colorScheme="purple"
              >
                <SliderTrack bg="#1e1e3a" h="6px" borderRadius="3px">
                  <SliderFilledTrack bg="linear-gradient(90deg, #6366f1, #8b5cf6)" />
                </SliderTrack>
                <SliderThumb boxSize={4} bg="#6366f1" borderColor="#8b5cf6" borderWidth={2} />
              </Slider>
              <Flex justify="space-between" mt={1}>
                <Text fontSize="10px" color="#4a4a6a">0</Text>
                <Text fontSize="10px" color="#4a4a6a">25</Text>
                <Text fontSize="10px" color="#4a4a6a">50</Text>
                <Text fontSize="10px" color="#4a4a6a">75</Text>
                <Text fontSize="10px" color="#4a4a6a">100+</Text>
              </Flex>
            </Box>

            {/* ─── Max Salary ─── */}
            <Box>
              <Flex justify="space-between" mb={2}>
                <Text fontSize="xs" color="#64748b" fontWeight={600}>Max Salary (LPA)</Text>
                <Text fontSize="xs" color="#22d3ee" fontWeight={700}>
                  {maxSalaryPreview > 0 ? `≤${maxSalaryPreview} LPA` : "No cap"}
                </Text>
              </Flex>
              <Slider
                min={0} max={100} step={5} value={maxSalaryPreview}
                onChange={(val) => setMaxSalaryPreview(val)}
                onChangeEnd={(val) => { setMaxSalary(val); setPage(1); }}
                colorScheme="cyan"
              >
                <SliderTrack bg="#1e1e3a" h="6px" borderRadius="3px">
                  <SliderFilledTrack bg="linear-gradient(90deg, #22d3ee, #06b6d4)" />
                </SliderTrack>
                <SliderThumb boxSize={4} bg="#22d3ee" borderColor="#06b6d4" borderWidth={2} />
              </Slider>
              <Flex justify="space-between" mt={1}>
                <Text fontSize="10px" color="#4a4a6a">None</Text>
                <Text fontSize="10px" color="#4a4a6a">25</Text>
                <Text fontSize="10px" color="#4a4a6a">50</Text>
                <Text fontSize="10px" color="#4a4a6a">75</Text>
                <Text fontSize="10px" color="#4a4a6a">100</Text>
              </Flex>
            </Box>

            {/* ─── Min Score ─── */}
            <Box>
              <Text fontSize="xs" color="#64748b" mb={1.5} fontWeight={600}>Min Match Score</Text>
              <Select
                size="sm" value={minScore} onChange={(e) => { setMinScore(parseInt(e.target.value)); setPage(1); }}
                bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px" _focus={{ borderColor: "#6366f1" }}
              >
                <option value={0}>Any score</option>
                <option value={50}>50+ (Good)</option>
                <option value={70}>70+ (Strong)</option>
                <option value={85}>85+ (Hot)</option>
              </Select>
            </Box>

            {/* ─── Sort By ─── */}
            <Box>
              <Text fontSize="xs" color="#64748b" mb={1.5} fontWeight={600}>Sort By</Text>
              <Select
                size="sm" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px" _focus={{ borderColor: "#6366f1" }}
              >
                <option value="">Newest First</option>
                <option value="smart">🧠 Smart Ranking</option>
                <option value="score">Highest Score</option>
                <option value="salary">Highest Salary</option>
                <option value="date">Posted Date</option>
              </Select>
            </Box>

            {/* ─── Company Search ─── */}
            <Box>
              <Text fontSize="xs" color="#64748b" mb={1.5} fontWeight={600}>Company</Text>
              <InputGroup size="sm">
                <Input
                  placeholder="e.g. Google, Meta..."
                  value={companyInput}
                  onChange={(e) => setCompanyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setCompanySearch(companyInput); setPage(1); } }}
                  onBlur={() => { if (companyInput !== companySearch) { setCompanySearch(companyInput); setPage(1); } }}
                  bg="#0a0a0f" border="1px solid #2a2a4a" borderRadius="10px"
                  _focus={{ borderColor: "#6366f1", boxShadow: "0 0 0 1px #6366f1" }}
                  _placeholder={{ color: "#4a4a6a" }}
                />
              </InputGroup>
            </Box>

            {/* ─── Quick Experience Tags ─── */}
            <Box>
              <Text fontSize="xs" color="#64748b" mb={2} fontWeight={600}>Quick Filters</Text>
              <Flex gap={1.5} flexWrap="wrap">
                {["senior", "staff", "lead", "principal", "intern", "junior", "manager"].map((tag) => (
                  <Badge
                    key={tag}
                    px={2.5} py={1} borderRadius="full" fontSize="10px" fontWeight={600}
                    cursor="pointer" textTransform="capitalize" transition="all 0.15s ease"
                    bg={keyword === tag ? "#6366f1" : "#1e1e3a"}
                    color={keyword === tag ? "white" : "#94a3b8"}
                    border="1px solid"
                    borderColor={keyword === tag ? "#6366f1" : "#2a2a4a"}
                    _hover={{ bg: keyword === tag ? "#5558e6" : "#2a2a4a", borderColor: "#6366f1" }}
                    onClick={() => {
                      if (keyword === tag) {
                        setKeyword(""); setSearchInput("");
                      } else {
                        setKeyword(tag); setSearchInput(tag);
                      }
                      setPage(1);
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </Flex>
            </Box>

          </VStack>
        </Box>
      </Flex>
    </Box>
  );
}

// ─── Sub-components ──────────────────────────────────────────
function StatPill({ label, value, color, icon }: { label: string; value: string; color: string; icon?: string }) {
  return (
    <Box
      textAlign="center" px={3} py={1.5}
      bg="rgba(18, 18, 26, 0.8)" border="1px solid #1e1e3a" borderRadius="10px"
      transition="all 0.2s ease"
      _hover={{ borderColor: "rgba(99,102,241,0.3)", bg: "rgba(30,30,58,0.5)" }}
    >
      <Text fontSize="9px" color="#64748b" textTransform="uppercase" letterSpacing="0.06em">
        {icon && <>{icon} </>}{label}
      </Text>
      <Text fontSize="sm" fontWeight={700} color={color}>{value}</Text>
    </Box>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Tag size="sm" bg="#1e1e3a" color="#94a3b8" borderRadius="full">
      <TagLabel>{label}</TagLabel>
      <TagCloseButton onClick={onRemove} />
    </Tag>
  );
}

const JobCard = memo(function JobCard({ job, isSaved, onToggleSave, rates, showTracker, status, onStatusChange }: {
  job: Job; isSaved: boolean; onToggleSave: () => void; rates: Record<string, number>;
  showTracker: boolean; status: AppStatus; onStatusChange: (s: AppStatus) => void;
}) {
  const scoreColor = getScoreColor(job.match_score);
  const freshness = getFreshnessBadge(job.posted_date || job.created_at);
  const hasSalary = job.salary_min_lpa !== null && job.salary_min_lpa > 0;
  const isHighPay = hasSalary && job.salary_min_lpa! >= 20;
  const confidence = getSourceConfidence(job.source);
  const currentStatus = APP_STATUSES.find((s) => s.value === status) || APP_STATUSES[0];

  const borderColor = showTracker && status
    ? (status === "offer" ? "#22c55e"
      : status === "interviewing" ? "#eab308"
        : status === "applied" ? "#3b82f6"
          : status === "saved" ? "#6366f1"
            : status === "rejected" ? "#ef444433"
              : "#1e1e3a")
    : isSaved ? "#6366f1" : "#1e1e3a";

  return (
    <Box
      bg="#12121a" border="1px solid" borderColor={borderColor}
      borderRadius={{ base: "10px", md: "14px" }} transition="all 0.2s ease"
      h="auto"
      minH={{ base: "auto", md: "130px" }}
      _hover={{ bg: "#161626", borderColor: "#2e2e5a", transform: "translateY(-1px)", boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}
      cursor="default" position="relative" role="group"
      opacity={showTracker && status === "rejected" ? 0.5 : 1}
      overflow="hidden"
    >
      {/* Source accent line */}
      <Box position="absolute" left={0} top="14px" bottom="14px" w="3px" bg={showTracker && status ? currentStatus.color : getSourceBadge(job.source)} borderRadius="0 2px 2px 0" opacity={0.7} />

      {/* ─── Row 1: Title + Actions ─── */}
      <Flex justify="space-between" align="flex-start" px={{ base: 3, md: 6 }} pt={{ base: 3, md: 5 }} pb={{ base: 2, md: 3 }} gap={{ base: 2, md: 4 }}>
        <Box flex={1} minW={0}>
          {job.title.length > 67 ? (
            <Tooltip label={job.title} placement="top-start" openDelay={400} hasArrow bg="#1a1a2e" color="#e2e8f0" fontSize="sm" px={3} py={2} borderRadius="8px" maxW="500px">
              <Heading fontSize={{ base: "13px", md: "14px" }} fontWeight={600} color="#f1f5f9" lineHeight="1.4" noOfLines={1} letterSpacing="-0.01em" cursor="default">
                {job.title.slice(0, 67) + "..."}
              </Heading>
            </Tooltip>
          ) : (
            <Heading fontSize={{ base: "13px", md: "14px" }} fontWeight={600} color="#f1f5f9" lineHeight="1.4" noOfLines={1} letterSpacing="-0.01em" cursor="default">
              {job.title}
            </Heading>
          )}
          <HStack spacing={2} mt={1} overflow="hidden">
            <Text fontSize={{ base: "11px", md: "13px" }} color="#94a3b8" fontWeight={500} flexShrink={0} noOfLines={1}>{job.company}</Text>
            {job.location && (
              <>
                <Box w="3px" h="3px" borderRadius="full" bg="#3a3a5a" flexShrink={0} />
                {job.location.length > 67 ? (
                  <Tooltip label={job.location} placement="bottom-start" openDelay={400} hasArrow bg="#1a1a2e" color="#e2e8f0" fontSize="sm" px={3} py={2} borderRadius="8px" maxW="500px">
                    <Text fontSize={{ base: "10px", md: "12px" }} color="#64748b" noOfLines={1} cursor="default">{job.location.slice(0, 67) + "..."}</Text>
                  </Tooltip>
                ) : (
                  <Text fontSize={{ base: "10px", md: "12px" }} color="#64748b" noOfLines={1}>{job.location}</Text>
                )}
              </>
            )}
          </HStack>
        </Box>

        {/* Actions */}
        <HStack spacing={2} flexShrink={0} pt={0.5}>
          <Tooltip label={isSaved ? "Unsave" : "Save"} placement="top">
            <IconButton
              aria-label="Save job" variant="ghost" size="sm"
              color={isSaved ? "#6366f1" : "#4a4a6a"}
              _hover={{ color: "#6366f1", bg: "rgba(99,102,241,0.08)" }}
              onClick={onToggleSave} icon={<BookmarkIcon filled={isSaved} />}
              borderRadius="8px"
            />
          </Tooltip>

          {showTracker && (
            <Menu strategy="fixed">
              <MenuButton
                as={Button} size="sm" variant="ghost" borderRadius="8px"
                border="1px solid" borderColor={status ? currentStatus.color + "44" : "#2a2a4a"}
                bg={status ? currentStatus.color + "15" : "transparent"}
                color={currentStatus.color} fontSize="xs" fontWeight={600} px={2.5}
                _hover={{ bg: currentStatus.color + "22", borderColor: currentStatus.color }}
                transition="all 0.15s ease"
              >
                {currentStatus.icon} {currentStatus.label}
              </MenuButton>
              <MenuList bg="#1a1a2e" borderColor="#2a2a4a" minW="160px" py={1} zIndex={1400}>
                {APP_STATUSES.filter(s => s.value !== "").map((s) => (
                  <MenuItem
                    key={s.value} onClick={() => onStatusChange(s.value)}
                    bg={status === s.value ? s.color + "15" : "transparent"}
                    _hover={{ bg: s.color + "22" }} color={s.color}
                    fontSize="xs" fontWeight={500} py={1.5}
                  >
                    <Text mr={2}>{s.icon}</Text> {s.label}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
          )}

          <Link href={job.apply_url} isExternal _hover={{ textDecoration: "none" }}>
            <Button
              size={{ base: "xs", md: "sm" }} bg="linear-gradient(135deg, #6366f1, #8b5cf6)" color="white"
              borderRadius={{ base: "8px", md: "10px" }} fontSize={{ base: "10px", md: "xs" }} fontWeight={600}
              _hover={{ bg: "linear-gradient(135deg, #7c7ff7, #a78bfa)", transform: "scale(1.05)" }}
              transition="all 0.15s ease" rightIcon={<ExternalLinkIcon />}
              px={{ base: 2, md: 3 }}
            >Apply</Button>
          </Link>
        </HStack>
      </Flex>

      {/* ─── Row 2: Tags + Salary ─── */}
      <Flex px={{ base: 3, md: 6 }} pb={{ base: 3, md: 4 }} align="center" justify="space-between" gap={{ base: 2, md: 4 }} flexWrap={{ base: "wrap", md: "nowrap" }}>
        <HStack spacing={1} flex={1} overflow="hidden" flexWrap="wrap" minW={0}>
          {job.is_faang === 1 && (
            <Badge bg="rgba(234, 179, 8, 0.1)" color="#eab308" border="1px solid rgba(234, 179, 8, 0.2)" borderRadius="full" fontSize={{ base: "8px", md: "10px" }} px={{ base: 1.5, md: 2.5 }} py={0.5} fontWeight={600} textTransform="uppercase" letterSpacing="0.04em">
              FAANG
            </Badge>
          )}
          {isHighPay && (
            <Badge bg="rgba(34, 197, 94, 0.1)" color="#22c55e" border="1px solid rgba(34, 197, 94, 0.2)" borderRadius="full" fontSize={{ base: "8px", md: "10px" }} px={{ base: 1.5, md: 2.5 }} py={0.5} fontWeight={600} textTransform="uppercase">
              High Pay
            </Badge>
          )}
          {freshness && (
            <Badge bg={freshness.bg} color={freshness.color} borderRadius="full" fontSize={{ base: "8px", md: "10px" }} px={{ base: 1.5, md: 2.5 }} py={0.5} fontWeight={600}>
              {freshness.label}
            </Badge>
          )}
          {job.remote === 1 && (
            <Badge bg="rgba(139, 92, 246, 0.1)" color="#a78bfa" border="1px solid rgba(139, 92, 246, 0.15)" borderRadius="full" fontSize={{ base: "8px", md: "10px" }} px={{ base: 1.5, md: 2.5 }} py={0.5} fontWeight={600} textTransform="uppercase">
              Remote
            </Badge>
          )}
          {job.is_india === 1 && (
            <Badge bg="rgba(249, 115, 22, 0.08)" color="#fb923c" border="1px solid rgba(249, 115, 22, 0.15)" borderRadius="full" fontSize={{ base: "8px", md: "10px" }} px={{ base: 1.5, md: 2.5 }} py={0.5} fontWeight={600} textTransform="uppercase">
              India
            </Badge>
          )}
          {job.visa_sponsored === 1 && (
            <Badge bg="rgba(6, 182, 212, 0.1)" color="#06b6d4" border="1px solid rgba(6, 182, 212, 0.15)" borderRadius="full" fontSize={{ base: "8px", md: "10px" }} px={{ base: 1.5, md: 2.5 }} py={0.5} fontWeight={600} textTransform="uppercase">
              Visa
            </Badge>
          )}
          {job.has_equity === 1 && (
            <Badge bg="rgba(236, 72, 153, 0.1)" color="#ec4899" border="1px solid rgba(236, 72, 153, 0.15)" borderRadius="full" fontSize="10px" px={2.5} py={0.5} fontWeight={600} textTransform="uppercase">
              Equity
            </Badge>
          )}
          <Tooltip label={`${confidence.label} · ${confidence.pct}% confidence`} placement="top">
            <Badge bg={`${confidence.color}12`} color={confidence.color} borderRadius="full" fontSize="10px" px={2.5} py={0.5} fontWeight={500} textTransform="capitalize">
              {job.source.replace("serp_", "")} · {confidence.pct}%
            </Badge>
          </Tooltip>
        </HStack>

        {/* Score + Salary cluster on right */}
        <HStack spacing={{ base: 1, md: 3 }} flexShrink={0} flexWrap="wrap">
          {hasSalary && (
            <HStack spacing={0}>
              <Text fontSize={{ base: "11px", md: "13px" }} color="#22c55e" fontWeight={700} letterSpacing="-0.01em" whiteSpace="nowrap">
                ₹{formatLPA(job.salary_min_lpa)}
                {job.salary_max_lpa && job.salary_max_lpa !== job.salary_min_lpa && ` – ₹${formatLPA(job.salary_max_lpa)}`}
              </Text>
              {job.salary_currency && job.salary_currency !== "INR" && rates[job.salary_currency] && (
                <Text fontSize="11px" color="#64748b" fontWeight={500} ml={1.5}>
                  | {lpaToOriginal(job.salary_min_lpa!, job.salary_currency, rates)}
                  {job.salary_max_lpa && job.salary_max_lpa !== job.salary_min_lpa &&
                    ` – ${lpaToOriginal(job.salary_max_lpa, job.salary_currency, rates)}`}
                </Text>
              )}
            </HStack>
          )}
          <HStack spacing={1} bg={`${scoreColor}12`} px={2} py={1} borderRadius="full">
            <Box color={scoreColor}><FireIcon /></Box>
            <Text fontSize="12px" color={scoreColor} fontWeight={700}>{job.match_score}</Text>
            <Text fontSize="10px" color="#64748b" fontWeight={500}>{getScoreLabel(job.match_score)}</Text>
          </HStack>
        </HStack>
      </Flex>
    </Box>
  );
});
