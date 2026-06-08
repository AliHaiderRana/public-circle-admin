'use client';

import { useCallback, useEffect, useState } from 'react';

export type SupportStats = {
  unreadChatMessages: number;
  openSupportRequests: number;
  unassignedTickets?: number;
};

const DEFAULT_STATS: SupportStats = {
  unreadChatMessages: 0,
  openSupportRequests: 0,
};

const STATS_KEY = '/api/support-stats';
const DEDUPE_MS = 10000;

let sharedStats: SupportStats = DEFAULT_STATS;
let sharedLoading = true;
let inflight: Promise<SupportStats> | null = null;
let lastFetchAt = 0;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

async function fetchSupportStats(force = false): Promise<SupportStats> {
  const now = Date.now();
  if (!force && inflight && now - lastFetchAt < DEDUPE_MS) {
    return inflight;
  }

  lastFetchAt = now;
  inflight = (async () => {
    try {
      const res = await fetch(STATS_KEY, { cache: 'no-store' });
      if (!res.ok) {
        return sharedStats;
      }
      const data = await res.json();
      sharedStats = {
        unreadChatMessages: data.unreadChatMessages ?? 0,
        openSupportRequests: data.openSupportRequests ?? 0,
        unassignedTickets: data.unassignedTickets ?? 0,
      };
      return sharedStats;
    } catch {
      return sharedStats;
    } finally {
      sharedLoading = false;
      notifyListeners();
      inflight = null;
    }
  })();

  return inflight;
}

export function useSupportStats(refreshIntervalMs = 30000) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    void fetchSupportStats(true);
    const interval = setInterval(() => {
      void fetchSupportStats();
    }, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [refreshIntervalMs]);

  const refresh = useCallback(async () => {
    await fetchSupportStats(true);
  }, []);

  return {
    stats: sharedStats,
    loading: sharedLoading,
    refresh,
  };
}
