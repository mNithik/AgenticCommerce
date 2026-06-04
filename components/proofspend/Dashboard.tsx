"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  FileText,
  Scale,
  Receipt,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Wallet,
  Activity,
  ShieldAlert,
  StickyNote,
  Gavel,
  Download,
  ChevronDown,
  ShieldCheck,
  History,
  FileDown,
  FileJson,
  Play,
  Rocket,
  PlayCircle,
  CheckCheck,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PolicyProfile as AppPolicyProfile } from "@/lib/types";
import type {
  CompareVendor,
  HistoryRow as DashboardHistoryRow,
  MemoViewModel,
  SafeSpendRow,
  TimelineEvent as DashboardTimelineEvent,
} from "@/lib/dashboard-adapters";

export type ProofSpendDashboardProps = {
  question: string;
  onQuestionChange: (value: string) => void;
  budgetCapUsd: number;
  onBudgetChange: (value: number) => void;
  policyProfile: AppPolicyProfile;
  onPolicyChange: (value: AppPolicyProfile) => void;
  isRunning: boolean;
  onRun: () => void;
  error: string | null;
  mode: "mock" | "live" | "waiting";
  spentUsd: number;
  paidCalls: number;
  timelineEvents: DashboardTimelineEvent[];
  evidenceRows: EvidenceRow[];
  memo: MemoViewModel | null;
  safeSpendRows: SafeSpendRow[];
  historyRows: DashboardHistoryRow[];
  selectedRunId: string | null;
  onSelectHistory: (runId: string) => void;
  currentVendor: CompareVendor | null;
  compareVendor: CompareVendor | null;
  compareOptions: { id: string; label: string }[];
  compareRunId: string;
  onCompareRunChange: (runId: string) => void;
  selectedRecordId: string | null;
  onSelectRecord: (recordId: string | null) => void;
  showExport: boolean;
  onShareLink: () => Promise<void>;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  runIdLabel?: string;
};

type Mode = "mock" | "live" | "waiting";
type PolicyProfile = "standard" | "strict";
type AgentKey = "market" | "evidence" | "counter";
type TimelineAgentKey = AgentKey | "skeptic";

type TimelineEventType =
  | "run_started"
  | "agent_started"
  | "payment_settled"
  | "agent_completed"
  | "policy_blocked"
  | "search_failed"
  | "run_error"
  | "complete"
  | "search"
  | "note"
  | "ruling";

interface TimelineEvent {
  t: string;
  agent: TimelineAgentKey | "system";
  type: TimelineEventType;
  text: string;
  cost?: number;
  receipt?: string;
}

interface EvidenceRow {
  id: string;
  agent: AgentKey;
  query: string;
  finding: string;
  sources: { label: string; url: string }[];
  receipt: string;
  cost: number;
  paymentMode: "mock" | "live";
}

// Legacy sample blocks kept for subcomponent dev reference only.
void 0;

const AGENT_META: Record<AgentKey, { label: string; color: string; icon: typeof Search }> = {
  market: { label: "Market", color: "#7dd3c0", icon: Search },
  evidence: { label: "Evidence", color: "#fbbf24", icon: FileText },
  counter: { label: "Counter", color: "#f87171", icon: Scale },
};

const SAMPLE_TIMELINE: TimelineEvent[] = [
  { t: "00:00.1", agent: "system",   type: "run_started",      text: "Run started in mock mode with nvidia using the standard policy profile." },
  { t: "00:00.9", agent: "market",   type: "agent_started",    text: "Market agent online · scoping Apollo.io pricing surface" },
  { t: "00:02.8", agent: "market",   type: "payment_settled",  text: "search.x402 settled on Base · Apollo.io pricing tiers", cost: 0.01, receipt: "mock:0xrun_956001" },
  { t: "00:03.4", agent: "market",   type: "agent_completed",  text: "Market agent returned 4 pricing data points" },
  { t: "00:03.6", agent: "evidence", type: "agent_started",    text: "Evidence agent online · seeking pipeline-lift benchmarks" },
  { t: "00:05.1", agent: "evidence", type: "payment_settled",  text: "reports.x402 settled on Base · ZoomInfo benchmark", cost: 0.01, receipt: "mock:0xrun_956002" },
  { t: "00:05.7", agent: "evidence", type: "agent_completed",  text: "Evidence agent returned 2 independently-sourced metrics" },
  { t: "00:06.0", agent: "counter",  type: "policy_blocked",   text: "Gartner full report blocked · projected $0.034 exceeds per-call cap" },
  { t: "00:06.7", agent: "counter",  type: "agent_started",    text: "Counter agent re-routed to public G2 review corpus" },
  { t: "00:08.0", agent: "counter",  type: "payment_settled",  text: "reviews.x402 settled on Base · accuracy complaints", cost: 0.01, receipt: "mock:0xrun_956003" },
  { t: "00:08.6", agent: "counter",  type: "agent_completed",  text: "Counter agent flagged 31% stale-data complaints" },
  { t: "00:10.4", agent: "skeptic",  type: "agent_started",    text: "Skeptic agent online · stress-testing memo synthesis" },
  { t: "00:12.6", agent: "system",   type: "ruling",           text: "Synthesis complete · confidence 50% · need_more_evidence" },
];

// Timeline-only agent palette (per redesign spec). Other surfaces keep AGENT_META.
const TIMELINE_AGENT: Record<
  TimelineAgentKey | "system",
  { label: string; border: string; chip: string; dot: string }
> = {
  market:   { label: "Market",   border: "#38bdf8", chip: "text-sky-300",     dot: "bg-sky-400" },
  evidence: { label: "Evidence", border: "#34d399", chip: "text-emerald-300", dot: "bg-emerald-400" },
  counter:  { label: "Counter",  border: "#f59e0b", chip: "text-amber-300",   dot: "bg-amber-400" },
  skeptic:  { label: "Skeptic",  border: "#a78bfa", chip: "text-violet-300",  dot: "bg-violet-400" },
  system:   { label: "System",   border: "#64748b", chip: "text-white/55",    dot: "bg-white/40" },
};

const EVENT_TYPE_LABEL: Record<TimelineEventType, string> = {
  run_started: "RUN_STARTED",
  agent_started: "AGENT_STARTED",
  payment_settled: "PAYMENT_SETTLED",
  agent_completed: "AGENT_COMPLETED",
  policy_blocked: "POLICY_BLOCKED",
  search_failed: "SEARCH_FAILED",
  run_error: "RUN_ERROR",
  complete: "COMPLETE",
  search: "Search",
  note: "Note",
  ruling: "Ruling",
};

const EVENT_TYPE_ICON: Record<TimelineEventType, typeof Search> = {
  run_started: Rocket,
  agent_started: PlayCircle,
  agent_completed: CheckCheck,
  search: Search,
  payment_settled: Receipt,
  policy_blocked: ShieldAlert,
  search_failed: AlertCircle,
  run_error: AlertCircle,
  complete: CheckCheck,
  note: StickyNote,
  ruling: Gavel,
};

const SAMPLE_EVIDENCE: EvidenceRow[] = [
  {
    id: "sample_market",
    agent: "market",
    query: "Apollo.io pricing tiers and seat economics",
    finding:
      "Basic $49/seat, Pro $79/seat, Org $119/seat (annual). $500/mo ≈ 5–6 Pro seats with credit overage risk.",
    sources: [
      { label: "apollo.io/pricing", url: "#" },
      { label: "saasworthy.com", url: "#" },
    ],
    receipt: "mock:0xrun_956001",
    cost: 0.01,
    paymentMode: "mock",
  },
  {
    id: "sample_evidence",
    agent: "evidence",
    query: "Reported lift in qualified pipeline from Apollo users",
    finding:
      "Median teams report 1.4–2.1× SQL volume in months 2–4, conditional on enrichment hygiene workflow.",
    sources: [
      { label: "g2.com/apollo", url: "#" },
      { label: "forrester wave 2024", url: "#" },
    ],
    receipt: "mock:0xrun_956002",
    cost: 0.01,
    paymentMode: "mock",
  },
  {
    id: "sample_counter",
    agent: "counter",
    query: "Data accuracy complaints and churn signals",
    finding:
      "31% of recent G2 reviews cite stale or inaccurate mobile numbers; 12% churn within 90 days per Trust Radius.",
    sources: [
      { label: "trustradius.com", url: "#" },
      { label: "reddit.com/r/sales", url: "#" },
    ],
    receipt: "mock:0xrun_956003",
    cost: 0.01,
    paymentMode: "mock",
  },
];

type Citation = { agent: AgentKey | "system"; receipt: string };
type Claim = { text: string; citations: Citation[] };

const RECOMMENDATION: {
  verdict: "buy" | "do_not_buy" | "need_more_evidence";
  confidence: number;
  rationale: string;
  strengths: Claim[];
  concerns: Claim[];
  nextSteps: Claim[];
} = {
  verdict: "need_more_evidence",
  confidence: 61,
  rationale:
    "Apollo.io clears the cost-fit bar at five to six Pro seats, and two independent sources back the headline 1.4–2.1× SQL lift inside four months. That case is undermined by a 31% rate of stale-mobile complaints and a 12% ninety-day churn signal — both of which directly erode the dialing ROI the purchase is supposed to fund. Before recommending the spend, the panel wants a two-seat trial measuring real dial-to-connect rate, plus a deeper read on Gartner and Forrester full text that was blocked by the per-call cap on this run.",
  strengths: [
    {
      text: "Median 1.4–2.1× SQL lift within 4 months is well-attested across two independent sources.",
      citations: [
        { agent: "evidence", receipt: "mock:0xrun_956002" },
        { agent: "market", receipt: "mock:0xrun_956001" },
      ],
    },
    {
      text: "Seat-based pricing is predictable and cancellable monthly on Pro tier.",
      citations: [{ agent: "market", receipt: "mock:0xrun_956001" }],
    },
  ],
  concerns: [
    {
      text: "31% of reviewers cite stale mobile data — directly undermines outbound dialing ROI.",
      citations: [{ agent: "counter", receipt: "mock:0xrun_956003" }],
    },
    {
      text: "12% 90-day churn suggests buyer's remorse is common at this price point.",
      citations: [
        { agent: "counter", receipt: "mock:0xrun_956003" },
        { agent: "evidence", receipt: "mock:0xrun_956002" },
      ],
    },
  ],
  nextSteps: [
    {
      text: "Run a 14-day Pro trial on 2 seats and measure dial-to-connect rate before committing.",
      citations: [{ agent: "evidence", receipt: "mock:0xrun_956002" }],
    },
    {
      text: "Re-run diligence with budget $1.00 to fetch paid analyst reports (Gartner, Forrester full text).",
      citations: [
        { agent: "market", receipt: "mock:0xrun_956001" },
        { agent: "evidence", receipt: "mock:0xrun_956002" },
      ],
    },
  ],
};

const SPENT = SAMPLE_EVIDENCE.reduce((s, r) => s + r.cost, 0);

const EXAMPLE_QUESTIONS = [
  {
    short: "Apollo.io lead gen",
    full: "Should I spend $500/month on Apollo.io for B2B lead generation?",
  },
  {
    short: "HubSpot Enterprise",
    full: "Is HubSpot Enterprise worth $3,600/month for a 25-person sales team?",
  },
  {
    short: "LeadMagic",
    full: "Should we switch to LeadMagic for AI-powered lead enrichment at $99/seat?",
  },
];

type SafeSpendEvent = {
  kind: "batch_preflight" | "preflight" | "receipt";
  agent: AgentKey | "system";
  action: string;
  status: "allowed" | "blocked";
  reason: string;
  queryPreview?: string;
  projectedSpendUsd: number;
};

const SAMPLE_SAFESPEND: SafeSpendEvent[] = [
  {
    kind: "batch_preflight",
    agent: "system",
    action: "batch.dispatch(3)",
    status: "allowed",
    reason: "Aggregate projection $0.03 within $0.25 cap",
    queryPreview: "3 paid searches queued across Market, Evidence, Counter",
    projectedSpendUsd: 0.03,
  },
  {
    kind: "preflight",
    agent: "market",
    action: "search.x402",
    status: "allowed",
    reason: "Per-call $0.012 ≤ $0.02 per-call cap",
    queryPreview: "Apollo.io pricing tiers and seat economics",
    projectedSpendUsd: 0.012,
  },
  {
    kind: "preflight",
    agent: "counter",
    action: "reports.x402",
    status: "blocked",
    reason: "Source paywalled · projected $0.034 exceeds per-call cap",
    queryPreview: "Full Gartner Magic Quadrant 2025 — sales engagement",
    projectedSpendUsd: 0.034,
  },
  {
    kind: "receipt",
    agent: "evidence",
    action: "reports.x402",
    status: "allowed",
    reason: "Receipt mock:0xrun_956002 verified on Base",
    queryPreview: "Apollo.io vs ZoomInfo conversion benchmark",
    projectedSpendUsd: 0.014,
  },
];

type HistoryRow = DashboardHistoryRow;

const SAMPLE_HISTORY: HistoryRow[] = [
  {
    id: "run_956",
    subject: "Apollo.io",
    question:
      "Should I spend $500 per month on Apollo.io for B2B lead generation for my early-stage SaaS startup?",
    budget: 0.25,
    policy: "standard",
    records: 3,
    spendUsd: 0.03,
    confidence: 61,
    recommendation: "need_more_evidence",
    mode: "mock",
  },
  {
    id: "run_955",
    subject: "Apollo.io",
    question: "Is Apollo.io credit pricing competitive vs LeadMagic?",
    budget: 0.5,
    policy: "strict",
    records: 6,
    spendUsd: 0.082,
    confidence: 64,
    recommendation: "need_more_evidence",
    mode: "live",
  },
];

function ModeBadge({ mode, running }: { mode: Mode; running: boolean }) {
  const config = {
    live:    { label: "Live x402", ring: "border-primary/30 bg-primary/10 text-primary", dot: "bg-primary" },
    mock:    { label: "Mock",      ring: "border-amber-500/30 bg-amber-500/10 text-amber-700", dot: "bg-amber-500" },
    waiting: { label: "Waiting",   ring: "border-border bg-secondary/60 text-muted-foreground", dot: "bg-muted-foreground" },
  }[mode];
  return (
    <div
      role="status"
      aria-label={`Mode: ${config.label}${running ? ", running" : ""}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
        config.ring,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          config.dot,
          running && "ps-pulse-dot"
        )}
      />
      {config.label}
    </div>
  );
}

function CitationChip({ agent, receipt }: { agent: AgentKey | "system"; receipt: string }) {
  const isLive = !receipt.startsWith("mock:");
  const label = agent === "system" ? "system" : AGENT_META[agent].label;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <span className="text-foreground/80">{label}</span>
      <span className="text-border">·</span>
      <span className={cn("font-mono", isLive && "text-primary")}>
        {isLive ? receipt.slice(0, 10) + "…" : receipt}
      </span>
      {isLive && <ExternalLink className="h-2.5 w-2.5" />}
    </span>
  );
}

function LiveTimeline({ events }: { events: DashboardTimelineEvent[] }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.scrollTo({ top: vp.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  return (
    <Card className="overflow-hidden border-0 bg-[#18211b] text-[#e9eee7] lg:col-span-3">
      <CardHeader className="border-b border-white/5 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
          <Activity className="h-4 w-4" />
          Live timeline
          <span className="ml-auto font-mono text-[10px] normal-case tracking-normal text-white/40">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {events.length === 0 ? (
          <div className="flex h-[360px] flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
              <Activity className="h-4 w-4 text-white/40" />
            </div>
            <p className="max-w-[28ch] text-sm leading-relaxed text-white/55">
              Run diligence to see agents pay for evidence in real time.
            </p>
          </div>
        ) : (
          <div
            ref={viewportRef}
            className="max-h-[360px] overflow-y-auto scroll-smooth [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin]"
          >
            <ol className="relative px-6 py-5">
              {/* connecting line */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-[34px] top-6 bottom-6 w-px bg-white/10"
              />
              {events.map((e, i) => {
                const meta = TIMELINE_AGENT[e.agent];
                const Icon = EVENT_TYPE_ICON[e.type];
                const isBlocked = e.type === "policy_blocked";
                const isPaid = e.type === "payment_settled";
                return (
                  <li key={i} className="relative pl-10 pb-4 last:pb-0">
                    {/* node */}
                    <span
                      className={cn(
                        "absolute left-[26px] top-3 z-10 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-[#18211b]",
                        isBlocked && "border-red-400/80",
                      )}
                      style={isBlocked ? undefined : { borderColor: meta.border }}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          isBlocked ? "bg-red-400" : meta.dot,
                        )}
                      />
                    </span>

                    {/* card */}
                    <div
                      className={cn(
                        "rounded-md border-l-2 bg-white/[0.025] px-3 py-2.5 transition-colors hover:bg-white/[0.045]",
                        isBlocked
                          ? "border border-red-500/40 border-l-red-400 bg-red-500/[0.06]"
                          : "border-y border-r border-white/5",
                      )}
                      style={isBlocked ? undefined : { borderLeftColor: meta.border }}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5",
                            isBlocked ? "text-red-300" : "text-white/55",
                          )}
                        />
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-[0.16em]",
                            isBlocked ? "text-red-300" : meta.chip,
                          )}
                        >
                          {meta.label}
                        </span>
                        <span className="text-white/20">·</span>
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-[0.16em]",
                            isBlocked ? "text-red-200/90" : "text-white/45",
                          )}
                        >
                          {EVENT_TYPE_LABEL[e.type]}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-white/30">{e.t}</span>
                      </div>

                      <div
                        className={cn(
                          "mt-1 text-sm leading-snug",
                          isBlocked ? "text-red-50/90" : "text-white/85",
                        )}
                      >
                        {e.text}
                      </div>

                      {isPaid && (e.cost != null || e.receipt) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {e.cost != null && (
                            <span className="font-mono text-xs text-emerald-300">
                              ${e.cost.toFixed(2)}
                            </span>
                          )}
                          {e.receipt && (
                            <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/65">
                              <Receipt className="h-2.5 w-2.5 text-white/40" />
                              {e.receipt}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative inline-flex h-24 w-24 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          className="text-border"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          className="text-primary transition-[stroke-dashoffset] duration-700"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif-display text-2xl font-medium leading-none text-foreground">
          {value}%
        </span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          confidence
        </span>
      </div>
    </div>
  );
}

function VerdictBlock({
  verdict,
  confidence,
}: {
  verdict: "buy" | "do_not_buy" | "need_more_evidence";
  confidence: number;
}) {
  const map = {
    buy: {
      label: "BUY",
      sub: "Recommended action",
      pill: "bg-emerald-600 text-white ring-emerald-600/20",
      Icon: CheckCircle2,
    },
    do_not_buy: {
      label: "DO NOT BUY",
      sub: "Recommended action",
      pill: "bg-red-600 text-white ring-red-600/20",
      Icon: XCircle,
    },
    need_more_evidence: {
      label: "NEED MORE EVIDENCE",
      sub: "Inconclusive — gather more signal",
      pill: "bg-amber-500 text-white ring-amber-500/20",
      Icon: HelpCircle,
    },
  }[verdict];
  const { Icon } = map;
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Recommendation
        </span>
        <div
          className={cn(
            "inline-flex items-center gap-3 self-start rounded-full px-5 py-2.5 text-base font-semibold tracking-wider shadow-sm ring-8",
            map.pill,
          )}
        >
          <Icon className="h-5 w-5" />
          {map.label}
        </div>
        <span className="text-sm text-muted-foreground">{map.sub}</span>
      </div>
      <ConfidenceRing value={confidence} />
    </div>
  );
}

function ClaimChip({ agent, receipt }: Citation) {
  const label = agent === "system" ? "System" : AGENT_META[agent].label;
  const isLive = !receipt.startsWith("mock:");
  const display = isLive ? receipt.slice(0, 10) + "…" : receipt;
  return (
    <a
      href="#"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground",
      )}
    >
      <span className="text-foreground">{label}</span>
      <span className="text-border">·</span>
      <span className={cn("font-mono", isLive ? "text-primary" : "text-muted-foreground")}>
        {display}
      </span>
      <ExternalLink className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-70" />
    </a>
  );
}

function MemoSection({
  title,
  items,
  selectedRecordId,
  onSelect,
}: {
  title: string;
  items: { text: string; recordIds: string[] }[];
  selectedRecordId: string | null;
  onSelect: (recordId: string) => void;
}) {
  return (
    <section>
      <h3 className="font-serif-display mb-3 text-xl font-medium tracking-tight text-foreground">
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((it, i) => {
          const recordId = it.recordIds[0] ?? "";
          const isSelected =
            selectedRecordId !== null && it.recordIds.includes(selectedRecordId);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => recordId && onSelect(recordId)}
                className={cn(
                  "block w-full rounded-md border border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  isSelected
                    ? "border-sky-500/60 border-l-sky-500 bg-sky-500/10 ring-2 ring-sky-500/50"
                    : "border-border/70 border-l-primary bg-secondary/30 hover:bg-secondary/60",
                )}
              >
                <p className="text-sm leading-relaxed text-foreground/90">{it.text}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReceiptCell({ receipt, paymentMode }: { receipt: string; paymentMode: "mock" | "live" }) {
  const isLive = paymentMode === "live";
  if (isLive) {
    return (
      <a
        href={`https://basescan.org/tx/${receipt}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary hover:bg-primary/20"
      >
        {receipt.slice(0, 8)}…
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-500/40 bg-amber-500/10 font-medium uppercase tracking-wider text-amber-700"
    >
      Simulated
    </Badge>
  );
}

function AgentDot({ agent }: { agent: AgentKey }) {
  const meta = TIMELINE_AGENT[agent];
  return (
    <span
      className="inline-flex items-center gap-2"
      aria-label={`Agent: ${meta.label}`}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full ring-2 ring-offset-1 ring-offset-card"
        style={{ background: meta.border, boxShadow: `0 0 0 1px ${meta.border}33` }}
      />
      <span className="text-sm font-medium text-foreground">{meta.label}</span>
    </span>
  );
}

function FindingCell({ row }: { row: EvidenceRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p
        className={cn(
          "text-sm leading-relaxed text-foreground/90",
          !open && "line-clamp-2",
        )}
      >
        {row.finding}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {row.sources.map((s, j) => (
          <a
            key={j}
            href={s.url}
            className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            {s.label}
          </a>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
        >
          {open ? "Show less" : "Show more"}
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>
    </div>
  );
}

function EvidenceLedger({
  rows,
  selectedRecordId,
  onSelect,
}: {
  rows: EvidenceRow[];
  selectedRecordId: string | null;
  onSelect: (recordId: string | null) => void;
}) {
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  return (
    <Card id="evidence-records" className="border-border/70 bg-card scroll-mt-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Evidence records
            </CardTitle>
            <p className="mt-1.5 text-sm text-foreground/80">
              <span className="font-mono">{rows.length}</span> paid searches
              <span className="mx-2 text-border">·</span>
              <span className="font-mono">${totalCost.toFixed(2)}</span> spent
            </p>
          </div>
          {selectedRecordId && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="self-start text-[11px] font-medium text-sky-700 hover:underline sm:self-auto"
            >
              Clear claim selection
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-2">
        {/* Desktop: table with sticky header + zebra */}
        <div className="hidden md:block">
          <div className="max-h-[520px] overflow-auto rounded-b-md">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="w-[130px] text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Agent
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Query
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Finding
                  </TableHead>
                  <TableHead className="w-[150px] text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Receipt
                  </TableHead>
                  <TableHead className="w-[90px] text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Cost
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={row.id}
                    id={`record-${row.id}`}
                    onClick={() => onSelect(selectedRecordId === row.id ? null : row.id)}
                    className={cn(
                      "border-border/50 align-top cursor-pointer",
                      i % 2 === 1 && "bg-secondary/25",
                      selectedRecordId === row.id && "bg-sky-500/10 outline outline-2 -outline-offset-2 outline-sky-500/60",
                    )}
                  >
                    <TableCell className="py-4">
                      <AgentDot agent={row.agent} />
                    </TableCell>
                    <TableCell className="py-4 font-mono text-xs text-muted-foreground">
                      {row.query}
                    </TableCell>
                    <TableCell className="py-4">
                      <FindingCell row={row} />
                    </TableCell>
                    <TableCell className="py-4">
                      <ReceiptCell receipt={row.receipt} paymentMode={row.paymentMode} />
                    </TableCell>
                    <TableCell className="py-4 text-right font-mono text-sm text-foreground">
                      ${row.cost.toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <ul className="space-y-3 px-3 pb-3 md:hidden">
          {rows.map((row, i) => (
            <li
              key={row.id}
              id={`record-m-${row.id}`}
              onClick={() => onSelect(selectedRecordId === row.id ? null : row.id)}
              className={cn(
                "rounded-md border border-border/70 p-3 cursor-pointer",
                i % 2 === 1 ? "bg-secondary/30" : "bg-background/40",
                selectedRecordId === row.id && "border-sky-500/60 bg-sky-500/10 ring-2 ring-sky-500/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <AgentDot agent={row.agent} />
                <span className="font-mono text-sm text-foreground">
                  ${row.cost.toFixed(4)}
                </span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                {row.query}
              </p>
              <div className="mt-2">
                <FindingCell row={row} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Receipt
                </span>
                <ReceiptCell receipt={row.receipt} paymentMode={row.paymentMode} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MemoSkeleton() {
  return (
    <Card className="border-border/70 bg-card" aria-busy="true" aria-label="Loading diligence memo">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-56 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-24 w-24 rounded-full" />
        </div>
        <Separator />
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LedgerSkeleton() {
  return (
    <Card className="border-border/70 bg-card" aria-busy="true" aria-label="Loading evidence records">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-4 sm:px-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 rounded-md border border-border/60 p-3">
            <Skeleton className="h-4 w-20" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RunHistory({
  rows,
  selectedRunId,
  onReload,
}: {
  rows: DashboardHistoryRow[];
  selectedRunId: string | null;
  onReload: (row: DashboardHistoryRow) => void;
}) {
  const verdictStyle = {
    buy: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30",
    do_not_buy: "bg-red-600/10 text-red-700 border-red-600/30",
    need_more_evidence: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  } as const;
  const [activeRunId, setActiveRunId] = useState<string | null>(selectedRunId ?? rows[0]?.id ?? null);

  useEffect(() => {
    if (selectedRunId) {
      setActiveRunId(selectedRunId);
    }
  }, [selectedRunId]);
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <History className="h-4 w-4" />
          Local run history
          <span className="ml-auto text-[10px] font-normal tracking-normal text-muted-foreground/70">
            stored in this browser
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Completed runs save in this browser.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRunId(r.id);
                    onReload(r);
                  }}
                  aria-pressed={activeRunId === r.id}
                  style={
                    activeRunId === r.id
                      ? { backgroundColor: "rgba(37,99,235,0.08)" }
                      : undefined
                  }
                  className={cn(
                    "group block w-full rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    activeRunId === r.id
                      ? "border-blue-600/60 ring-1 ring-blue-600/30"
                      : "border-border/70 bg-secondary/20 hover:border-primary/40 hover:bg-secondary/40",
                  )}
                  aria-label={`Reload run on ${r.subject}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-serif-display text-lg leading-tight text-foreground">
                        {r.subject}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {r.policy} · cap ${r.budget.toFixed(2)}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[10px] uppercase tracking-wider",
                        r.mode === "mock"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                          : "border-primary/40 bg-primary/10 text-primary",
                      )}
                    >
                      {r.mode}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {r.question}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3">
                    <Badge variant="outline" className={cn("font-medium capitalize", verdictStyle[r.recommendation])}>
                      {r.recommendation.replace(/_/g, " ")}
                    </Badge>
                    <div className="ml-auto flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-foreground">
                        <span className="text-muted-foreground">spend</span> ${r.spendUsd.toFixed(3)}
                      </span>
                      <span className="text-border">·</span>
                      <span className="text-foreground">
                        <span className="text-muted-foreground">records</span> {r.records}
                      </span>
                      <span className="text-border">·</span>
                      <span className="text-foreground">
                        <span className="text-muted-foreground">conf</span> {r.confidence}%
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ProofPacketExport({
  onExport,
  onShareLink,
  recordCount,
  spentUsd,
}: {
  onExport: (fmt: "json" | "md") => void;
  onShareLink: () => Promise<void>;
  recordCount: number;
  spentUsd: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/[0.05] px-4 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
        Proof packet
      </span>
      <span className="hidden text-[11px] text-muted-foreground sm:inline">
        memo · {recordCount} records · ${spentUsd.toFixed(2)} spent
      </span>
      <div className="ml-auto flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void onShareLink().then(() => toast.success("Share link copied"));
          }}
          className="h-8 gap-1.5 text-xs"
          aria-label="Copy share link"
        >
          <Link2 className="h-3.5 w-3.5" />
          Copy share link
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExport("json")}
          className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10"
          aria-label="Download proof packet as JSON"
        >
          <FileJson className="h-3.5 w-3.5" />
          JSON
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExport("md")}
          className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10"
          aria-label="Download proof packet as Markdown"
        >
          <FileText className="h-3.5 w-3.5" />
          Markdown
        </Button>
      </div>
    </div>
  );
}

function ApiIntegrations() {
  const snippet = `curl -N -X POST http://localhost:3000/api/run-diligence \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "Is Apollo.io worth $99/mo for a 5-seat sales team?",
    "budgetCapUsd": 0.25,
    "policyProfile": "standard",
    "callbackUrl": "https://example.com/webhook"
  }'`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Snippet copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          API &amp; Integrations
        </span>
        <CardTitle className="font-serif text-xl font-semibold tracking-tight">
          ProofSpend for other agents
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Stream a live SSE dashboard, or POST the final run JSON to your webhook when the memo is ready.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative overflow-hidden rounded-lg border border-white/10" style={{ backgroundColor: "#18211b" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={copy}
            className="absolute right-2 top-2 h-7 gap-1.5 text-[11px] text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Copy curl snippet"
          >
            <FileText className="h-3.5 w-3.5" />
            Copy
          </Button>
          <pre className="overflow-x-auto px-4 py-3 pr-20 font-mono text-[12px] leading-relaxed text-emerald-100">
            <code>{snippet}</code>
          </pre>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2">
            <code className="rounded bg-secondary/40 px-1.5 py-0.5 text-[12px] font-mono text-primary">POST /api/run-diligence</code>
            <span className="text-muted-foreground">SSE stream; ends with <code className="font-mono text-foreground">complete</code> event carrying the full run JSON.</span>
          </li>
          <li className="flex gap-2">
            <code className="rounded bg-secondary/40 px-1.5 py-0.5 text-[12px] font-mono text-primary">GET /api/health</code>
            <span className="text-muted-foreground">Reports payment mode, policy profile, and active LLM provider.</span>
          </li>
          <li className="flex gap-2">
            <code className="rounded bg-secondary/40 px-1.5 py-0.5 text-[12px] font-mono text-primary">callbackUrl</code>
            <span className="text-muted-foreground">Receives a POST with the final run JSON after completion.</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

function VendorColumn({ v }: { v: CompareVendor }) {
  const verdictStyle = {
    buy: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30",
    do_not_buy: "bg-red-600/10 text-red-700 border-red-600/30",
    need_more_evidence: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  } as const;
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/20 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-serif-display text-xl text-foreground">{v.subject}</h4>
        <Badge
          variant="outline"
          className={cn(
            "ml-auto text-[10px] uppercase tracking-wider",
            v.mode === "mock"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
              : "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          {v.mode}
        </Badge>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {v.policy}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border/60 bg-card/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Recommendation
          </div>
          <Badge
            variant="outline"
            className={cn("mt-1.5 font-medium capitalize", verdictStyle[v.recommendation])}
          >
            {v.recommendation.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="rounded-md border border-border/60 bg-card/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Confidence
          </div>
          <div className="mt-1 font-serif-display text-2xl text-foreground">{v.confidence}%</div>
        </div>
        <div className="rounded-md border border-border/60 bg-card/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Spend
          </div>
          <div className="mt-1 font-mono text-lg text-foreground">${v.spendUsd.toFixed(2)}</div>
        </div>
        <div className="rounded-md border border-border/60 bg-card/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Evidence
          </div>
          <div className="mt-1 font-mono text-lg text-foreground">
            {v.records} <span className="text-xs text-muted-foreground">records</span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Rationale
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{v.rationale}</p>
      </div>
    </div>
  );
}

function VendorCompare({
  currentVendor,
  compareVendor,
  compareOptions,
  compareRunId,
  onCompareRunChange,
  historyCount,
}: {
  currentVendor: CompareVendor | null;
  compareVendor: CompareVendor | null;
  compareOptions: { id: string; label: string }[];
  compareRunId: string;
  onCompareRunChange: (runId: string) => void;
  historyCount: number;
}) {
  const hasEnough = historyCount >= 2 && currentVendor && compareVendor;
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              Compare vendors
            </div>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Put two diligence runs side by side to compare recommendation, spend, and evidence depth.
            </p>
          </div>
          {hasEnough && compareOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="compare-vendor"
                className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Compare against
              </label>
              <Select value={compareRunId} onValueChange={onCompareRunChange}>
                <SelectTrigger
                  id="compare-vendor"
                  className="h-9 w-[210px] border-border/80 bg-background/60"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {compareOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasEnough ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <VendorColumn v={currentVendor!} />
            <VendorColumn v={compareVendor!} />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Save at least two runs to unlock side-by-side compare.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SafeSpendPanel({ events }: { events: SafeSpendRow[] }) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          SafeSpend policy decisions
          <span className="ml-auto text-[10px] font-normal tracking-normal text-muted-foreground/70">
            preflight gate
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Event", "Agent", "Action", "Status", "Reason / preview", "Projected"].map((h) => (
                  <TableHead key={h} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e, i) => {
                const blocked = e.status === "blocked";
                return (
                  <TableRow
                    key={i}
                    className={cn(
                      "border-border/50 align-top",
                      blocked && "bg-red-500/[0.06]",
                    )}
                  >
                    <TableCell className="py-3">
                      <span className="font-mono text-[11px] text-muted-foreground">{e.kind}</span>
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      {e.agent === "system" ? (
                        <span className="text-muted-foreground">system</span>
                      ) : (
                        <AgentDot agent={e.agent} />
                      )}
                    </TableCell>
                    <TableCell className="py-3 font-mono text-xs text-foreground/90">{e.action}</TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          blocked
                            ? "border-red-500/40 bg-red-500/10 text-red-700"
                            : "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
                        )}
                      >
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className={cn("text-sm", blocked ? "text-red-900" : "text-foreground/90")}>
                        {e.reason}
                      </div>
                      {e.queryPreview && (
                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground line-clamp-1">
                          {e.queryPreview}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono text-sm">
                      ${e.projectedSpendUsd.toFixed(4)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProofSpendDashboard({
  question,
  onQuestionChange,
  budgetCapUsd,
  onBudgetChange,
  policyProfile,
  onPolicyChange,
  isRunning,
  onRun,
  error,
  mode,
  spentUsd,
  paidCalls,
  timelineEvents,
  evidenceRows,
  memo,
  safeSpendRows,
  historyRows,
  selectedRunId,
  onSelectHistory,
  currentVendor,
  compareVendor,
  compareOptions,
  compareRunId,
  onCompareRunChange,
  selectedRecordId,
  onSelectRecord,
  showExport,
  onShareLink,
  onExportJson,
  onExportMarkdown,
  runIdLabel,
}: ProofSpendDashboardProps) {
  const spentPct = Math.min(100, budgetCapUsd > 0 ? (spentUsd / budgetCapUsd) * 100 : 0);
  const overWarn = spentPct > 85;
  const completed = showExport;

  const handleSelectClaim = (recordId: string) => {
    onSelectRecord(selectedRecordId === recordId ? null : recordId);
    if (typeof document !== "undefined") {
      const el =
        document.getElementById(`record-${recordId}`) ||
        document.getElementById(`record-m-${recordId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <main className="min-h-screen bg-background py-10 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-6">
        {/* HERO + INPUT */}
        <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
          <CardContent className="space-y-8 p-8 sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                  ProofSpend
                </div>
                <h1 className="font-serif-display text-4xl font-medium leading-[1.1] text-foreground sm:text-5xl">
                  Receipt-backed research<br />for autonomous agents.
                </h1>
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Set a budget cap, dispatch a panel of agents that pay for evidence via x402
                  micropayments on Base, and get a memo where every claim links back to a settled receipt.
                </p>
              </div>
              <ModeBadge mode={mode} running={isRunning} />
            </div>

            <Separator />

            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="q" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Diligence question
                </label>
                <Textarea
                  id="q"
                  value={question}
                  onChange={(e) => onQuestionChange(e.target.value)}
                  disabled={isRunning}
                  placeholder="Should I spend $500/month on Apollo.io for B2B lead generation?"
                  className="min-h-[96px] resize-none border-border/80 bg-background/60 text-base leading-relaxed"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Try
                  </span>
                  {EXAMPLE_QUESTIONS.map((ex) => (
                    <button
                      key={ex.short}
                      type="button"
                      onClick={() => onQuestionChange(ex.full)}
                      disabled={isRunning}
                      aria-label={`Use example: ${ex.full}`}
                      className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-foreground/80 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                    >
                      {ex.short}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-2 sm:w-56">
                  <label htmlFor="b" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Budget cap (USD)
                  </label>
                  <Input
                    id="b"
                    type="number"
                    step="0.01"
                    min="0"
                    value={budgetCapUsd}
                    onChange={(e) => onBudgetChange(parseFloat(e.target.value) || 0)}
                    disabled={isRunning}
                    className="border-border/80 bg-background/60 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Policy profile
                  </label>
                  <div role="radiogroup" aria-label="Policy profile" className="inline-flex rounded-md border border-border/80 bg-background/60 p-0.5">
                    {(["standard", "strict"] as AppPolicyProfile[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={policyProfile === p}
                        onClick={() => onPolicyChange(p)}
                        disabled={isRunning}
                        className={cn(
                          "rounded px-3 py-1.5 text-xs font-medium capitalize tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          policyProfile === p
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={onRun}
                  disabled={isRunning}
                  className="h-10 px-6 text-sm font-medium tracking-wide sm:ml-auto"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Dispatching agents…
                    </>
                  ) : (
                    <><Play className="mr-1.5 h-4 w-4" />Run diligence</>
                  )}
                </Button>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MOCK WATERMARK */}
        {mode === "mock" && (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900">
            <ShieldAlert className="h-4 w-4 !text-amber-700" />
            <AlertDescription className="text-amber-900">
              Simulated receipts — mock mode; no on-chain Base payments were made.
            </AlertDescription>
          </Alert>
        )}

        {/* SPEND + TIMELINE */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="border-border/70 bg-card lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Wallet className="h-4 w-4" />
                Spend
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-serif-display text-4xl font-medium text-foreground">
                    ${spentUsd.toFixed(4)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    of ${budgetCapUsd.toFixed(2)} cap
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl text-foreground">{paidCalls}</div>
                  <div className="text-xs text-muted-foreground">paid calls</div>
                </div>
              </div>
              <div className="space-y-2">
                <Progress
                  value={spentPct}
                  className={cn("h-2", overWarn && "[&>div]:bg-amber-500")}
                />
                <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                  <span>{spentPct.toFixed(1)}% used</span>
                  <span>${Math.max(0, budgetCapUsd - spentUsd).toFixed(4)} remaining</span>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-3 text-center">
                {(Object.keys(AGENT_META) as AgentKey[]).map((k) => {
                  const meta = AGENT_META[k];
                  const rows = evidenceRows.filter((r) => r.agent === k);
                  const cost = rows.reduce((s, r) => s + r.cost, 0);
                  return (
                    <div key={k} className="rounded-md border border-border/70 bg-secondary/30 p-2">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                        {meta.label}
                      </div>
                      <div className="mt-1 font-mono text-sm text-foreground">${cost.toFixed(4)}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <LiveTimeline events={timelineEvents} />
        </div>

        {/* MEMO */}
        {isRunning ? (
          <MemoSkeleton />
        ) : memo ? (
          <Card className="border-border/70 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Diligence memo
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">Click a claim to jump to evidence ↓</p>
              </div>
              {runIdLabel ? (
                <div className="text-[11px] font-mono text-muted-foreground">{runIdLabel}</div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-8">
              <VerdictBlock verdict={memo.verdict} confidence={memo.confidence} />
              <Separator />
              <section>
                <h3 className="font-serif-display mb-3 text-xl font-medium tracking-tight text-foreground">
                  Rationale
                </h3>
                <p className="max-w-prose text-[15px] leading-relaxed text-foreground/85">
                  {memo.rationale}
                </p>
              </section>
              <Separator />
              <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
                <MemoSection title="Strengths" items={memo.strengths} selectedRecordId={selectedRecordId} onSelect={handleSelectClaim} />
                <MemoSection title="Concerns" items={memo.concerns} selectedRecordId={selectedRecordId} onSelect={handleSelectClaim} />
                <div className="md:col-span-2">
                  <MemoSection title="Next steps" items={memo.nextSteps} selectedRecordId={selectedRecordId} onSelect={handleSelectClaim} />
                </div>
              </div>
              <Separator />
              <p className="text-center text-xs italic leading-relaxed text-muted-foreground">
                Receipt proves payment occurred; claims cite search evidence.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* SAFESPEND PANEL */}
        <SafeSpendPanel events={safeSpendRows} />

        {/* RUN HISTORY → EXPORT → EVIDENCE TABLE (mobile stack order) */}
        <RunHistory
          rows={historyRows}
          selectedRunId={selectedRunId}
          onReload={(r) => onSelectHistory(r.id)}
        />

        <VendorCompare
          currentVendor={currentVendor}
          compareVendor={compareVendor}
          compareOptions={compareOptions}
          compareRunId={compareRunId}
          onCompareRunChange={onCompareRunChange}
          historyCount={historyRows.length}
        />

        {completed && !isRunning && (
          <ProofPacketExport
            onExport={(fmt) => (fmt === "json" ? onExportJson() : onExportMarkdown())}
            onShareLink={onShareLink}
            recordCount={evidenceRows.length}
            spentUsd={spentUsd}
          />
        )}

        {/* EVIDENCE RECORDS */}
        {isRunning ? <LedgerSkeleton /> : (
          <EvidenceLedger
            rows={evidenceRows}
            selectedRecordId={selectedRecordId}
            onSelect={onSelectRecord}
          />
        )}

        <ApiIntegrations />

        <footer className="pt-4 pb-24 text-center text-[11px] text-muted-foreground md:pb-2">
          ProofSpend · x402 micropayments on Base · every claim has a receipt
        </footer>
      </div>

      {/* Mobile sticky run bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden">
        <Button
          onClick={onRun}
          disabled={isRunning}
          aria-label="Run diligence"
          className="h-11 w-full text-sm font-semibold tracking-wide"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Dispatching agents…
            </>
          ) : (
            "Run diligence"
          )}
        </Button>
      </div>
    </main>
  );
}