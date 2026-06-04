"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileJson,
  FileText,
  HelpCircle,
  History,
  Link2,
  Loader2,
  Play,
  Receipt,
  Rocket,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { HealthStatusResponse, PolicyProfile as AppPolicyProfile } from "@/lib/types";
import type { ObservabilityEvent, ScheduleTemplate, WebhookDeliveryStatus } from "@/lib/types";
import type {
  CompareVendor,
  EvidenceRow,
  HistoryRow as DashboardHistoryRow,
  MemoClaimView,
  MemoViewModel,
  SafeSpendRow,
  TimelineEvent as DashboardTimelineEvent,
} from "@/lib/dashboard-adapters";

type AgentKey = "market" | "evidence" | "counter";

export type ProofSpendDashboardProps = {
  question: string;
  onQuestionChange: (value: string) => void;
  budgetCapUsd: number;
  onBudgetChange: (value: number) => void;
  policyProfile: AppPolicyProfile;
  onPolicyChange: (value: AppPolicyProfile) => void;
  callbackUrl: string;
  onCallbackUrlChange: (value: string) => void;
  exampleQuestions: Array<{ short: string; full: string }>;
  onDemoRun: () => void;
  demoRunDisabled: boolean;
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
  onClearHistory: () => void;
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
  health: HealthStatusResponse | null;
  healthUnavailable: boolean;
  estimate: {
    estimatedPaidCallCostUsd: number;
    estimatedBaselineCalls: number;
    estimatedMaxCalls: number;
  };
  schedules: ScheduleTemplate[];
  onCreateSchedule: (intervalMinutes: number) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onToggleSchedule: (scheduleId: string, enabled: boolean) => void;
  onRunScheduleNow: (scheduleId: string) => void;
  onRetryWebhook: (deliveryId: string) => void;
  observabilityEvents: ObservabilityEvent[];
  failureSummary: string | null;
  runIdLabel?: string;
};

const AGENT_META: Record<AgentKey, { label: string; color: string }> = {
  market: { label: "Market", color: "bg-sky-500" },
  evidence: { label: "Evidence", color: "bg-emerald-500" },
  counter: { label: "Counter", color: "bg-amber-500" },
};

function ModeBadge({ mode, running }: { mode: ProofSpendDashboardProps["mode"]; running: boolean }) {
  const config = {
    live: {
      label: "Live x402",
      className: "border-primary/30 bg-primary/10 text-primary",
      dot: "bg-primary",
    },
    mock: {
      label: "Mock",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700",
      dot: "bg-amber-500",
    },
    waiting: {
      label: "Waiting",
      className: "border-border bg-secondary/60 text-muted-foreground",
      dot: "bg-muted-foreground",
    },
  }[mode];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
        config.className,
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          config.dot,
          running && "animate-pulse",
        )}
      />
      {config.label}
    </div>
  );
}

function StatusStrip({
  health,
  healthUnavailable,
}: {
  health: HealthStatusResponse | null;
  healthUnavailable: boolean;
}) {
  const items = health
    ? [
        {
          label: "Payments",
          value:
            health.paymentMode === "mock"
              ? "Mock ready"
              : health.liveConfigured
                ? "Live configured"
                : "Live wallet missing",
          tone:
            health.paymentMode === "mock" || health.liveConfigured
              ? "healthy"
              : "warning",
        },
        { label: "LLM", value: health.llmProvider, tone: "neutral" },
        { label: "Default policy", value: health.policyProfile, tone: "neutral" },
        {
          label: "Trust",
          value: health.snapshotSigningAvailable ? "Signed snapshots ready" : "Digest-only proofs",
          tone: health.snapshotSigningAvailable ? "healthy" : "neutral",
        },
        {
          label: "Ops",
          value: `up ${health.uptimeSeconds}s | run ${health.rateLimits.runDiligence.limit}/min`,
          tone: "neutral",
        },
        { label: "Readiness", value: health.readinessSummary, tone: "neutral" },
      ]
    : [
        {
          label: "System status",
          value: healthUnavailable ? "Status unavailable" : "Checking system status...",
          tone: healthUnavailable ? "warning" : "neutral",
        },
      ];

  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-secondary/20 p-3 md:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {item.label}
          </div>
          <div
            className={cn(
              "text-sm",
              item.tone === "healthy" && "text-emerald-700",
              item.tone === "warning" && "text-amber-700",
              item.tone === "neutral" && "text-foreground/85",
            )}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PreRunEstimate({
  estimate,
  policyProfile,
}: {
  estimate: ProofSpendDashboardProps["estimate"];
  policyProfile: AppPolicyProfile;
}) {
  const baseline = estimate.estimatedPaidCallCostUsd * estimate.estimatedBaselineCalls;
  const max = estimate.estimatedPaidCallCostUsd * estimate.estimatedMaxCalls;

  return (
    <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Pre-run estimate
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-foreground/90">
        <span className="font-mono">${estimate.estimatedPaidCallCostUsd.toFixed(2)}</span>
        <span className="text-muted-foreground">per paid call</span>
        <span className="text-border">|</span>
        <span className="font-mono">${baseline.toFixed(2)}-${max.toFixed(2)}</span>
        <span className="text-muted-foreground">
          for {estimate.estimatedBaselineCalls}-{estimate.estimatedMaxCalls} calls
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {policyProfile} policy selected. Estimate only; final spend depends on live policy decisions.
      </div>
    </div>
  );
}

function LiveTimeline({ events }: { events: DashboardTimelineEvent[] }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) {
      return;
    }
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
              No run yet. Start diligence to watch paid evidence collection unfold here.
            </p>
          </div>
        ) : (
          <div ref={viewportRef} className="max-h-[360px] overflow-y-auto px-6 py-5">
            <ol className="space-y-3">
              {events.map((event, index) => (
                <li
                  key={`${event.t}-${index}`}
                  className={cn(
                    "rounded-md border px-3 py-2.5",
                    event.type === "policy_blocked" || event.type === "run_error"
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-white/10 bg-white/[0.03]",
                  )}
                >
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
                    <span>{event.agent}</span>
                    <span className="text-white/25">|</span>
                    <span>{event.type}</span>
                    <span className="ml-auto font-mono text-white/35">{event.t}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/85">{event.text}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const stroke = 2 * Math.PI * 38;
  const offset = stroke * (1 - safeValue / 100);

  return (
    <div className="relative h-24 w-24">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="8" fill="none" className="text-border/70" />
        <circle
          cx="50"
          cy="50"
          r="38"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeDasharray={stroke}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-2xl font-semibold text-foreground">{safeValue}%</div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          confidence
        </div>
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
  const config = {
    buy: {
      label: "BUY",
      sub: "Recommended action",
      className: "bg-emerald-600 text-white ring-emerald-600/20",
      Icon: CheckCircle2,
    },
    do_not_buy: {
      label: "DO NOT BUY",
      sub: "Recommended action",
      className: "bg-red-600 text-white ring-red-600/20",
      Icon: XCircle,
    },
    need_more_evidence: {
      label: "NEED MORE EVIDENCE",
      sub: "Inconclusive - gather more signal",
      className: "bg-amber-500 text-white ring-amber-500/20",
      Icon: HelpCircle,
    },
  }[verdict];

  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Recommendation
        </div>
        <div className={cn("inline-flex items-center gap-3 rounded-full px-5 py-2.5 text-base font-semibold tracking-wider ring-8", config.className)}>
          <config.Icon className="h-5 w-5" />
          {config.label}
        </div>
        <div className="text-sm text-muted-foreground">{config.sub}</div>
      </div>
      <ConfidenceRing value={confidence} />
    </div>
  );
}

function ClaimCitations({
  claim,
  selectedRecordId,
  onSelect,
}: {
  claim: MemoClaimView;
  selectedRecordId: string | null;
  onSelect: (recordId: string) => void;
}) {
  if (claim.citations.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {claim.citations.map((citation) => {
        const active = selectedRecordId === citation.recordId;
        const shortReceipt =
          citation.paymentMode === "live"
            ? `${citation.receipt.slice(0, 8)}...`
            : "mock receipt";

        return (
          <button
            key={`${citation.recordId}-${citation.receipt}`}
            type="button"
            onClick={() => onSelect(citation.recordId)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              active
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", AGENT_META[citation.agent].color)} />
            <span>{AGENT_META[citation.agent].label}</span>
            <span className="text-border">|</span>
            <span className="font-mono">{shortReceipt}</span>
          </button>
        );
      })}
    </div>
  );
}

function MemoSection({
  title,
  items,
  selectedRecordId,
  onSelect,
}: {
  title: string;
  items: MemoClaimView[];
  selectedRecordId: string | null;
  onSelect: (recordId: string) => void;
}) {
  return (
    <section>
      <h3 className="mb-3 font-serif-display text-xl font-medium tracking-tight text-foreground">
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item, index) => {
          const isSelected =
            selectedRecordId !== null && item.recordIds.includes(selectedRecordId);
          return (
            <li key={`${title}-${index}`}>
              <div
                className={cn(
                  "rounded-md border border-l-2 px-4 py-3",
                  isSelected
                    ? "border-sky-500/60 border-l-sky-500 bg-sky-500/10"
                    : "border-border/70 border-l-primary bg-secondary/30",
                )}
              >
                <p className="text-sm leading-relaxed text-foreground/90">{item.text}</p>
                <ClaimCitations
                  claim={item}
                  selectedRecordId={selectedRecordId}
                  onSelect={onSelect}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReceiptCell({
  receipt,
  paymentMode,
}: {
  receipt: string;
  paymentMode: "mock" | "live";
}) {
  if (paymentMode === "live") {
    return (
      <a
        href={`https://basescan.org/tx/${receipt}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary hover:bg-primary/20"
      >
        {receipt.slice(0, 8)}...
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700">
      Simulated
    </Badge>
  );
}

function AgentBadge({ agent }: { agent: AgentKey }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", AGENT_META[agent].color)} />
      <span className="text-sm font-medium text-foreground">{AGENT_META[agent].label}</span>
    </span>
  );
}

function FindingCell({ row }: { row: EvidenceRow }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <p className={cn("text-sm leading-relaxed text-foreground/90", !open && "line-clamp-2")}>
        {row.finding}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {row.sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            {source.label}
          </a>
        ))}
        {row.finding.length > 120 ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="ml-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
          >
            {open ? "Show less" : "Show more"}
            <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
          </button>
        ) : null}
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
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);

  return (
    <Card id="evidence-records" className="border-border/70 bg-card scroll-mt-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Evidence records
            </CardTitle>
            <p className="mt-1.5 text-sm text-foreground/80">
              <span className="font-mono">{rows.length}</span> record{rows.length === 1 ? "" : "s"}
              <span className="mx-2 text-border">|</span>
              <span className="font-mono">${totalCost.toFixed(2)}</span> spent
            </p>
          </div>
          {selectedRecordId ? (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="self-start text-[11px] font-medium text-sky-700 hover:underline sm:self-auto"
            >
              Clear claim selection
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-2">
        {rows.length === 0 ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            No evidence records yet. If a run failed before evidence arrived, the timeline and error banner above will explain why.
          </div>
        ) : (
          <>
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
                    {rows.map((row, index) => (
                      <TableRow
                        key={row.id}
                        id={`record-${row.id}`}
                        onClick={() => onSelect(selectedRecordId === row.id ? null : row.id)}
                        className={cn(
                          "cursor-pointer border-border/50 align-top",
                          index % 2 === 1 && "bg-secondary/25",
                          selectedRecordId === row.id && "bg-sky-500/10 outline outline-2 -outline-offset-2 outline-sky-500/60",
                        )}
                      >
                        <TableCell className="py-4">
                          <AgentBadge agent={row.agent} />
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

            <ul className="space-y-3 px-3 pb-3 md:hidden">
              {rows.map((row, index) => (
                <li
                  key={row.id}
                  id={`record-m-${row.id}`}
                  onClick={() => onSelect(selectedRecordId === row.id ? null : row.id)}
                  className={cn(
                    "cursor-pointer rounded-md border border-border/70 p-3",
                    index % 2 === 1 ? "bg-secondary/30" : "bg-background/40",
                    selectedRecordId === row.id && "border-sky-500/60 bg-sky-500/10 ring-2 ring-sky-500/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <AgentBadge agent={row.agent} />
                    <span className="font-mono text-sm text-foreground">${row.cost.toFixed(4)}</span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">{row.query}</p>
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
          </>
        )}
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
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3">
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
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-start gap-4 rounded-md border border-border/60 p-3">
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
  onClearHistory,
}: {
  rows: DashboardHistoryRow[];
  selectedRunId: string | null;
  onReload: (row: DashboardHistoryRow) => void;
  onClearHistory: () => void;
}) {
  const verdictStyle = {
    buy: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30",
    do_not_buy: "bg-red-600/10 text-red-700 border-red-600/30",
    need_more_evidence: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  } as const;
  const [activeRunId, setActiveRunId] = useState<string | null>(
    selectedRunId ?? rows[0]?.id ?? null,
  );

  useEffect(() => {
    if (selectedRunId) {
      setActiveRunId(selectedRunId);
    }
  }, [selectedRunId]);

  return (
    <Card id="compare-runs" className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <History className="h-4 w-4" />
            Local run history
          </CardTitle>
          <span className="text-[10px] font-normal tracking-normal text-muted-foreground/70">
            stored in this browser
          </span>
          {rows.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearHistory}
              className="ml-auto h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear history
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Completed runs save in this browser.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRunId(row.id);
                    onReload(row);
                  }}
                  aria-pressed={activeRunId === row.id}
                  className={cn(
                    "group block w-full rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    activeRunId === row.id
                      ? "border-blue-600/60 bg-blue-600/5 ring-1 ring-blue-600/30"
                      : "border-border/70 bg-secondary/20 hover:border-primary/40 hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-serif-display text-lg leading-tight text-foreground">
                        {row.subject}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {row.policy} | cap ${row.budget.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          row.mode === "mock"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                            : "border-primary/40 bg-primary/10 text-primary",
                        )}
                      >
                        {row.mode}
                      </Badge>
                      {row.webhookStatus ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase tracking-wider",
                            row.webhookStatus === "delivered"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                              : row.webhookStatus === "failed"
                                ? "border-red-500/40 bg-red-500/10 text-red-700"
                                : "border-border/70 bg-background text-muted-foreground",
                          )}
                        >
                          webhook {row.webhookStatus}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {row.question}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3">
                    <Badge variant="outline" className={cn("font-medium capitalize", verdictStyle[row.recommendation])}>
                      {row.recommendation.replace(/_/g, " ")}
                    </Badge>
                    <div className="ml-auto flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-foreground">
                        <span className="text-muted-foreground">spend</span> ${row.spendUsd.toFixed(3)}
                      </span>
                      <span className="text-border">|</span>
                      <span className="text-foreground">
                        <span className="text-muted-foreground">calls</span> {row.paidCalls}
                      </span>
                      <span className="text-border">|</span>
                      <span className="text-foreground">
                        <span className="text-muted-foreground">records</span> {row.records}
                      </span>
                      <span className="text-border">|</span>
                      <span className="text-foreground">
                        <span className="text-muted-foreground">conf</span> {row.confidence}%
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
  onExportJson,
  onExportMarkdown,
  onShareLink,
  recordCount,
  spentUsd,
}: {
  onExportJson: () => void;
  onExportMarkdown: () => void;
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
        memo | {recordCount} records | ${spentUsd.toFixed(2)} spent
      </span>
      <div className="ml-auto flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void onShareLink();
          }}
          className="h-8 gap-1.5 text-xs"
        >
          <Link2 className="h-3.5 w-3.5" />
          Copy share link
        </Button>
        <Button variant="ghost" size="sm" onClick={onExportJson} className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10">
          <FileJson className="h-3.5 w-3.5" />
          JSON
        </Button>
        <Button variant="ghost" size="sm" onClick={onExportMarkdown} className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10">
          <FileText className="h-3.5 w-3.5" />
          Markdown
        </Button>
      </div>
    </div>
  );
}

function SafeSpendPanel({
  events,
  hasCompletedRun,
}: {
  events: SafeSpendRow[];
  hasCompletedRun: boolean;
}) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          SafeSpend policy decisions
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {events.length === 0 ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            {hasCompletedRun
              ? "No policy events were recorded for this run."
              : "Policy checks will appear here before and after paid searches run."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Event", "Agent", "Action", "Status", "Reason / preview", "Projected"].map((heading) => (
                    <TableHead key={heading} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {heading}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event, index) => {
                  const blocked = event.status === "blocked";
                  return (
                    <TableRow key={`${event.action}-${index}`} className={cn("border-border/50 align-top", blocked && "bg-red-500/[0.06]")}>
                      <TableCell className="py-3">
                        <span className="font-mono text-[11px] text-muted-foreground">{event.kind}</span>
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {event.agent === "system" ? (
                          <span className="text-muted-foreground">system</span>
                        ) : (
                          <AgentBadge agent={event.agent} />
                        )}
                      </TableCell>
                      <TableCell className="py-3 font-mono text-xs text-foreground/90">{event.action}</TableCell>
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
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className={cn("text-sm", blocked ? "text-red-900" : "text-foreground/90")}>
                          {event.reason}
                        </div>
                        {event.queryPreview ? (
                          <div className="mt-0.5 line-clamp-1 font-mono text-[11px] text-muted-foreground">
                            {event.queryPreview}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono text-sm">
                        ${event.projectedSpendUsd.toFixed(4)}
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
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Compare runs
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare recommendation, spend, and evidence depth.
            </p>
          </div>
          {hasEnough && compareOptions.length > 0 ? (
            <div className="flex items-center gap-2">
              <label htmlFor="compare-vendor" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Compare against
              </label>
              <Select value={compareRunId} onValueChange={onCompareRunChange}>
                <SelectTrigger
                  id="compare-vendor"
                  aria-label="Compare against saved run"
                  className="h-9 w-[240px] border-border/80 bg-background/60"
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
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {hasEnough ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[currentVendor, compareVendor].map((vendor) => (
              <div key={vendor!.id} className="rounded-lg border border-border/70 bg-secondary/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-serif-display text-lg text-foreground">{vendor?.subject}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {vendor?.mode} | {vendor?.policy}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {vendor?.recommendation.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md border border-border/60 bg-background/60 p-2">
                    <div className="font-mono text-lg text-foreground">{vendor?.confidence}%</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">confidence</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/60 p-2">
                    <div className="font-mono text-lg text-foreground">${vendor?.spendUsd.toFixed(2)}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">spend</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/60 p-2">
                    <div className="font-mono text-lg text-foreground">{vendor?.records}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">records</div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{vendor?.rationale}</p>
              </div>
            ))}
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

function ApiIntegrations() {
  const snippet = `curl -N -X POST http://localhost:3000/api/run-diligence \\
  -H "Authorization: Bearer <PROOFSPEND_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "Is Apollo.io worth $99/mo for a 5-seat sales team?",
    "budgetCapUsd": 0.25,
    "policyProfile": "standard",
    "callbackUrl": "https://example.com/webhook"
  }'`;
  const restSnippet = `curl -X POST "http://localhost:3000/api/run-diligence?stream=false" \\
    -H "Authorization: Bearer <PROOFSPEND_API_KEY>" \\
    -H "Content-Type: application/json" \\
  -d '{
    "question": "Is Apollo.io worth $99/mo for a 5-seat sales team?",
    "budgetCapUsd": 0.25,
      "policyProfile": "standard",
      "stream": false
    }'`;
  const verifySnippet = `curl -X POST http://localhost:3000/api/verify-proof \\
    -H "Content-Type: application/json" \\
    -d '{
      "proofPacket": {
        "metadata": {
          "attestation": {
            "formatVersion": 1,
            "canonicalizer": "proofspend.run.v1",
            "digestAlgorithm": "SHA-256",
            "digest": "<digest>",
            "signedAt": "<timestamp>",
            "signingMode": "digest-only"
          }
        },
        "run": { "...": "proof packet run payload" }
      }
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
    <Card id="api-integrations" className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          API &amp; Integrations
        </span>
        <CardTitle className="font-serif-display text-xl font-medium tracking-tight">
          ProofSpend for other agents
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Stream SSE in the UI, request final JSON in REST mode, or POST the final run JSON to a webhook when the memo is ready.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border/70 bg-secondary/20 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              SSE mode
            </div>
            <div className="mt-1 text-sm text-foreground/90">
              Default UI mode using streamed run events from <span className="font-mono">POST /api/run-diligence</span>.
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-secondary/20 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              REST mode
            </div>
            <div className="mt-1 text-sm text-foreground/90">
              Use <span className="font-mono">?stream=false</span> or body <span className="font-mono">{`"stream": false`}</span> to receive the final run JSON directly.
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-secondary/20 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Trust + Webhooks
            </div>
            <div className="mt-1 text-sm text-foreground/90">
              When <span className="font-mono">PROOFSPEND_API_KEY</span> is set, callers must send a bearer token. Snapshot links and proof packets now carry attestations, and callback delivery retries automatically with signature headers when a secret is configured.
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#18211b]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/50">curl example</div>
            <Button variant="ghost" size="sm" onClick={() => void copy()} className="h-7 text-xs text-white hover:bg-white/10 hover:text-white">
              Copy
            </Button>
          </div>
          <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-white/80">
            <code>{snippet}</code>
          </pre>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/70 bg-secondary/20">
          <div className="border-b border-border/70 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            REST response example
          </div>
          <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-foreground/80">
            <code>{restSnippet}</code>
          </pre>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/70 bg-secondary/20">
          <div className="border-b border-border/70 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Verification example
          </div>
          <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-foreground/80">
            <code>{verifySnippet}</code>
          </pre>
        </div>
        <div className="rounded-md border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
          Spec endpoint: <span className="font-mono">GET /api/openapi</span>. MCP endpoint: <span className="font-mono">POST /api/mcp</span>. Trust endpoints: <span className="font-mono">POST /api/sign-snapshot</span> and <span className="font-mono">POST /api/verify-proof</span>. Signed delivery headers: <span className="font-mono">X-ProofSpend-Timestamp</span> and, when <span className="font-mono">WEBHOOK_SECRET</span> is set, <span className="font-mono">X-ProofSpend-Signature</span>.
        </div>
        <div className="rounded-md border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
          Recent webhook outcomes flow into local history badges and <span className="font-mono">GET /api/health</span> diagnostics so you can confirm callback delivery without leaving the app.
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleConsole({
  schedules,
  onCreateSchedule,
  onDeleteSchedule,
  onToggleSchedule,
  onRunScheduleNow,
}: {
  schedules: ScheduleTemplate[];
  onCreateSchedule: (intervalMinutes: number) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onToggleSchedule: (scheduleId: string, enabled: boolean) => void;
  onRunScheduleNow: (scheduleId: string) => void;
}) {
  const [intervalMinutes, setIntervalMinutes] = useState(60);

  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Scheduled diligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Interval (minutes)
            </label>
            <Input
              type="number"
              min="5"
              step="5"
              value={intervalMinutes}
              onChange={(event) => setIntervalMinutes(Math.max(5, Number(event.target.value) || 5))}
              className="w-[180px]"
            />
          </div>
          <Button type="button" onClick={() => onCreateSchedule(intervalMinutes)}>
            Save current form as schedule
          </Button>
        </div>

        {schedules.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No schedules yet. Save the current diligence form to run it repeatedly in this server process.
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-lg border border-border/70 bg-secondary/20 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{schedule.label}</div>
                    <div className="text-xs text-muted-foreground">
                      every {schedule.intervalMinutes} min | next {new Date(schedule.nextRunAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{schedule.question}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={schedule.enabled ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-border/70 bg-background text-muted-foreground"}>
                      {schedule.enabled ? "enabled" : "paused"}
                    </Badge>
                    {schedule.lastStatus ? (
                      <Badge variant="outline" className={schedule.lastStatus === "success" ? "border-primary/40 bg-primary/10 text-primary" : "border-red-500/40 bg-red-500/10 text-red-700"}>
                        last {schedule.lastStatus}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => onRunScheduleNow(schedule.id)}>
                    Run now
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onToggleSchedule(schedule.id, !schedule.enabled)}>
                    {schedule.enabled ? "Pause" : "Enable"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSchedule(schedule.id)}>
                    Delete
                  </Button>
                </div>
                {schedule.lastError ? (
                  <div className="mt-2 text-xs text-red-700">{schedule.lastError}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WebhookConsole({
  deliveries,
  onRetryWebhook,
}: {
  deliveries: WebhookDeliveryStatus[];
  onRetryWebhook: (deliveryId: string) => void;
}) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Webhook delivery console
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {deliveries.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No webhook deliveries yet. Callback outcomes will appear here after runs with a callback URL.
          </div>
        ) : (
          deliveries.map((delivery) => (
            <div key={delivery.id} className="rounded-lg border border-border/70 bg-secondary/20 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="font-mono text-xs text-foreground">{delivery.callbackUrl}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(delivery.deliveredAt).toLocaleString()} | attempts {delivery.attempts}
                    {delivery.httpStatus ? ` | status ${delivery.httpStatus}` : ""}
                  </div>
                  {delivery.error ? <div className="text-xs text-red-700">{delivery.error}</div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={delivery.status === "delivered" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : delivery.status === "failed" ? "border-red-500/40 bg-red-500/10 text-red-700" : "border-border/70 bg-background text-muted-foreground"}>
                    {delivery.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => onRetryWebhook(delivery.id)}>
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ObservabilityConsole({ events }: { events: ObservabilityEvent[] }) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Observability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No observability events yet. Runs, schedules, webhook retries, proof verification, and MCP activity will appear here.
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="rounded-lg border border-border/70 bg-secondary/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {event.category}
                </div>
                <Badge variant="outline" className={event.status === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : event.status === "error" ? "border-red-500/40 bg-red-500/10 text-red-700" : "border-border/70 bg-background text-muted-foreground"}>
                  {event.status}
                </Badge>
              </div>
              <div className="mt-2 text-sm text-foreground">{event.message}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {new Date(event.timestamp).toLocaleString()}
              </div>
            </div>
          ))
        )}
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
  callbackUrl,
  onCallbackUrlChange,
  exampleQuestions,
  onDemoRun,
  demoRunDisabled,
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
  onClearHistory,
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
  health,
  healthUnavailable,
  estimate,
  schedules,
  onCreateSchedule,
  onDeleteSchedule,
  onToggleSchedule,
  onRunScheduleNow,
  onRetryWebhook,
  observabilityEvents,
  failureSummary,
  runIdLabel,
}: ProofSpendDashboardProps) {
  const spentPct = Math.min(100, budgetCapUsd > 0 ? (spentUsd / budgetCapUsd) * 100 : 0);
  const overWarn = spentPct > 85;
  const hasCompletedRun = showExport || timelineEvents.some((event) => event.type === "complete");

  const handleSelectClaim = (recordId: string) => {
    onSelectRecord(selectedRecordId === recordId ? null : recordId);
    if (typeof document !== "undefined") {
      const element =
        document.getElementById(`record-${recordId}`) ??
        document.getElementById(`record-m-${recordId}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-6">
        <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
          <CardContent className="space-y-8 p-8 sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                  ProofSpend
                </div>
                <h1 className="font-serif-display text-4xl font-medium leading-[1.1] text-foreground sm:text-5xl">
                  Receipt-backed research
                  <br />
                  for autonomous agents.
                </h1>
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Set a budget cap, dispatch paid search agents, and get a memo where every claim links back to evidence and a receipt.
                </p>
              </div>
              <ModeBadge mode={mode} running={isRunning} />
            </div>

            <StatusStrip health={health} healthUnavailable={healthUnavailable} />

            <Separator />

            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="q" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Diligence question
                </label>
                <Textarea
                  id="q"
                  value={question}
                  onChange={(event) => onQuestionChange(event.target.value)}
                  disabled={isRunning}
                  placeholder="Should I spend $500/month on Apollo.io for B2B lead generation?"
                  className="min-h-[96px] resize-none border-border/80 bg-background/60 text-base leading-relaxed"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Try
                  </span>
                  {exampleQuestions.map((example) => (
                    <button
                      key={example.short}
                      type="button"
                      onClick={() => onQuestionChange(example.full)}
                      disabled={isRunning}
                      className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-foreground/80 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                    >
                      {example.short}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[220px_220px_1fr]">
                <div className="space-y-2">
                  <label htmlFor="budget" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Budget cap (USD)
                  </label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    min="0"
                    value={budgetCapUsd}
                    onChange={(event) => onBudgetChange(parseFloat(event.target.value) || 0)}
                    disabled={isRunning}
                    className="border-border/80 bg-background/60 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Policy profile
                  </label>
                  <div role="radiogroup" aria-label="Policy profile" className="inline-flex rounded-md border border-border/80 bg-background/60 p-0.5">
                    {(["standard", "strict"] as AppPolicyProfile[]).map((profile) => (
                      <button
                        key={profile}
                        type="button"
                        role="radio"
                        aria-checked={policyProfile === profile}
                        onClick={() => onPolicyChange(profile)}
                        disabled={isRunning}
                        className={cn(
                          "rounded px-3 py-1.5 text-xs font-medium capitalize tracking-wide transition-colors",
                          policyProfile === profile
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {profile}
                      </button>
                    ))}
                  </div>
                </div>
                <PreRunEstimate estimate={estimate} policyProfile={policyProfile} />
              </div>

              <div className="space-y-2">
                <label htmlFor="callback-url" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Callback URL (optional)
                </label>
                <Input
                  id="callback-url"
                  type="url"
                  value={callbackUrl}
                  onChange={(event) => onCallbackUrlChange(event.target.value)}
                  disabled={isRunning}
                  placeholder="https://example.com/webhook"
                  className="border-border/80 bg-background/60"
                />
                <div className="text-xs text-muted-foreground">
                  When provided, ProofSpend posts the final run JSON after completion.
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  onClick={onRun}
                  disabled={isRunning}
                  aria-label="Run diligence"
                  className="h-10 px-6 text-sm font-medium tracking-wide"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Dispatching agents...
                    </>
                  ) : (
                    <>
                      <Play className="mr-1.5 h-4 w-4" />
                      Run diligence
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={onDemoRun}
                  disabled={isRunning || demoRunDisabled}
                  aria-label="Run demo diligence"
                  className="h-10 px-6 text-sm font-medium tracking-wide"
                >
                  <Rocket className="mr-1.5 h-4 w-4" />
                  Demo run
                </Button>
                {demoRunDisabled ? (
                  <span className="text-xs text-muted-foreground">
                    Demo run requires mock mode so it stays safe on stage.
                  </span>
                ) : null}
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {mode === "mock" ? (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900">
            <ShieldAlert className="h-4 w-4 !text-amber-700" />
            <AlertDescription className="text-amber-900">
              Simulated receipts - mock mode; no on-chain Base payments were made.
            </AlertDescription>
          </Alert>
        ) : null}

        {failureSummary ? (
          <Alert className="border-red-500/30 bg-red-500/10 text-red-900">
            <AlertCircle className="h-4 w-4 !text-red-700" />
            <AlertDescription>{failureSummary}</AlertDescription>
          </Alert>
        ) : null}

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
                <Progress value={spentPct} className={cn("h-2", overWarn && "[&>div]:bg-amber-500")} />
                <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                  <span>{spentPct.toFixed(1)}% used</span>
                  <span>${Math.max(0, budgetCapUsd - spentUsd).toFixed(4)} remaining</span>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-3 text-center">
                {(Object.keys(AGENT_META) as AgentKey[]).map((agent) => {
                  const rows = evidenceRows.filter((row) => row.agent === agent);
                  const cost = rows.reduce((sum, row) => sum + row.cost, 0);

                  return (
                    <div key={agent} className="rounded-md border border-border/70 bg-secondary/30 p-2">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span className={cn("h-1.5 w-1.5 rounded-full", AGENT_META[agent].color)} />
                        {AGENT_META[agent].label}
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

        {isRunning ? (
          <MemoSkeleton />
        ) : memo ? (
          <Card className="border-border/70 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Diligence memo
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Click a receipt chip to jump to the linked evidence record.
                </p>
              </div>
              {runIdLabel ? (
                <div className="text-[11px] font-mono text-muted-foreground">{runIdLabel}</div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-8">
              <VerdictBlock verdict={memo.verdict} confidence={memo.confidence} />
              <Separator />
              <section>
                <h3 className="mb-3 font-serif-display text-xl font-medium tracking-tight text-foreground">
                  Rationale
                </h3>
                <p className="max-w-prose text-[15px] leading-relaxed text-foreground/85">
                  {memo.rationale.text}
                </p>
                <ClaimCitations
                  claim={memo.rationale}
                  selectedRecordId={selectedRecordId}
                  onSelect={handleSelectClaim}
                />
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
                Receipt proves payment occurred; the memo cites the records that informed each claim.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <SafeSpendPanel events={safeSpendRows} hasCompletedRun={hasCompletedRun} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ScheduleConsole
              schedules={schedules}
              onCreateSchedule={onCreateSchedule}
              onDeleteSchedule={onDeleteSchedule}
              onToggleSchedule={onToggleSchedule}
              onRunScheduleNow={onRunScheduleNow}
            />
          </div>
          <WebhookConsole
            deliveries={health?.recentWebhookDeliveries ?? []}
            onRetryWebhook={onRetryWebhook}
          />
        </div>

        <ObservabilityConsole events={observabilityEvents} />

        <RunHistory
          rows={historyRows}
          selectedRunId={selectedRunId}
          onReload={(row) => onSelectHistory(row.id)}
          onClearHistory={onClearHistory}
        />

        <VendorCompare
          currentVendor={currentVendor}
          compareVendor={compareVendor}
          compareOptions={compareOptions}
          compareRunId={compareRunId}
          onCompareRunChange={onCompareRunChange}
          historyCount={historyRows.length}
        />

        {showExport && !isRunning ? (
          <ProofPacketExport
            onExportJson={onExportJson}
            onExportMarkdown={onExportMarkdown}
            onShareLink={onShareLink}
            recordCount={evidenceRows.length}
            spentUsd={spentUsd}
          />
        ) : null}

        {isRunning ? (
          <LedgerSkeleton />
        ) : (
          <EvidenceLedger
            rows={evidenceRows}
            selectedRecordId={selectedRecordId}
            onSelect={onSelectRecord}
          />
        )}

        <ApiIntegrations />

        <footer className="pb-24 pt-4 text-center text-[11px] text-muted-foreground md:pb-2">
          ProofSpend | x402 micropayments on Base | every claim has a receipt
        </footer>
      </div>

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
              Dispatching agents...
            </>
          ) : (
            "Run diligence"
          )}
        </Button>
      </div>
    </main>
  );
}
