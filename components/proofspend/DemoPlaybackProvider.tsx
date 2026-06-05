"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Memo, TimelineEvent } from "./Dashboard";

/**
 * Preview-only orchestration for the "Run 60s demo" stage moment.
 *
 * The production dashboard is strictly props-driven and contains no
 * setTimeout-based business logic. This hook lives outside the dashboard
 * and stages a short, scripted timeline (6–8 events over ~4s) before
 * revealing the final memo. It exists purely so the preview / marketing
 * surface can showcase the end-to-end product without a real backend.
 */
export interface DemoPlaybackState {
  demoMode: boolean;
  isRunning: boolean;
  justCompleted: boolean;
  timelineEvents: TimelineEvent[];
  memo: Memo | null;
  start: () => void;
  replay: () => void;
  reset: () => void;
}

export interface DemoPlaybackInput {
  fullTimeline: TimelineEvent[];
  fullMemo: Memo;
  /** Total duration of the staged reveal in ms. Defaults to 4000. */
  durationMs?: number;
  /** How long the "Proof packet ready" pulse stays elevated. Defaults to 1800. */
  completionFlashMs?: number;
}

export function useDemoPlayback({
  fullTimeline,
  fullMemo,
  durationMs = 4000,
  completionFlashMs = 1800,
}: DemoPlaybackInput): DemoPlaybackState {
  const [demoMode, setDemoMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [memo, setMemo] = useState<Memo | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setDemoMode(true);
    setIsRunning(true);
    setJustCompleted(false);
    setMemo(null);
    setRevealedCount(1);

    // Stage between 6 and 8 events evenly across durationMs.
    const sliceCount = Math.max(6, Math.min(8, fullTimeline.length));
    const step = durationMs / sliceCount;
    for (let i = 2; i <= sliceCount; i++) {
      timers.current.push(
        setTimeout(() => setRevealedCount(i), step * (i - 1)),
      );
    }
    // Complete: reveal the full timeline + memo, flash success, then settle.
    timers.current.push(
      setTimeout(() => {
        setRevealedCount(fullTimeline.length);
        setMemo(fullMemo);
        setIsRunning(false);
        setJustCompleted(true);
      }, durationMs),
    );
    timers.current.push(
      setTimeout(() => setJustCompleted(false), durationMs + completionFlashMs),
    );
  }, [fullTimeline, fullMemo, durationMs, completionFlashMs, clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setDemoMode(false);
    setIsRunning(false);
    setJustCompleted(false);
    setRevealedCount(0);
    setMemo(null);
  }, [clearTimers]);

  const replay = useCallback(() => {
    reset();
    // Allow the dashboard to unmount the completed state before restarting.
    timers.current.push(setTimeout(() => start(), 80));
  }, [reset, start]);

  return {
    demoMode,
    isRunning,
    justCompleted,
    timelineEvents: demoMode ? fullTimeline.slice(0, revealedCount) : fullTimeline,
    memo: demoMode ? memo : null,
    start,
    replay,
    reset,
  };
}