"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Search,
  FileText,
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
  Download,
  ChevronDown,
  ShieldCheck,
  History,
  FileJson,
  Play,
  Rocket,
  PlayCircle,
  CheckCheck,
  Link2,
  Server,
  Calendar,
  Webhook,
  Eye,
  RefreshCcw,
  Trash2,
  Power,
  Plus,
  Sparkles,
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
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronUp, Layers, Boxes, Vault, KeyRound, Radio, RefreshCw, ArrowRight, FileCheck2, Sparkle, ShieldQuestion, UploadCloud, Lock, ClipboardPaste, Clock } from "lucide-react";

// ====================== Types (exported) ======================

export type Mode = "mock" | "live" | "waiting";
export type PolicyProfile = "standard" | "strict";
export type AgentKey = "market" | "evidence" | "counter";
export type TimelineAgentKey = AgentKey | "skeptic";
export type Verdict = "buy" | "do_not_buy" | "need_more_evidence";

export type TimelineEventType =
  | "run_started"
  | "agent_started"
  | "follow_up_started"
  | "payment_settled"
  | "agent_completed"
  | "follow_up_completed"
  | "policy_blocked"
  | "confidence_updated"
  | "search_failed"
  | "run_error"
  | "webhook_delivery"
  | "complete";

export interface TimelineEvent {
  t: string;
  agent: TimelineAgentKey | "system";
  type: TimelineEventType;
  text: string;
  cost?: number;
  receipt?: string;
}

export interface Citation {
  agent: AgentKey | "system";
  receipt: string;
  recordId?: string;
}

export interface Claim {
  text: string;
  citations: Citation[];
}

export interface Memo {
  verdict: Verdict;
  decisionLabel?: string;
  questionRecap?: string;
  confidence: number;
  proofScore: number;
  proofScoreComponents: {
    overall: number;
    citationCoverage: number;
    runCompleteness: number;
  };
  confidenceBreakdown: ConfidenceBreakdownView;
  confidenceGaps: ConfidenceGapView[];
  decisionFactors: {
    id: string;
    label: string;
    impact: "positive" | "negative" | "blocking";
    recordIds: string[];
  }[];
  confidenceCeiling?: {
    value: number;
    reason: string;
    recordIds?: string[];
  } | null;
  rationale: string;
  strengths: Claim[];
  concerns: Claim[];
  nextSteps: Claim[];
}

export interface ConfidenceBreakdownView {
  overall: number;
  agentSignals: {
    agent: "Market" | "Evidence" | "Counter" | "Skeptic";
    ran: boolean;
    confidence?: number;
    negativity?: number;
    recordId?: string;
  }[];
  factors: {
    id: string;
    label: string;
    impact: number;
    recordIds: string[];
  }[];
  policyAdjustments: {
    rule: string;
    delta: number;
    reason: string;
  }[];
  effectiveCounterRisk?: number;
  confidenceCeiling?: {
    value: number;
    reason: string;
    recordIds?: string[];
  } | null;
}

export interface ConfidenceGapView {
  id: string;
  title: string;
  detail?: string;
  estimatedConfidenceGain: number;
  estimatedCostUsd: number;
  suggestedQuery?: string;
  actionType: "paid_search" | "trial" | "internal_data";
  recordIds?: string[];
  focusAgent?: "Market" | "Evidence" | "Counter" | "Skeptic";
  parentRunId?: string;
  theme?: "legal_resolution" | "pricing_validation" | "implementation_validation" | "deliverability_validation" | "general_validation";
  priority?: number;
}

export interface EvidenceRow {
  id: string;
  agent: AgentKey;
  query: string;
  finding: string;
  sources: { label: string; url: string }[];
  receipt: string;
  cost: number;
}

export interface SafeSpendEvent {
  kind: "batch_preflight" | "preflight" | "receipt";
  agent: AgentKey | "system";
  action: string;
  status: "allowed" | "blocked";
  reason: string;
  queryPreview?: string;
  projectedSpendUsd: number;
}

export interface HistoryRow {
  id: string;
  subject: string;
  question: string;
  budget: number;
  policy: PolicyProfile;
  records: number;
  spendUsd: number;
  confidence: number;
  proofScore: number;
  recommendation: Verdict;
  mode: "mock" | "live";
  at: string;
}

export interface VendorSummary {
  id: string;
  subject: string;
  mode: "mock" | "live";
  policy: PolicyProfile;
  recommendation: Verdict;
  confidence: number;
  proofScore: number;
  spendUsd: number;
  records: number;
  rationale: string;
  topFactors: string[];
  decisionFactors: string[];
  continuationDepth?: number;
  parentRunId?: string;
  confidenceGaps: ConfidenceGapView[];
  confidenceCeiling?: {
    value: number;
    reason: string;
    recordIds?: string[];
  } | null;
}

export interface RaiseConfidenceRunRequest {
  gapId: string;
  suggestedQuery: string;
  budgetCapUsd: number;
  parentRunId?: string;
  focusAgent?: "Market" | "Evidence" | "Counter" | "Skeptic";
}

export interface Health {
  paymentMode: "mock" | "live";
  paymentConfigured?: boolean;
  policyProfile: PolicyProfile;
  llmProvider: string;
  snapshotSigningAvailable: boolean;
  apiAuthRequired?: boolean;
  uptimeSeconds: number;
  rateLimits: { runDiligence: { limit: number } };
  readinessSummary: string;
  ready: boolean;
  estimatedConfidenceRange: {
    baselineMin: number;
    baselineMax: number;
    upperBoundWithSkeptic: number;
  };
}

export interface Estimate {
  estimatedPaidCallCostUsd: number;
  estimatedBaselineCalls: number;
  estimatedMaxCalls: number;
  estimatedConfidenceRange?: {
    baselineMin: number;
    baselineMax: number;
    upperBoundWithSkeptic: number;
  };
}

export interface Schedule {
  id: string;
  name: string;
  cron: string;
  question: string;
  budgetCapUsd: number;
  policyProfile: PolicyProfile;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface WebhookEvent {
  id: string;
  url: string;
  status: "delivered" | "pending" | "failed";
  attempts: number;
  lastAt: string;
  statusCode?: number;
  error?: string;
}

export interface ObservabilityEvent {
  id: string;
  t: string;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
}

export interface FailureSummary {
  windowLabel: string;
  total: number;
  byType: { type: string; count: number }[];
}

export interface ProofSpendDashboardProps {
  question: string;
  onQuestionChange: (v: string) => void;
  budgetCapUsd: number;
  onBudgetChange: (v: number) => void;
  policyProfile: PolicyProfile;
  onPolicyChange: (v: PolicyProfile) => void;
  callbackUrl: string;
  onCallbackUrlChange: (v: string) => void;
  exampleQuestions: { short: string; full: string }[];
  onDemoRun: () => void;
  demoRunDisabled: boolean;
  isRunning: boolean;
  onRun: () => void;
  onCancelRun: () => void;
  error: string | null;
  mode: Mode;
  activePolicyProfile?: PolicyProfile | null;
  spentUsd: number;
  paidCalls: number;
  timelineEvents: TimelineEvent[];
  evidenceRows: EvidenceRow[];
  memo: Memo | null;
  safeSpendRows: SafeSpendEvent[];
  historyRows: HistoryRow[];
  selectedRunId: string | null;
  onSelectHistory: (id: string) => void;
  onClearHistory: () => void;
  currentVendor: VendorSummary | null;
  compareVendor: VendorSummary | null;
  compareOptions: { id: string; label: string }[];
  compareRunId: string | null;
  onCompareRunChange: (id: string) => void;
  selectedRecordId: string | null;
  onSelectRecord: (id: string | null) => void;
  showExport: boolean;
  onShareLink: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  health: Health | null;
  healthUnavailable: boolean;
  estimate: Estimate;
  schedules: Schedule[];
  onCreateSchedule: () => void;
  onDeleteSchedule: (id: string) => void;
  onToggleSchedule: (id: string) => void;
  onRunScheduleNow: (id: string) => void;
  webhookEvents?: WebhookEvent[];
  onRetryWebhook: (id: string) => void;
  observabilityEvents: ObservabilityEvent[];
  failureSummary: FailureSummary;
  runIdLabel?: string;
  liveConfidence?: {
    confidence: number;
    proofScore: number;
    reason?: string;
  } | null;
  onRaiseConfidenceRun: (request: RaiseConfidenceRunRequest) => void;
  apiKey?: string;
  onApiKeyChange?: (value: string) => void;
  /** Stage-demo polish: parent owns the playback (use DemoPlaybackProvider in previews). */
  demoMode?: boolean;
  demoBannerText?: string;
  justCompleted?: boolean;
  onReplayDemo?: () => void;
}

// ====================== Palettes ======================

const AGENT_META: Record<AgentKey, { label: string }> = {
  market: { label: "Market" },
  evidence: { label: "Evidence" },
  counter: { label: "Counter" },
};

const TIMELINE_AGENT: Record<
  TimelineAgentKey | "system",
  { label: string; border: string; chip: string; dot: string }
> = {
  market: { label: "Market", border: "#38bdf8", chip: "text-sky-300", dot: "bg-sky-400" },
  evidence: { label: "Evidence", border: "#34d399", chip: "text-emerald-300", dot: "bg-emerald-400" },
  counter: { label: "Counter", border: "#f59e0b", chip: "text-amber-300", dot: "bg-amber-400" },
  skeptic: { label: "Skeptic", border: "#a78bfa", chip: "text-violet-300", dot: "bg-violet-400" },
  system: { label: "System", border: "#64748b", chip: "text-white/55", dot: "bg-white/40" },
};

const EVENT_TYPE_LABEL: Record<TimelineEventType, string> = {
  run_started: "RUN_STARTED",
  agent_started: "AGENT_STARTED",
  follow_up_started: "FOLLOW_UP_STARTED",
  payment_settled: "PAYMENT_SETTLED",
  agent_completed: "AGENT_COMPLETED",
  follow_up_completed: "FOLLOW_UP_COMPLETED",
  policy_blocked: "POLICY_BLOCKED",
  confidence_updated: "CONFIDENCE",
  search_failed: "SEARCH_FAILED",
  run_error: "RUN_ERROR",
  webhook_delivery: "WEBHOOK",
  complete: "COMPLETE",
};

const EVENT_TYPE_ICON: Record<TimelineEventType, typeof Search> = {
  run_started: Rocket,
  agent_started: PlayCircle,
  follow_up_started: ArrowRight,
  agent_completed: CheckCheck,
  follow_up_completed: Sparkles,
  payment_settled: Receipt,
  policy_blocked: ShieldAlert,
  confidence_updated: Sparkles,
  search_failed: AlertCircle,
  run_error: XCircle,
  webhook_delivery: Webhook,
  complete: CheckCircle2,
};

// ====================== Small components ======================

function ModeBadge({ mode, running }: { mode: Mode; running: boolean }) {
  const config = {
    live: { label: "Live x402", ring: "border-primary/30 bg-primary/10 text-primary", dot: "bg-primary" },
    mock: { label: "Mock", ring: "border-amber-500/30 bg-amber-500/10 text-amber-700", dot: "bg-amber-500" },
    waiting: { label: "Waiting", ring: "border-border bg-secondary/60 text-muted-foreground", dot: "bg-muted-foreground" },
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
      <span aria-hidden className={cn("inline-block h-1.5 w-1.5 rounded-full", config.dot, running && "animate-pulse")} />
      {config.label}
    </div>
  );
}

function StatusStrip({ health, healthUnavailable }: { health: Health | null; healthUnavailable: boolean }) {
  if (healthUnavailable) {
    return (
      <Card className="border-amber-500/40 bg-amber-50/60">
        <CardContent className="flex items-center gap-3 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4" />
          System status unavailable — /api/health is not reachable.
        </CardContent>
      </Card>
    );
  }
  if (!health) {
    return (
      <Card className="border-border/70 bg-card">
        <CardContent className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking system status…
        </CardContent>
      </Card>
    );
  }

  const paymentLabel =
    health.paymentMode === "mock"
      ? "Mock"
      : health.paymentConfigured === false
        ? "Live (not configured)"
        : "Live ready";
  const paymentTone: "mock" | "live" | "warn" =
    health.paymentMode === "mock" ? "mock" : health.paymentConfigured === false ? "warn" : "live";
  const proofsLabel = health.snapshotSigningAvailable ? "Signed snapshots ready" : "Digest-only proofs";

  const pills: { label: string; value: string; tone?: "mock" | "live" | "warn" | "muted" }[] = [
    { label: "Payment", value: paymentLabel, tone: paymentTone },
    { label: "LLM", value: health.llmProvider },
    { label: "Policy", value: health.policyProfile },
    { label: "Proofs", value: proofsLabel, tone: health.snapshotSigningAvailable ? "live" : "muted" },
    { label: "Ops", value: `up ${health.uptimeSeconds}s · run ${health.rateLimits.runDiligence.limit}/min` },
  ];

  return (
    <Card className="border-border/70 bg-card">
      <CardContent className="space-y-2 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Server className="h-3.5 w-3.5" />
            System
          </div>
          {pills.map((p) => (
            <span
              key={p.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                p.tone === "mock" && "border-amber-500/40 bg-amber-50 text-amber-800",
                p.tone === "live" && "border-primary/30 bg-primary/10 text-primary",
                p.tone === "warn" && "border-amber-500/40 bg-amber-50 text-amber-900",
                p.tone === "muted" && "border-border bg-muted/60 text-muted-foreground",
                !p.tone && "border-border/70 bg-background/60 text-foreground/85",
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{p.label}</span>
              <span className="font-mono">{p.value}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {health.ready ? "✓ " : "• "}
          {health.readinessSummary}
        </p>
      </CardContent>
    </Card>
  );
}

function CitationChip({ agent, receipt, recordId, onSelect }: Citation & { onSelect?: (id: string) => void }) {
  const isLive = !receipt.startsWith("mock:");
  const label = agent === "system" ? "System" : AGENT_META[agent].label;
  const display = isLive ? receipt.slice(0, 10) + "…" : receipt;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (recordId && onSelect) onSelect(recordId);
      }}
      className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
      aria-label={recordId ? `Jump to record ${recordId}` : `Citation ${receipt}`}
      title={`${label} · ${receipt}${isLive ? "" : " (mock)"}`}
    >
      <span className="text-foreground">{label}</span>
      <span className="text-border">·</span>
      <span className={cn("font-mono", isLive ? "text-primary" : "text-muted-foreground")}>{display}</span>
      <ExternalLink className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-70" />
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  cta,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  cta?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary/40 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{title}</p>
      {cta && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="h-8 text-xs">
          {cta}
        </Button>
      )}
    </div>
  );
}

// ====================== Live timeline ======================

function LiveTimeline({ events }: { events: TimelineEvent[] }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.scrollTo({ top: vp.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  return (
    <Card className="overflow-hidden border-0 bg-[#18211b] text-[#e9eee7] lg:col-span-3">
      <CardHeader className="border-b border-white/5 pb-3">
        <CardTitle className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/60">
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
            <ol
              className="relative px-6 py-5"
              aria-live="polite"
              aria-relevant="additions"
              aria-label="Live agent timeline"
            >
              <span aria-hidden className="pointer-events-none absolute left-[34px] top-6 bottom-6 w-px bg-white/10" />
              {events.map((e, i) => {
                const meta = TIMELINE_AGENT[e.agent];
                const Icon = EVENT_TYPE_ICON[e.type];
                const isBlocked = e.type === "policy_blocked" || e.type === "search_failed" || e.type === "run_error";
                const isPaid = e.type === "payment_settled";
                return (
                  <li key={i} className="relative pl-10 pb-4 last:pb-0">
                    <span
                      className={cn(
                        "absolute left-[26px] top-3 z-10 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-[#18211b]",
                        isBlocked && "border-red-400/80",
                      )}
                      style={isBlocked ? undefined : { borderColor: meta.border }}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", isBlocked ? "bg-red-400" : meta.dot)} />
                    </span>
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
                        <Icon className={cn("h-3.5 w-3.5", isBlocked ? "text-red-300" : "text-white/55")} />
                        <span className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", isBlocked ? "text-red-300" : meta.chip)}>
                          {meta.label}
                        </span>
                        <span className="text-white/20">·</span>
                        <span className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", isBlocked ? "text-red-200/90" : "text-white/45")}>
                          {EVENT_TYPE_LABEL[e.type]}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-white/30">{e.t}</span>
                      </div>
                      <div className={cn("mt-1 text-sm leading-snug", isBlocked ? "text-red-50/90" : "text-white/85")}>
                        {e.text}
                      </div>
                      {isPaid && (e.cost != null || e.receipt) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {e.cost != null && (
                            <span className="font-mono text-xs text-emerald-300">${e.cost.toFixed(2)}</span>
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

// ====================== Memo ======================

function ConfidenceRing({ value }: { value: number }) {
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative inline-flex h-24 w-24 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" className="text-border" strokeWidth={stroke} fill="none" />
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
        <span className="font-serif-display text-2xl font-medium leading-none text-foreground">{value}%</span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">confidence</span>
      </div>
    </div>
  );
}

function VerdictBlock({
  verdict,
  confidence,
  decisionLabel,
  questionRecap,
}: {
  verdict: Verdict;
  confidence: number;
  decisionLabel?: string;
  questionRecap?: string;
}) {
  const map = {
    buy: { label: "BUY", sub: "Recommended action", pill: "bg-emerald-600 text-white ring-emerald-600/20", Icon: CheckCircle2 },
    do_not_buy: { label: "DO NOT BUY", sub: "Recommended action", pill: "bg-red-600 text-white ring-red-600/20", Icon: XCircle },
    need_more_evidence: { label: "NEED MORE EVIDENCE", sub: "Inconclusive — gather more signal", pill: "bg-amber-500 text-white ring-amber-500/20", Icon: HelpCircle },
  }[verdict];
  const { Icon } = map;
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recommendation</span>
        <div className={cn("inline-flex items-center gap-3 self-start rounded-full px-5 py-2.5 text-base font-semibold tracking-wider shadow-sm ring-8", map.pill)}>
          <Icon className="h-5 w-5" />
          {decisionLabel ?? map.label}
        </div>
        <span className="text-sm text-muted-foreground">{map.sub}</span>
        {questionRecap ? <span className="text-xs text-muted-foreground">{questionRecap}</span> : null}
      </div>
      <ConfidenceRing value={confidence} />
    </div>
  );
}

function WhyVerdictPanel({
  factors,
  confidenceCeiling,
}: {
  factors: Memo["decisionFactors"];
  confidenceCeiling?: Memo["confidenceCeiling"];
}) {
  if (factors.length === 0 && !confidenceCeiling) {
    return null;
  }

  return (
    <Card className="border-border/70 bg-secondary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Why this verdict
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {factors.slice(0, 3).map((factor) => (
          <div key={factor.id} className="rounded-md border border-border/60 bg-card/60 px-3 py-2 text-sm text-foreground/90">
            {factor.label}
          </div>
        ))}
        {confidenceCeiling ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
            Confidence cap: {confidenceCeiling.reason}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ConfidenceBreakdownPanel({
  memo,
  onSelectRecord,
}: {
  memo: Memo;
  onSelectRecord: (id: string | null) => void;
}) {
  const positiveFactors = memo.confidenceBreakdown.factors.filter((factor) => factor.impact > 0);
  const negativeFactors = memo.confidenceBreakdown.factors.filter((factor) => factor.impact < 0);
  const selectFactor = (recordIds: string[]) => {
    const first = recordIds[0] ?? null;
    if (first) {
      onSelectRecord(first);
    }
  };

  return (
    <Card className="border-border/70 bg-secondary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Confidence breakdown
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Server-owned score based on agent signals, receipt coverage, agreement, and policy friction.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {memo.confidenceBreakdown.confidenceCeiling ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
            Confidence is currently capped at {memo.confidenceBreakdown.confidenceCeiling.value}% because {memo.confidenceBreakdown.confidenceCeiling.reason.toLowerCase()}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-4">
          {memo.confidenceBreakdown.agentSignals.map((signal) => (
            <div key={signal.agent} className="rounded-md border border-border/60 bg-card/60 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {signal.agent}
              </div>
              <div className="mt-1 text-xl font-serif-display text-foreground">
                {signal.confidence !== undefined
                  ? `${signal.confidence}%`
                  : signal.negativity !== undefined
                    ? `${signal.negativity}% risk`
                    : signal.ran
                      ? "Ran"
                      : "Skipped"}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {signal.ran ? "completed" : "not completed"}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Positive drivers
            </div>
            {positiveFactors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No positive confidence drivers were recorded.</p>
            ) : (
              positiveFactors.map((factor) => (
                <button
                  key={factor.id}
                  type="button"
                  onClick={() => selectFactor(factor.recordIds)}
                  className="flex w-full items-start justify-between gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-left"
                >
                  <span className="text-sm text-foreground/90">{factor.label}</span>
                  <span className="font-mono text-sm text-emerald-700">+{factor.impact}</span>
                </button>
              ))
            )}
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Confidence drag
            </div>
            {negativeFactors.length === 0 && memo.confidenceBreakdown.policyAdjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No negative confidence factors were recorded.</p>
            ) : (
              <>
                {negativeFactors.map((factor) => (
                  <button
                    key={factor.id}
                    type="button"
                    onClick={() => selectFactor(factor.recordIds)}
                    className="flex w-full items-start justify-between gap-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-left"
                  >
                    <span className="text-sm text-foreground/90">{factor.label}</span>
                    <span className="font-mono text-sm text-amber-700">{factor.impact}</span>
                  </button>
                ))}
                {memo.confidenceBreakdown.policyAdjustments.map((adjustment) => (
                  <div
                    key={adjustment.rule}
                    className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm text-foreground/90">{adjustment.reason}</span>
                      <span className="font-mono text-sm text-red-700">{adjustment.delta}</span>
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {adjustment.rule}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RaiseConfidenceCard({
  memo,
  onQuestionChange,
  onBudgetChange,
  onRunGap,
  activeRunId,
  spentUsd,
}: {
  memo: Memo;
  onQuestionChange: (value: string) => void;
  onBudgetChange: (value: number) => void;
  onRunGap: (request: RaiseConfidenceRunRequest) => void;
  activeRunId?: string;
  spentUsd: number;
}) {
  if (
    memo.verdict !== "need_more_evidence" &&
    memo.proofScore >= 75 &&
    memo.confidenceGaps.length === 0
  ) {
    return null;
  }

  const topGaps = memo.confidenceGaps.slice(0, 2);
  if (topGaps.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Raise confidence
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Highest-leverage next steps to increase evidence quality or reduce disagreement.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {topGaps.map((gap) => (
          <div key={gap.id} className="rounded-md border border-border/60 bg-secondary/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-foreground">{gap.title}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  +{gap.estimatedConfidenceGain}% confidence | {gap.actionType.replace("_", " ")}
                  {gap.estimatedCostUsd > 0 ? ` | ~ $${gap.estimatedCostUsd.toFixed(2)}` : ""}
                </div>
              </div>
              {gap.actionType === "paid_search" && gap.suggestedQuery ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!activeRunId) {
                      return;
                    }

                    const rerunBudget = Number(
                      (spentUsd + Math.max(gap.estimatedCostUsd + 0.05, 0.05)).toFixed(2),
                    );
                    const suggestedQuery = gap.suggestedQuery!;
                    onBudgetChange(rerunBudget);
                    onRunGap({
                      gapId: gap.id,
                      suggestedQuery,
                      budgetCapUsd: rerunBudget,
                      parentRunId: activeRunId,
                      focusAgent: gap.focusAgent,
                    });
                  }}
                >
                  Run follow-up ({`$${gap.estimatedCostUsd.toFixed(2)}`})
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MemoSection({
  title,
  items,
  selected,
  onSelectRecord,
}: {
  title: string;
  items: Claim[];
  selected: string | null;
  onSelectRecord: (recordId: string | null) => void;
}) {
  return (
    <section>
      <h3 className="font-serif-display mb-3 text-xl font-medium tracking-tight text-foreground">{title}</h3>
      <ul className="space-y-3">
        {items.map((it, i) => {
          const firstRecord = it.citations.find((c) => c.recordId)?.recordId ?? null;
          const isSelected = !!selected && it.citations.some((c) => c.recordId === selected);
          return (
            <li key={i}>
              <div
                role={firstRecord ? "button" : undefined}
                tabIndex={firstRecord ? 0 : undefined}
                onClick={() => firstRecord && onSelectRecord(isSelected ? null : firstRecord)}
                onKeyDown={(event) => {
                  if (!firstRecord) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectRecord(isSelected ? null : firstRecord);
                  }
                }}
                className={cn(
                  "block w-full rounded-md border border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  isSelected
                    ? "border-sky-500/60 border-l-sky-500 bg-sky-500/10 ring-2 ring-sky-500/50"
                    : "border-border/70 border-l-primary bg-secondary/30 hover:bg-secondary/60",
                )}
              >
                <p className="text-sm leading-relaxed text-foreground/90">{it.text}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {it.citations.map((c, j) => (
                    <CitationChip key={j} {...c} onSelect={onSelectRecord} />
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ====================== Evidence ledger ======================

function ReceiptCell({ receipt }: { receipt: string }) {
  const isLive = !receipt.startsWith("mock:");
  if (isLive) {
    return (
      <a href="#" className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary hover:bg-primary/20">
        {receipt.slice(0, 8)}…
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 font-medium uppercase tracking-wider text-amber-700">
      Simulated
    </Badge>
  );
}

function AgentDot({ agent }: { agent: AgentKey }) {
  const meta = TIMELINE_AGENT[agent];
  return (
    <span className="inline-flex items-center gap-2" aria-label={`Agent: ${meta.label}`}>
      <span
        aria-hidden
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
      <p className={cn("text-sm leading-relaxed text-foreground/90", !open && "line-clamp-2")}>{row.finding}</p>
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
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="ml-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
        >
          {open ? "Show less" : "Show more"}
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
      </div>
    </div>
  );
}

function EvidenceLedger({
  rows,
  selected,
  onSelect,
}: {
  rows: EvidenceRow[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  return (
    <Card id="evidence-records" className="border-border/70 bg-card scroll-mt-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Evidence ledger
            </CardTitle>
            <p className="mt-1.5 text-sm text-foreground/80">
              <span className="font-mono">{rows.length}</span> paid searches
              <span className="mx-2 text-border">·</span>
              <span className="font-mono">${totalCost.toFixed(2)}</span> spent
            </p>
          </div>
          {selected && (
            <button type="button" onClick={() => onSelect(null)} className="self-start text-[11px] font-medium text-sky-700 hover:underline sm:self-auto">
              Clear claim selection
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-2">
        <div className="hidden md:block">
          <div className="max-h-[520px] overflow-auto rounded-b-md">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="w-[130px] text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Agent</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Query</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Finding</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Receipt</TableHead>
                  <TableHead className="w-[90px] text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={row.id}
                    id={`record-${row.id}`}
                    onClick={() => onSelect(selected === row.id ? null : row.id)}
                    className={cn(
                      "border-border/50 align-top cursor-pointer",
                      i % 2 === 1 && "bg-secondary/25",
                      selected === row.id && "bg-sky-500/10 outline outline-2 -outline-offset-2 outline-sky-500/60",
                    )}
                  >
                    <TableCell className="py-4"><AgentDot agent={row.agent} /></TableCell>
                    <TableCell className="py-4 font-mono text-xs text-muted-foreground">{row.query}</TableCell>
                    <TableCell className="py-4"><FindingCell row={row} /></TableCell>
                    <TableCell className="py-4"><ReceiptCell receipt={row.receipt} /></TableCell>
                    <TableCell className="py-4 text-right font-mono text-sm text-foreground">${row.cost.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <ul className="space-y-3 px-3 pb-3 md:hidden">
          {rows.map((row, i) => (
            <li
              key={row.id}
              id={`record-m-${row.id}`}
              onClick={() => onSelect(selected === row.id ? null : row.id)}
              className={cn(
                "rounded-md border border-border/70 p-3 cursor-pointer",
                i % 2 === 1 ? "bg-secondary/30" : "bg-background/40",
                selected === row.id && "border-sky-500/60 bg-sky-500/10 ring-2 ring-sky-500/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <AgentDot agent={row.agent} />
                <span className="font-mono text-sm text-foreground">${row.cost.toFixed(4)}</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">{row.query}</p>
              <div className="mt-2"><FindingCell row={row} /></div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Receipt</span>
                <ReceiptCell receipt={row.receipt} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ====================== SafeSpend ======================

function SafeSpendPanel({ events }: { events: SafeSpendEvent[] }) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          SafeSpend policy decisions
          <span className="ml-auto text-[10px] font-normal tracking-normal text-muted-foreground/70">preflight gate</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Event", "Agent", "Action", "Status", "Reason / preview", "Projected"].map((h) => (
                  <TableHead key={h} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e, i) => {
                const blocked = e.status === "blocked";
                return (
                  <TableRow key={i} className={cn("border-border/50 align-top", blocked && "bg-red-500/[0.06]")}>
                    <TableCell className="py-3"><span className="font-mono text-[11px] text-muted-foreground">{e.kind}</span></TableCell>
                    <TableCell className="py-3 text-sm">
                      {e.agent === "system" ? <span className="text-muted-foreground">system</span> : <AgentDot agent={e.agent} />}
                    </TableCell>
                    <TableCell className="py-3 font-mono text-xs text-foreground/90">{e.action}</TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          blocked ? "border-red-500/40 bg-red-500/10 text-red-700" : "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
                        )}
                      >
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className={cn("text-sm", blocked ? "text-red-900" : "text-foreground/90")}>{e.reason}</div>
                      {e.queryPreview && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground line-clamp-1">{e.queryPreview}</div>}
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono text-sm">${e.projectedSpendUsd.toFixed(4)}</TableCell>
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

// ====================== History ======================

const verdictBadge = {
  buy: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30",
  do_not_buy: "bg-red-600/10 text-red-700 border-red-600/30",
  need_more_evidence: "bg-amber-500/10 text-amber-700 border-amber-500/30",
} as const;

function RunHistory({
  rows,
  selectedRunId,
  onSelect,
  onClear,
}: {
  rows: HistoryRow[];
  selectedRunId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <History className="h-4 w-4" />
          Local run history
          <span className="ml-auto text-[10px] font-normal tracking-normal text-muted-foreground/70">stored in this browser</span>
          {rows.length > 0 && (
            <Button variant="ghost" size="sm" className="ml-2 h-7 gap-1 text-[11px]" onClick={onClear} aria-label="Clear history">
              <Trash2 className="h-3 w-3" /> Clear
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <EmptyState icon={Vault} title="No saved runs yet — completed diligence packets land here." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rows.map((r) => {
              const active = selectedRunId === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(r.id)}
                    aria-pressed={active}
                    style={active ? { backgroundColor: "rgba(37,99,235,0.08)" } : undefined}
                    className={cn(
                      "group block w-full rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      active ? "border-blue-600/60 ring-1 ring-blue-600/30" : "border-border/70 bg-secondary/20 hover:border-primary/40 hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-serif-display text-lg leading-tight text-foreground">{r.subject}</div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {r.at} · {r.policy} · cap ${r.budget.toFixed(2)}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[10px] uppercase tracking-wider",
                          r.mode === "mock" ? "border-amber-500/40 bg-amber-500/10 text-amber-700" : "border-primary/40 bg-primary/10 text-primary",
                        )}
                      >
                        {r.mode}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{r.question}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3">
                      <Badge variant="outline" className={cn("font-medium capitalize", verdictBadge[r.recommendation])}>
                        {r.recommendation.replace(/_/g, " ")}
                      </Badge>
                      <div className="ml-auto flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-foreground"><span className="text-muted-foreground">spend</span> ${r.spendUsd.toFixed(3)}</span>
                        <span className="text-border">·</span>
                        <span className="text-foreground"><span className="text-muted-foreground">records</span> {r.records}</span>
                        <span className="text-border">·</span>
                        <span className="text-foreground"><span className="text-muted-foreground">conf</span> {r.confidence}%</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ====================== Vendor compare ======================

function VendorColumn({ v }: { v: VendorSummary }) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/20 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-serif-display text-xl text-foreground">{v.subject}</h4>
        <Badge
          variant="outline"
          className={cn(
            "ml-auto text-[10px] uppercase tracking-wider",
            v.mode === "mock" ? "border-amber-500/40 bg-amber-500/10 text-amber-700" : "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          {v.mode}
        </Badge>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">{v.policy}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border/60 bg-card/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recommendation</div>
          <Badge variant="outline" className={cn("mt-1.5 font-medium capitalize", verdictBadge[v.recommendation])}>
            {v.recommendation.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="rounded-md border border-border/60 bg-card/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Confidence</div>
          <div className="mt-1 font-serif-display text-2xl text-foreground">{v.confidence}%</div>
        </div>
        <div className="rounded-md border border-border/60 bg-card/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Spend</div>
          <div className="mt-1 font-mono text-lg text-foreground">${v.spendUsd.toFixed(2)}</div>
        </div>
        <div className="rounded-md border border-border/60 bg-card/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Evidence</div>
          <div className="mt-1 font-mono text-lg text-foreground">{v.records} <span className="text-xs text-muted-foreground">records</span></div>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Rationale</div>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{v.rationale}</p>
      </div>
    </div>
  );
}

function VendorCompare({
  current,
  compare,
  options,
  compareRunId,
  onCompareChange,
}: {
  current: VendorSummary | null;
  compare: VendorSummary | null;
  options: { id: string; label: string }[];
  compareRunId: string | null;
  onCompareChange: (id: string) => void;
}) {
  const hasEnough = !!current && options.length > 0;
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Compare vendors</div>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Put two diligence runs side by side to compare recommendation, spend, and evidence depth.
            </p>
          </div>
          {hasEnough && (
            <div className="flex items-center gap-2">
              <label htmlFor="compare-vendor" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Compare against
              </label>
              <Select value={compareRunId ?? undefined} onValueChange={onCompareChange}>
                <SelectTrigger id="compare-vendor" className="h-9 w-[240px] border-border/80 bg-background/60">
                  <SelectValue placeholder="Pick a run" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasEnough && current && compare ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <VendorColumn v={current} />
            <VendorColumn v={compare} />
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

// ====================== Export bar ======================

function ProofPacketExport({
  onShareLink,
  onExportJson,
  onExportMarkdown,
}: {
  onShareLink: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/[0.05] px-4 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Proof packet</span>
      <span className="hidden text-[11px] text-muted-foreground sm:inline">memo · claims · receipts</span>
      <div className="ml-auto flex gap-1.5">
        <Button variant="outline" size="sm" onClick={onShareLink} className="h-8 gap-1.5 text-xs" aria-label="Copy share link">
          <Link2 className="h-3.5 w-3.5" /> Copy share link
        </Button>
        <Button variant="ghost" size="sm" onClick={onExportJson} className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10" aria-label="Export JSON">
          <FileJson className="h-3.5 w-3.5" /> JSON
        </Button>
        <Button variant="ghost" size="sm" onClick={onExportMarkdown} className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10" aria-label="Export Markdown">
          <FileText className="h-3.5 w-3.5" /> Markdown
        </Button>
      </div>
    </div>
  );
}

// ====================== Schedules ======================

function SchedulesConsole({
  schedules,
  onCreate,
  onDelete,
  onToggle,
  onRunNow,
}: {
  schedules: Schedule[];
  onCreate: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onRunNow: (id: string) => void;
}) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Calendar className="h-4 w-4" /> Scheduled diligence
          </CardTitle>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" /> New schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {schedules.length === 0 ? (
          <EmptyState icon={Clock} title="No scheduled runs yet." cta="New schedule" onAction={onCreate} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Name", "Cron", "Cap", "Last", "Next", "State", "Actions"].map((h) => (
                    <TableHead key={h} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id} className="border-border/50">
                    <TableCell className="py-3">
                      <div className="font-medium text-foreground">{s.name}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{s.question}</div>
                    </TableCell>
                    <TableCell className="py-3 font-mono text-xs">{s.cron}</TableCell>
                    <TableCell className="py-3 font-mono text-xs">${s.budgetCapUsd.toFixed(2)}</TableCell>
                    <TableCell className="py-3 text-xs text-muted-foreground">{s.lastRunAt ?? "—"}</TableCell>
                    <TableCell className="py-3 text-xs text-muted-foreground">{s.nextRunAt ?? "—"}</TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          s.enabled ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700" : "border-border bg-secondary/40 text-muted-foreground",
                        )}
                      >
                        {s.enabled ? "on" : "off"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onRunNow(s.id)} aria-label="Run now">
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onToggle(s.id)} aria-label="Toggle">
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => onDelete(s.id)} aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ====================== Webhook delivery ======================

function WebhookConsole({ events, onRetry }: { events: WebhookEvent[]; onRetry: (id: string) => void }) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Webhook className="h-4 w-4" /> Webhook delivery
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {events.length === 0 ? (
          <EmptyState icon={Webhook} title="No webhook deliveries yet — they'll appear after the first run completes." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["URL", "Status", "Attempts", "Last", "Code", "Error", ""].map((h) => (
                    <TableHead key={h} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((w) => {
                  const tone =
                    w.status === "delivered"
                      ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700"
                      : w.status === "pending"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                        : "border-red-500/40 bg-red-500/10 text-red-700";
                  return (
                    <TableRow key={w.id} className="border-border/50">
                      <TableCell className="py-3 font-mono text-xs text-foreground/90">{w.url}</TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", tone)}>{w.status}</Badge>
                      </TableCell>
                      <TableCell className="py-3 font-mono text-xs">{w.attempts}</TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground">{w.lastAt}</TableCell>
                      <TableCell className="py-3 font-mono text-xs">{w.statusCode ?? "—"}</TableCell>
                      <TableCell className="py-3 text-xs text-red-700/90">{w.error ?? ""}</TableCell>
                      <TableCell className="py-3 text-right">
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onRetry(w.id)} aria-label="Retry">
                          <RefreshCcw className="h-3 w-3" /> Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ====================== Observability ======================

function ObservabilityConsole({
  events,
  failureSummary,
}: {
  events: ObservabilityEvent[];
  failureSummary: FailureSummary;
}) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Eye className="h-4 w-4" /> Observability
          </CardTitle>
          <div className="text-[11px] text-muted-foreground">
            {failureSummary.total} failures · {failureSummary.windowLabel}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {failureSummary.byType.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {failureSummary.byType.map((b) => (
              <span key={b.type} className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/40 px-2.5 py-1 text-[11px]">
                <span className="font-mono text-foreground">{b.count}</span>
                <span className="text-muted-foreground">{b.type}</span>
              </span>
            ))}
          </div>
        )}
        {events.length === 0 ? (
          <EmptyState icon={Activity} title="No recent observability events — system is idle." />
        ) : (
          <ul className="divide-y divide-border/60 rounded-md border border-border/60">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                <span className="w-16 font-mono text-[11px] text-muted-foreground">{e.t}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase tracking-wider",
                    e.level === "error"
                      ? "border-red-500/40 bg-red-500/10 text-red-700"
                      : e.level === "warn"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                        : "border-border bg-secondary/40 text-muted-foreground",
                  )}
                >
                  {e.level}
                </Badge>
                <span className="font-mono text-[11px] text-muted-foreground">{e.source}</span>
                <span className="flex-1 text-foreground/90">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ====================== API & integrations ======================

function ApiIntegrations({ callbackUrl }: { callbackUrl: string }) {
  const snippet = [
    "curl -N -X POST http://localhost:3000/api/run-diligence \\",
    "  -H \"Content-Type: application/json\" \\",
    "  -d '{",
    "    \"question\": \"Is Apollo.io worth $99/mo for a 5-seat sales team?\",",
    "    \"budgetCapUsd\": 0.25,",
    "    \"policyProfile\": \"standard\",",
    `    \"callbackUrl\": \"${callbackUrl || "https://example.com/webhook"}\"`,
    "  }'",
  ].join("\n");

  const copy = async () => {
    try { await navigator.clipboard.writeText(snippet); } catch {}
  };

  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">API &amp; Integrations</span>
        <CardTitle className="font-serif-display text-xl font-semibold tracking-tight">ProofSpend for other agents</CardTitle>
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
            <FileText className="h-3.5 w-3.5" /> Copy
          </Button>
          <pre className="overflow-x-auto px-4 py-3 pr-20 font-mono text-[12px] leading-relaxed text-emerald-100">
            <code>{snippet}</code>
          </pre>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2">
            <code className="rounded bg-secondary/40 px-1.5 py-0.5 font-mono text-[12px] text-primary">POST /api/run-diligence</code>
            <span className="text-muted-foreground">SSE stream; ends with <code className="font-mono text-foreground">complete</code> event carrying the full run JSON.</span>
          </li>
          <li className="flex gap-2">
            <code className="rounded bg-secondary/40 px-1.5 py-0.5 font-mono text-[12px] text-primary">GET /api/health</code>
            <span className="text-muted-foreground">Reports payment mode, policy profile, and active LLM provider.</span>
          </li>
          <li className="flex gap-2">
            <code className="rounded bg-secondary/40 px-1.5 py-0.5 font-mono text-[12px] text-primary">callbackUrl</code>
            <span className="text-muted-foreground">Receives a POST with the final run JSON after completion.</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

// ====================== Main ======================

type DashboardTab = "run" | "compare" | "integrations" | "vault";

const PRODUCT_TABS: { id: DashboardTab; label: string; icon: typeof Search }[] = [
  { id: "run", label: "Run", icon: PlayCircle },
  { id: "compare", label: "Compare", icon: Layers },
  { id: "integrations", label: "Integrations", icon: Boxes },
  { id: "vault", label: "Proof Vault", icon: Vault },
];

function TopNav({
  tab,
  onTabChange,
  mode,
  isRunning,
}: {
  tab: DashboardTab;
  onTabChange: (t: DashboardTab) => void;
  mode: Mode;
  isRunning: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm"
          >
            <Receipt className="h-4 w-4" />
          </div>
          <span className="font-serif-display text-lg font-medium tracking-tight text-foreground">ProofSpend</span>
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:inline">
            · receipt-backed diligence
          </span>
        </div>
        <nav className="ml-2 hidden md:block" aria-label="Product sections">
          <Tabs value={tab} onValueChange={(v) => onTabChange(v as DashboardTab)}>
            <TabsList className="h-9 bg-secondary/40">
              {PRODUCT_TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs">
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ModeBadge mode={mode} running={isRunning} />
        </div>
      </div>
      <nav className="md:hidden border-t border-border/60 px-2 py-1.5" aria-label="Product sections (mobile)">
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as DashboardTab)}>
          <TabsList className="h-8 w-full justify-between bg-secondary/40">
            {PRODUCT_TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="flex-1 gap-1 text-[11px]">
                <t.icon className="h-3 w-3" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </nav>
    </header>
  );
}

function RunSubHeader({
  health,
  healthUnavailable,
  mode,
  activePolicyProfile,
  spentUsd,
  budgetCapUsd,
  paidCalls,
  isRunning,
  liveConfidence,
  memo,
}: {
  health: Health | null;
  healthUnavailable: boolean;
  mode: Mode;
  activePolicyProfile?: PolicyProfile | null;
  spentUsd: number;
  budgetCapUsd: number;
  paidCalls: number;
  isRunning: boolean;
  liveConfidence?: {
    confidence: number;
    proofScore: number;
    reason?: string;
  } | null;
  memo: Memo | null;
}) {
  const spentPct = budgetCapUsd > 0 ? Math.min(100, (spentUsd / budgetCapUsd) * 100) : 0;
  const overWarn = spentPct > 85;
  const headerConfidence = memo?.confidence ?? liveConfidence?.confidence ?? null;
  const headerProofScore = memo?.proofScore ?? liveConfidence?.proofScore ?? null;
  return (
    <div className="sticky top-[56px] z-20 border-b border-border/60 bg-background/85 backdrop-blur md:top-[60px]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Server className="h-3.5 w-3.5" /> System
        </div>
        {healthUnavailable || !health ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
            <AlertCircle className="h-3 w-3" /> Health unreachable
          </span>
        ) : (
          <>
            <SubPill label="Mode" value={mode === "mock" ? "Mock" : health.paymentConfigured === false ? "Live (not configured)" : "Live"} tone={mode === "mock" ? "mock" : health.paymentConfigured === false ? "warn" : "live"} />
            <SubPill label="LLM" value={health.llmProvider} />
            <SubPill label="Policy" value={activePolicyProfile ?? health.policyProfile} />
            <SubPill label="Ready" value={health.ready ? "yes" : "starting"} tone={health.ready ? "live" : "muted"} />
            {headerConfidence !== null && (
              <SubPill label="Confidence" value={`${headerConfidence}%`} tone="live" />
            )}
            {headerProofScore !== null && (
              <SubPill label="Proof" value={`${headerProofScore}`} tone="live" />
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden h-6 w-px bg-border/60 sm:block" aria-hidden />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Spend</span>
            <span className={cn("font-mono text-sm font-medium tabular-nums", overWarn ? "text-amber-700" : "text-foreground")}>
              ${spentUsd.toFixed(4)}
            </span>
            <span className="text-[11px] text-muted-foreground">/ ${budgetCapUsd.toFixed(2)}</span>
          </div>
          <div className="h-1 w-28 overflow-hidden rounded-full bg-secondary/60" aria-hidden>
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", overWarn ? "bg-amber-500" : "bg-primary")}
              style={{ width: `${spentPct}%` }}
            />
          </div>
          <span className="font-mono text-xs text-foreground">
            {paidCalls} <span className="text-muted-foreground">calls</span>
          </span>
          {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-label="Running" />}
        </div>
      </div>
    </div>
  );
}

function SubPill({ label, value, tone }: { label: string; value: string; tone?: "mock" | "live" | "warn" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
        tone === "mock" && "border-amber-500/40 bg-amber-50 text-amber-800",
        tone === "live" && "border-primary/30 bg-primary/10 text-primary",
        tone === "warn" && "border-amber-500/40 bg-amber-50 text-amber-900",
        tone === "muted" && "border-border bg-muted/60 text-muted-foreground",
        !tone && "border-border/70 bg-background/60 text-foreground/85",
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </span>
  );
}

function CompactHero({ onDemoRun, demoRunDisabled, onCustomRun }: { onDemoRun: () => void; demoRunDisabled: boolean; onCustomRun: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-border/70 bg-card px-6 py-6 shadow-sm sm:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Diligence as a service</div>
          <h1 className="font-serif-display text-3xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-4xl">
            Receipt-backed diligence for autonomous agents.
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A panel of agents pays for evidence and returns a memo where every claim links to a settled receipt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
          <Button onClick={onDemoRun} disabled={demoRunDisabled} className="h-10 gap-2 text-sm">
            <Rocket className="h-4 w-4" /> Run 60s demo
          </Button>
          <Button variant="outline" onClick={onCustomRun} className="h-10 gap-2 text-sm">
            <Sparkle className="h-4 w-4" /> Run custom question
          </Button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><KeyRound className="h-3 w-3 text-primary" /> x402 micropayments</span>
        <span className="inline-flex items-center gap-1.5"><FileCheck2 className="h-3 w-3 text-primary" /> Base receipts</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-primary" /> SafeSpend guardrails</span>
      </div>
    </section>
  );
}

function IdleState() {
  const steps = [
    { n: "01", label: "Scope", body: "Frame the question. Set a budget cap and a policy profile (standard or strict).", Icon: ShieldQuestion },
    { n: "02", label: "Pay for evidence", body: "Agents settle micropayments on Base for each search; SafeSpend blocks anything over cap.", Icon: Wallet },
    { n: "03", label: "Export proof", body: "Get a memo where every claim cites a settled receipt — JSON, Markdown, or share link.", Icon: FileCheck2 },
  ];
  return (
    <section className="rounded-xl border border-dashed border-border bg-secondary/15 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="font-serif-display mt-4 text-xl text-foreground">No active run</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Dispatch the demo or write your own diligence question — agents start paying for evidence within seconds.
      </p>
      <div className="mt-6 grid gap-3 text-left md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-lg border border-border/70 bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-muted-foreground">{s.n}</span>
              <s.Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-1 font-serif-display text-base text-foreground">{s.label}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RunProgressStepper({ events }: { events: TimelineEvent[] }) {
  const labels: Array<{ key: TimelineAgentKey; label: string }> = [
    { key: "market", label: "Market" },
    { key: "evidence", label: "Evidence" },
    { key: "counter", label: "Counter" },
    { key: "skeptic", label: "Skeptic" },
  ];

  const statusFor = (agent: TimelineAgentKey) => {
    const relevant = events.filter((event) => event.agent === agent);
    if (relevant.some((event) => event.type === "agent_completed" || event.type === "follow_up_completed")) return "complete";
    if (relevant.some((event) => event.type === "search_failed" || event.type === "policy_blocked")) return "blocked";
    if (relevant.some((event) => event.type === "agent_started" || event.type === "follow_up_started" || event.type === "payment_settled")) return "active";
    return "idle";
  };

  return (
    <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Run progress
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {labels.map(({ key, label }) => {
          const status = statusFor(key);
          return (
            <div
              key={key}
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                status === "complete" && "border-emerald-500/30 bg-emerald-500/10",
                status === "active" && "border-primary/30 bg-primary/10",
                status === "blocked" && "border-amber-500/30 bg-amber-500/10",
                status === "idle" && "border-border/70 bg-card/60",
              )}
            >
              <div className="font-medium text-foreground">{label}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MissionControl({
  timelineEvents,
  memo,
  isRunning,
  selectedRecordId,
  onSelectRecord,
  onQuestionChange,
  onBudgetChange,
  onRaiseConfidenceRun,
  runIdLabel,
  evidenceRows,
  parentRunId,
  continuationDepth,
  activeRunId,
  spentUsd,
}: {
  timelineEvents: TimelineEvent[];
  memo: Memo | null;
  isRunning: boolean;
  selectedRecordId: string | null;
  onSelectRecord: (id: string | null) => void;
  onQuestionChange: (value: string) => void;
  onBudgetChange: (value: number) => void;
  onRaiseConfidenceRun: (request: RaiseConfidenceRunRequest) => void;
  runIdLabel?: string;
  evidenceRows: EvidenceRow[];
  parentRunId?: string;
  continuationDepth?: number;
  activeRunId?: string;
  spentUsd: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-10">
      <div className="order-1 lg:col-span-2 lg:order-none">
        <LiveTimeline events={timelineEvents} />
      </div>
      <div className="order-2 space-y-6 lg:col-span-3 lg:order-none">
        {timelineEvents.length > 0 && <RunProgressStepper events={timelineEvents} />}
        {memo ? (
          <Card className="border-transparent bg-card shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Decision panel
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">Click a claim to highlight its source record.</p>
              </div>
              {runIdLabel && <div className="font-mono text-[11px] text-muted-foreground">{runIdLabel}</div>}
            </CardHeader>
            <CardContent className="space-y-6">
              {(parentRunId || continuationDepth) && (
                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                  {continuationDepth ? `Continuation run #${continuationDepth}` : "Continuation run"}
                  {parentRunId ? ` from ${parentRunId}` : ""}
                </div>
              )}
              <VerdictBlock
                verdict={memo.verdict}
                confidence={memo.confidence}
                decisionLabel={memo.decisionLabel}
                questionRecap={memo.questionRecap}
              />
              <WhyVerdictPanel factors={memo.decisionFactors} confidenceCeiling={memo.confidenceCeiling} />
              <ConfidenceBreakdownPanel memo={memo} onSelectRecord={onSelectRecord} />
              <RaiseConfidenceCard
                memo={memo}
                onQuestionChange={onQuestionChange}
                onBudgetChange={onBudgetChange}
                onRunGap={onRaiseConfidenceRun}
                activeRunId={activeRunId}
                spentUsd={spentUsd}
              />
              <Separator />
              <section>
                <h3 className="font-serif-display mb-2 text-lg font-medium tracking-tight text-foreground">Rationale</h3>
                <p className="text-sm leading-relaxed text-foreground/85">{memo.rationale}</p>
              </section>
              <Separator />
              <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                <MemoSection title="Strengths" items={memo.strengths} selected={selectedRecordId} onSelectRecord={onSelectRecord} />
                <MemoSection title="Concerns" items={memo.concerns} selected={selectedRecordId} onSelectRecord={onSelectRecord} />
                <div className="md:col-span-2">
                  <MemoSection title="Next steps" items={memo.nextSteps} selected={selectedRecordId} onSelectRecord={onSelectRecord} />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : isRunning ? (
          <Card className="border-transparent bg-card shadow-sm" aria-busy="true" aria-live="polite">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Decision panel</CardTitle>
              <p className="text-[11px] text-muted-foreground">Synthesizing memo from settled receipts…</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-6">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-48 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-10/12 animate-pulse rounded bg-muted" />
                <div className="h-3 w-7/12 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ) : null}
        {memo && evidenceRows.length > 0 && (
          <Card className="border-transparent bg-card/60 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Receipt className="h-4 w-4" /> Evidence snapshot
                <span className="ml-auto text-[10px] font-normal tracking-normal text-muted-foreground/70">first {Math.min(3, evidenceRows.length)} of {evidenceRows.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <ul className="divide-y divide-border/60">
                {evidenceRows.slice(0, 3).map((r) => (
                  <li
                    key={r.id}
                    onClick={() => onSelectRecord(selectedRecordId === r.id ? null : r.id)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-2 py-2.5 text-xs transition-colors hover:bg-secondary/40",
                      selectedRecordId === r.id && "bg-sky-500/10",
                    )}
                  >
                    <AgentDot agent={r.agent} />
                    <span className="flex-1 line-clamp-1 font-mono text-[11px] text-muted-foreground">{r.query}</span>
                    <span className="font-mono text-foreground">${r.cost.toFixed(4)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ReceiptChainStepper({ memo, evidenceRows }: { memo: Memo | null; evidenceRows: EvidenceRow[] }) {
  if (!memo) return null;
  const claimsCount = memo.strengths.length + memo.concerns.length + memo.nextSteps.length;
  const recordsCount = evidenceRows.length;
  const steps = [
    { label: "Claims", value: claimsCount, sub: "structured by agent" },
    { label: "Records", value: recordsCount, sub: "evidence ledger rows" },
    { label: "Receipts", value: recordsCount, sub: "settled on Base" },
  ];
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/20 p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Receipt chain</div>
      <div className="flex items-center gap-2 overflow-x-auto">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="rounded-md border border-border/60 bg-card px-3 py-2 text-center">
              <div className="font-serif-display text-xl text-foreground">{s.value}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{s.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/80">{s.sub}</div>
            </div>
            {i < steps.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareMatrix({
  current,
  compare,
  options,
  compareRunId,
  onCompareChange,
}: {
  current: VendorSummary | null;
  compare: VendorSummary | null;
  options: { id: string; label: string }[];
  compareRunId: string | null;
  onCompareChange: (id: string) => void;
}) {
  const hasEnough = !!current && options.length > 0 && !!compare;
  const compareNarrative =
    current && compare
      ? `${current.subject} ${current.proofScore >= compare.proofScore ? "leads" : "trails"} by ${Math.abs(current.proofScore - compare.proofScore)} Proof Score point${Math.abs(current.proofScore - compare.proofScore) === 1 ? "" : "s"} because ${current.topFactors[0] ?? "confidence drivers differ"}${compare.topFactors[0] ? `, while ${compare.subject} is shaped by ${compare.topFactors[0]}` : ""}.`
      : null;
  const rows: { label: string; render: (v: VendorSummary) => ReactNode; winner?: (a: VendorSummary, b: VendorSummary) => "a" | "b" | null }[] = [
    {
      label: "Recommendation",
      render: (v) => (
        <Badge variant="outline" className={cn("font-medium capitalize", verdictBadge[v.recommendation])}>
          {v.recommendation.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      label: "Confidence",
      render: (v) => <span className="font-serif-display text-2xl text-foreground">{v.confidence}%</span>,
      winner: (a, b) => (a.confidence === b.confidence ? null : a.confidence > b.confidence ? "a" : "b"),
    },
    {
      label: "Proof Score",
      render: (v) => <span className="font-serif-display text-2xl text-foreground">{v.proofScore}</span>,
      winner: (a, b) => (a.proofScore === b.proofScore ? null : a.proofScore > b.proofScore ? "a" : "b"),
    },
    {
      label: "Spend",
      render: (v) => <span className="font-mono text-base text-foreground">${v.spendUsd.toFixed(2)}</span>,
      winner: (a, b) => (a.spendUsd === b.spendUsd ? null : a.spendUsd < b.spendUsd ? "a" : "b"),
    },
    {
      label: "Evidence depth",
      render: (v) => <span className="font-mono text-base text-foreground">{v.records} <span className="text-xs text-muted-foreground">records</span></span>,
      winner: (a, b) => (a.records === b.records ? null : a.records > b.records ? "a" : "b"),
    },
    {
      label: "Top rationale",
      render: (v) => <p className="line-clamp-3 text-sm leading-relaxed text-foreground/85">{v.rationale}</p>,
    },
  ];
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Compare vendors</div>
            <CardTitle className="font-serif-display mt-1 text-2xl font-medium tracking-tight">Vendor decision matrix</CardTitle>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Side-by-side recommendation, confidence, spend, and evidence depth. Winners are highlighted in teal.
            </p>
            {compareNarrative ? (
              <p className="mt-2 max-w-2xl text-sm text-foreground/85">{compareNarrative}</p>
            ) : null}
          </div>
          {current && options.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="cmp" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Compare against</label>
              <Select value={compareRunId ?? undefined} onValueChange={onCompareChange}>
                <SelectTrigger id="cmp" className="h-9 w-[240px] border-border/80 bg-background/60">
                  <SelectValue placeholder="Pick a run" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasEnough ? (
          <div className="rounded-md border border-dashed border-border bg-secondary/20 px-4 py-10 text-center text-sm text-muted-foreground">
            Save at least two runs to unlock side-by-side compare.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[160px] text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Criterion</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-serif-display text-lg normal-case tracking-tight text-foreground">{current!.subject}</span>
                      <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", current!.mode === "mock" ? "border-amber-500/40 bg-amber-500/10 text-amber-700" : "border-primary/40 bg-primary/10 text-primary")}>{current!.mode}</Badge>
                    </div>
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-serif-display text-lg normal-case tracking-tight text-foreground">{compare!.subject}</span>
                      <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", compare!.mode === "mock" ? "border-amber-500/40 bg-amber-500/10 text-amber-700" : "border-primary/40 bg-primary/10 text-primary")}>{compare!.mode}</Badge>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const winner = row.winner ? row.winner(current!, compare!) : null;
                  return (
                    <TableRow key={row.label} className="border-border/50 align-top">
                      <TableCell className="py-4 align-middle text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{row.label}</TableCell>
                      <TableCell className={cn("py-4", winner === "a" && "bg-primary/[0.05]")}>{row.render(current!)}</TableCell>
                      <TableCell className={cn("py-4", winner === "b" && "bg-primary/[0.05]")}>{row.render(compare!)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationsHub({
  callbackUrl,
  apiAuthRequired,
  apiKey,
  onApiKeyChange,
}: {
  callbackUrl: string;
  apiAuthRequired?: boolean;
  apiKey?: string;
  onApiKeyChange?: (value: string) => void;
}) {
  const tiles = [
    { Icon: Radio, title: "SSE streaming", body: "Subscribe to live timeline events and the final memo over a single HTTP/2 stream.", code: "Accept: text/event-stream" },
    { Icon: RefreshCw, title: "REST + JSON", body: "Conventional request/response for run dispatch, history, and health probes.", code: "Content-Type: application/json" },
    { Icon: Webhook, title: "HMAC webhooks", body: "Signed POST callback after each run completes — verify with X-ProofSpend-Signature.", code: "X-ProofSpend-Signature: hmac-sha256" },
    { Icon: Boxes, title: "MCP tools", body: "Expose run-diligence as an MCP tool so Claude, Cursor, and other clients can call it directly.", code: "mcp://proofspend/run-diligence" },
  ];
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Productized API</div>
        <CardTitle className="font-serif-display text-2xl font-medium tracking-tight">Built for other agents to call.</CardTitle>
        <p className="text-sm text-muted-foreground">SSE for human dashboards, REST for backends, MCP for IDE clients, signed webhooks for downstream pipelines.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {tiles.map((t) => (
            <div key={t.title} className="rounded-lg border border-border/70 bg-secondary/20 p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                  <t.Icon className="h-3.5 w-3.5" />
                </span>
                <h4 className="font-serif-display text-base font-medium text-foreground">{t.title}</h4>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t.body}</p>
              <code className="mt-2 inline-block rounded bg-card/80 px-1.5 py-0.5 font-mono text-[10px] text-primary">{t.code}</code>
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-md border border-primary/30 bg-primary/[0.05] px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="text-foreground/90">
              <span className="font-medium">Bearer auth.</span>{" "}
              {apiAuthRequired
                ? "This server requires an API key on protected routes."
                : "Optional on this server — required when PROOFSPEND_API_KEY is configured."}
            </span>
            <Button variant="outline" size="sm" className="ml-auto h-8 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> GET /api/openapi
            </Button>
          </div>
          {onApiKeyChange ? (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <label htmlFor="proofspend-api-key" className="text-xs font-medium text-muted-foreground">
                Dashboard API key
              </label>
              <Input
                id="proofspend-api-key"
                type="password"
                value={apiKey ?? ""}
                onChange={(event) => onApiKeyChange(event.target.value)}
                placeholder="Bearer token for protected API routes"
                className="h-9 max-w-md border-border/80 bg-background/60 font-mono text-xs"
              />
            </div>
          ) : null}
        </div>
        <ApiIntegrations callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}

function AttestationChip({ snapshotSigned, compact = false }: { snapshotSigned: boolean; compact?: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 uppercase tracking-wider",
        compact ? "text-[10px] px-1.5 py-0" : "text-[10px]",
        snapshotSigned
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-muted/60 text-muted-foreground",
      )}
      title={snapshotSigned ? "Ed25519-signed canonical JSON snapshot" : "SHA-256 digest only — no signing key configured"}
    >
      {snapshotSigned ? <Lock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
      {snapshotSigned ? "Signed snapshot" : "Digest-only"}
    </Badge>
  );
}

function ProofScore({
  score,
  confidence,
  coverage,
  runCompleteness,
  recordCount,
}: {
  score: number;
  confidence: number;
  coverage: number;
  runCompleteness: number;
  recordCount: number;
}) {
  const tone = score >= 75 ? "text-emerald-600 dark:text-emerald-400" : score >= 55 ? "text-primary" : "text-amber-600 dark:text-amber-400";
  const ringPct = Math.max(0, Math.min(100, score));
  return (
    <Card className="border-border/70 bg-card">
      <CardContent className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center gap-5">
          <div
            className="relative h-28 w-28 shrink-0 rounded-full"
            style={{ background: `conic-gradient(currentColor ${ringPct}%, hsl(var(--muted)) ${ringPct}% 100%)` }}
            aria-label={`Proof Score ${score} out of 100`}
          >
            <div className={cn("absolute inset-0", tone)} style={{ background: "transparent" }} />
            <div className="absolute inset-[6px] flex flex-col items-center justify-center rounded-full bg-card">
              <span className={cn("font-serif-display text-3xl leading-none", tone)}>{score}</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Proof Score</div>
            <h3 className="font-serif-display mt-1 text-2xl font-medium tracking-tight text-foreground">Infrastructure-grade trust</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Every claim traceable to a settled receipt. Score blends deterministic confidence, citation coverage, and run completeness.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <ProofMetric label="Confidence" value={`${confidence}%`} sub="deterministic overall" />
          <ProofMetric label="Receipt coverage" value={`${coverage}%`} sub={`${recordCount} record${recordCount === 1 ? "" : "s"} on chain`} />
          <ProofMetric label="Run completeness" value={`${runCompleteness}%`} sub="core agents completed" />
        </div>
      </CardContent>
    </Card>
  );
}

function ProofMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-secondary/30 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="font-serif-display mt-0.5 text-2xl text-foreground">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground/85">{sub}</div>
    </div>
  );
}

function VerifyProofPanel() {
  const [payload, setPayload] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<null | {
    verified: boolean;
    message: string;
    signingMode?: string;
    digestMatch?: boolean;
    signatureMatch?: boolean | null;
  }>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function submitVerification(jsonText: string) {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setResult({
        verified: false,
        message: "Paste a proof packet, snapshot, or run payload first.",
      });
      return;
    }

    setIsVerifying(true);
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const body =
        typeof parsed.snapshot === "string" || "proofPacket" in parsed || "run" in parsed
          ? parsed
          : { proofPacket: parsed };

      const response = await fetch("/api/verify-proof", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setResult(
        (await response.json()) as {
          verified: boolean;
          message: string;
          signingMode?: string;
          digestMatch?: boolean;
          signatureMatch?: boolean | null;
        },
      );
    } catch (error) {
      setResult({
        verified: false,
        message:
          error instanceof Error ? error.message : "Verification failed.",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Verify proof</div>
        <CardTitle className="font-serif-display text-2xl font-medium tracking-tight">Independently verify any proof packet.</CardTitle>
        <p className="text-sm text-muted-foreground">
          Drop a <code className="font-mono text-[12px] text-primary">.json</code> packet or paste it inline. We re-derive the SHA-256 digest, check the signature against the project's Ed25519 public key, and confirm every cited receipt resolves on Base. Endpoint: <code className="font-mono text-[12px] text-primary">POST /api/verify-proof</code>.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop a proof packet to verify"
          className="group flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/20 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
          onClick={() => inputRef.current?.click()}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
            <UploadCloud className="h-5 w-5" />
          </span>
          <div className="text-sm font-medium text-foreground">Drop proof packet</div>
          <div className="text-xs text-muted-foreground">JSON only · max 2 MB · processed in-browser, never uploaded raw</div>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              setPayload(text);
              await submitVerification(text);
            }}
          />
          <Button variant="outline" size="sm" className="mt-1 h-8 gap-1.5 text-xs"><FileJson className="h-3.5 w-3.5" /> Choose file</Button>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="paste-proof" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Or paste JSON</label>
          <Textarea
            id="paste-proof"
            placeholder='{"runId":"run_956","memo":{...},"records":[...],"signature":"ed25519:..."}'
            className="min-h-[120px] resize-none border-border/80 bg-background/60 font-mono text-xs leading-relaxed"
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => void submitVerification(payload)}
              disabled={isVerifying}
            >
              {isVerifying ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying</> : <><ShieldCheck className="h-3.5 w-3.5" /> Verify proof</>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-xs text-muted-foreground"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  setPayload(text);
                } catch {
                  // noop
                }
              }}
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste from clipboard
            </Button>
            <span className="ml-auto text-[10px] text-muted-foreground">no network call until you click verify</span>
          </div>
          {result && (
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                result.verified
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                  : "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200",
              )}
            >
              <div className="font-medium">{result.verified ? "Verification passed" : "Verification failed"}</div>
              <div className="mt-1 text-xs">{result.message}</div>
              {(result.signingMode || result.digestMatch !== undefined) && (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em]">
                  {result.signingMode ? <span>mode {result.signingMode}</span> : null}
                  {result.digestMatch !== undefined ? <span>digest {result.digestMatch ? "match" : "mismatch"}</span> : null}
                  {result.signatureMatch !== undefined && result.signatureMatch !== null ? <span>signature {result.signatureMatch ? "match" : "mismatch"}</span> : null}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProofVault({
  rows,
  selectedRunId,
  onSelect,
  onClear,
  memo,
  evidenceRows,
  showExport,
  onShareLink,
  onExportJson,
  onExportMarkdown,
  snapshotSigned,
  safeSpendRows,
  currentVendor,
}: {
  rows: HistoryRow[];
  selectedRunId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  memo: Memo | null;
  evidenceRows: EvidenceRow[];
  showExport: boolean;
  onShareLink: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  snapshotSigned: boolean;
  safeSpendRows: SafeSpendEvent[];
  currentVendor: VendorSummary | null;
}) {
  const latest = rows[0] ?? null;
  const confidence = memo?.confidence ?? currentVendor?.confidence ?? 0;
  const proofScore = memo?.proofScore ?? currentVendor?.proofScore ?? 0;
  const coverage = memo ? Math.round(memo.proofScoreComponents.citationCoverage * 100) : 0;
  const runCompleteness = memo ? Math.round(memo.proofScoreComponents.runCompleteness * 100) : 0;
  return (
    <div className="space-y-6">
      <ProofScore
        score={proofScore}
        confidence={confidence}
        coverage={coverage}
        runCompleteness={runCompleteness}
        recordCount={evidenceRows.length}
      />
      {latest && (
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Latest proof packet</div>
                <CardTitle className="font-serif-display mt-1 text-2xl font-medium tracking-tight">{latest.subject}</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{latest.at} · {latest.policy} · cap ${latest.budget.toFixed(2)}</p>
                <p className="mt-1.5 max-w-xl text-xs text-muted-foreground/90">Every claim traceable to a settled receipt.</p>
              </div>
              <AttestationChip snapshotSigned={snapshotSigned} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReceiptChainStepper memo={memo} evidenceRows={evidenceRows} />
            {showExport && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={onExportJson} size="sm" className="h-9 gap-1.5 text-xs"><FileJson className="h-3.5 w-3.5" /> Export JSON</Button>
                  <AttestationChip snapshotSigned={snapshotSigned} compact />
                  <Button variant="outline" size="sm" onClick={onExportMarkdown} className="h-9 gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Export Markdown</Button>
                  <AttestationChip snapshotSigned={snapshotSigned} compact />
                  <Button variant="outline" size="sm" onClick={onShareLink} className="h-9 gap-1.5 text-xs ml-auto"><Link2 className="h-3.5 w-3.5" /> Copy share link</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Each export is stamped with its attestation level. Signed snapshots include an Ed25519 signature over the canonical JSON; digest-only proofs ship a SHA-256 digest you can re-derive.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <VerifyProofPanel />
      <RunHistory rows={rows} selectedRunId={selectedRunId} onSelect={onSelect} onClear={onClear} />
    </div>
  );
}

function MockWatermark() {
  return (
    <div className="border-b border-amber-500/30 bg-amber-50/80 px-4 py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-amber-800">
      Mock mode — simulated receipts; no on-chain Base payments are made.
    </div>
  );
}

function NewDiligencePanel({
  open,
  onOpenChange,
  question,
  onQuestionChange,
  budgetCapUsd,
  onBudgetChange,
  policyProfile,
  onPolicyChange,
  callbackUrl,
  onCallbackUrlChange,
  exampleQuestions,
  onDemoRun,
  demoRunDisabled,
  isRunning,
  onRun,
  onCancelRun,
  error,
  estimate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  question: string;
  onQuestionChange: (v: string) => void;
  budgetCapUsd: number;
  onBudgetChange: (v: number) => void;
  policyProfile: PolicyProfile;
  onPolicyChange: (v: PolicyProfile) => void;
  callbackUrl: string;
  onCallbackUrlChange: (v: string) => void;
  exampleQuestions: { short: string; full: string }[];
  onDemoRun: () => void;
  demoRunDisabled: boolean;
  isRunning: boolean;
  onRun: () => void;
  onCancelRun: () => void;
  error: string | null;
  estimate: Estimate;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card className="border-border/70 bg-card">
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={open}
            >
              <div>
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">New diligence</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Question, budget, policy, and webhook callback.</p>
              </div>
              <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-5 pt-2">
            <div className="space-y-2">
              <label htmlFor="q" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Diligence question</label>
              <Textarea
                id="q"
                value={question}
                onChange={(e) => onQuestionChange(e.target.value)}
                placeholder="Should I spend $500/month on Apollo.io for B2B lead generation?"
                className="min-h-[88px] resize-none border-border/80 bg-background/60 text-base leading-relaxed"
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Try</span>
                {exampleQuestions.map((ex) => (
                  <button
                    key={ex.short}
                    type="button"
                    onClick={() => onQuestionChange(ex.full)}
                    className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-foreground/80 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                  >
                    {ex.short}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="b" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Budget cap (USD)</label>
                <Input id="b" type="number" step="0.01" min="0" value={budgetCapUsd} onChange={(e) => onBudgetChange(parseFloat(e.target.value) || 0)} className="border-border/80 bg-background/60 font-mono" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Policy profile</label>
                <div role="radiogroup" aria-label="Policy profile" className="inline-flex rounded-md border border-border/80 bg-background/60 p-0.5">
                  {(["standard", "strict"] as PolicyProfile[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={policyProfile === p}
                      onClick={() => onPolicyChange(p)}
                      className={cn("rounded px-3 py-1.5 text-xs font-medium capitalize tracking-wide transition-colors", policyProfile === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >{p}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="cb" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Webhook callback (optional)</label>
                <Input id="cb" type="url" value={callbackUrl} onChange={(e) => onCallbackUrlChange(e.target.value)} placeholder="https://example.com/webhook" className="border-border/80 bg-background/60 font-mono text-xs" />
              </div>
            </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Pre-run estimate · ~{estimate.estimatedBaselineCalls}–{estimate.estimatedMaxCalls} paid searches at ${estimate.estimatedPaidCallCostUsd.toFixed(4)} each · up to ${(estimate.estimatedPaidCallCostUsd * estimate.estimatedMaxCalls).toFixed(2)} before analyst
                </span>
                {estimate.estimatedConfidenceRange ? (
                  <span>
                    expected confidence ~{estimate.estimatedConfidenceRange.baselineMin}%–{estimate.estimatedConfidenceRange.baselineMax}% · up to {estimate.estimatedConfidenceRange.upperBoundWithSkeptic}% with skeptic
                  </span>
                ) : null}
                <span className="font-mono">cap ${budgetCapUsd.toFixed(2)}</span>
              </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1">
                <Button variant="outline" onClick={onDemoRun} disabled={demoRunDisabled} className="h-10 gap-2 text-sm">
                  <Rocket className="h-4 w-4" /> Demo run
                </Button>
                {demoRunDisabled && <span className="text-[11px] text-muted-foreground">Demo run requires mock mode</span>}
              </div>
              <Button onClick={onRun} disabled={isRunning} className="h-10 px-6 text-sm font-medium tracking-wide sm:ml-auto">
                {isRunning ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Dispatching agents…</>) : (<><Play className="mr-1.5 h-4 w-4" /> Run diligence</>)}
              </Button>
              {isRunning ? (
                <Button variant="outline" onClick={onCancelRun} className="h-10 px-4 text-sm font-medium tracking-wide">
                  Cancel run
                </Button>
              ) : null}
            </div>
            {error && (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function ProofSpendDashboard(props: ProofSpendDashboardProps) {
  const {
    question, onQuestionChange,
    budgetCapUsd, onBudgetChange,
    policyProfile, onPolicyChange,
    callbackUrl, onCallbackUrlChange,
    exampleQuestions,
    onDemoRun, demoRunDisabled,
    isRunning, onRun, onCancelRun, error,
    mode, activePolicyProfile, spentUsd, paidCalls,
    timelineEvents, evidenceRows, memo, safeSpendRows,
    historyRows, selectedRunId, onSelectHistory, onClearHistory,
    currentVendor, compareVendor, compareOptions, compareRunId, onCompareRunChange,
    selectedRecordId, onSelectRecord,
    showExport, onShareLink, onExportJson, onExportMarkdown,
    health, healthUnavailable, estimate,
    schedules, onCreateSchedule, onDeleteSchedule, onToggleSchedule, onRunScheduleNow,
    webhookEvents = [], onRetryWebhook,
    observabilityEvents, failureSummary,
    runIdLabel,
    liveConfidence,
    onRaiseConfidenceRun,
    apiKey,
    onApiKeyChange,
    demoMode = false,
    demoBannerText = "Demo mode — simulated x402 receipts",
    justCompleted = false,
    onReplayDemo,
  } = props;

  useEffect(() => {
    if (!selectedRecordId || typeof document === "undefined") return;
    const el =
      document.getElementById(`record-${selectedRecordId}`) ||
      document.getElementById(`record-m-${selectedRecordId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedRecordId]);

  const [tab, setTab] = useState<DashboardTab>("run");
  const [runPanelOpen, setRunPanelOpen] = useState(false);
  const hasActiveRun = !!memo || isRunning;
  const snapshotSigned = !!health?.snapshotSigningAvailable;

  return (
    <main className="min-h-screen bg-background pb-24 md:pb-10">
      {mode === "mock" && <MockWatermark />}
      <TopNav tab={tab} onTabChange={setTab} mode={mode} isRunning={isRunning} />

      {tab === "run" && (
        <>
          <RunSubHeader
            health={health}
            healthUnavailable={healthUnavailable}
            mode={mode}
            activePolicyProfile={activePolicyProfile}
            spentUsd={spentUsd}
            budgetCapUsd={budgetCapUsd}
            paidCalls={paidCalls}
            isRunning={isRunning}
            liveConfidence={liveConfidence}
            memo={memo}
          />
          <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 sm:px-6">
            {demoMode && (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 animate-fade-in"
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                  {demoBannerText}
                </span>
                {onReplayDemo && (
                  <button
                    type="button"
                    onClick={onReplayDemo}
                    className="text-xs font-medium underline-offset-4 hover:underline"
                  >
                    Replay demo
                  </button>
                )}
              </div>
            )}
            <CompactHero
              onDemoRun={onDemoRun}
              demoRunDisabled={demoRunDisabled}
              onCustomRun={() => setRunPanelOpen(true)}
            />
            <div
              className={cn(
                "transition-[filter,opacity] duration-300",
                demoMode && "pointer-events-none select-none blur-[2px] opacity-60",
              )}
              aria-hidden={demoMode || undefined}
            >
              <NewDiligencePanel
                open={runPanelOpen}
                onOpenChange={setRunPanelOpen}
                question={question}
                onQuestionChange={onQuestionChange}
                budgetCapUsd={budgetCapUsd}
                onBudgetChange={onBudgetChange}
                policyProfile={policyProfile}
                onPolicyChange={onPolicyChange}
                callbackUrl={callbackUrl}
                onCallbackUrlChange={onCallbackUrlChange}
                exampleQuestions={exampleQuestions}
                onDemoRun={onDemoRun}
                demoRunDisabled={demoRunDisabled}
                isRunning={isRunning}
                onRun={onRun}
                onCancelRun={onCancelRun}
                error={error}
                estimate={estimate}
              />
            </div>
            {hasActiveRun ? (
              <div
                key={justCompleted ? "completed" : "active"}
                className={cn(justCompleted && "animate-scale-in")}
              >
                {justCompleted && memo && (
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary animate-fade-in">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                    Proof packet ready
                  </div>
                )}
                <MissionControl
                timelineEvents={timelineEvents}
                memo={memo}
                isRunning={isRunning}
                selectedRecordId={selectedRecordId}
                onSelectRecord={onSelectRecord}
                onQuestionChange={onQuestionChange}
                onBudgetChange={onBudgetChange}
                onRaiseConfidenceRun={onRaiseConfidenceRun}
                runIdLabel={runIdLabel}
                evidenceRows={evidenceRows}
                parentRunId={currentVendor?.parentRunId}
                continuationDepth={currentVendor?.continuationDepth}
                activeRunId={currentVendor?.id}
                spentUsd={spentUsd}
                />
              </div>
            ) : (
              <IdleState />
            )}
            {hasActiveRun && <SafeSpendPanel events={safeSpendRows} />}
            {evidenceRows.length > 0 && (
              <EvidenceLedger rows={evidenceRows} selected={selectedRecordId} onSelect={onSelectRecord} />
            )}
          </div>
        </>
      )}

      {tab === "compare" && (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 sm:px-6">
          <CompareMatrix
            current={currentVendor}
            compare={compareVendor}
            options={compareOptions}
            compareRunId={compareRunId}
            onCompareChange={onCompareRunChange}
          />
          <RunHistory rows={historyRows} selectedRunId={selectedRunId} onSelect={onSelectHistory} onClear={onClearHistory} />
        </div>
      )}

      {tab === "integrations" && (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 sm:px-6">
          <IntegrationsHub
            callbackUrl={callbackUrl}
            apiAuthRequired={health?.apiAuthRequired}
            apiKey={apiKey}
            onApiKeyChange={onApiKeyChange}
          />
          <WebhookConsole events={webhookEvents} onRetry={onRetryWebhook} />
          <SchedulesConsole
            schedules={schedules}
            onCreate={onCreateSchedule}
            onDelete={onDeleteSchedule}
            onToggle={onToggleSchedule}
            onRunNow={onRunScheduleNow}
          />
          <ObservabilityConsole events={observabilityEvents} failureSummary={failureSummary} />
        </div>
      )}

      {tab === "vault" && (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 sm:px-6">
          <ProofVault
            rows={historyRows}
            selectedRunId={selectedRunId}
            onSelect={onSelectHistory}
            onClear={onClearHistory}
            memo={memo}
            evidenceRows={evidenceRows}
            showExport={showExport}
            onShareLink={onShareLink}
            onExportJson={onExportJson}
            onExportMarkdown={onExportMarkdown}
            snapshotSigned={snapshotSigned}
            safeSpendRows={safeSpendRows}
            currentVendor={currentVendor}
          />
        </div>
      )}

      <footer className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-2 text-center text-[11px] text-muted-foreground sm:px-6">
        ProofSpend · x402 micropayments on Base · every claim has a receipt
      </footer>

      {tab === "run" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden">
          <Button onClick={onRun} disabled={isRunning} aria-label="Run diligence" className="h-11 w-full text-sm font-semibold tracking-wide">
            {isRunning ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Dispatching agents…</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> Run diligence</>
            )}
          </Button>
        </div>
      )}
    </main>
  );
}
