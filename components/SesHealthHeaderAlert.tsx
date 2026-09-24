'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  SES_HEALTH_HREF,
  type SesHealthStatus,
} from '@/lib/ses-health';

type SesHealthResponse = {
  status: SesHealthStatus;
  title: string;
  bounceRate: number;
  complaintRate: number;
};

export default function SesHealthHeaderAlert() {
  const { user } = useAuth();
  const [health, setHealth] = useState<SesHealthResponse | null>(null);

  useEffect(() => {
    if (!user?.isSuperAdmin) return;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/aws-analytics/ses/health');
        if (!res.ok) return;
        const json = (await res.json()) as SesHealthResponse;
        if (!cancelled) setHealth(json);
      } catch {
        if (!cancelled) setHealth(null);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.isSuperAdmin]);

  if (!user?.isSuperAdmin || !health) return null;
  if (health.status === 'HEALTHY') return null;

  const isCritical = health.status === 'CRITICAL';
  const Icon = isCritical ? ShieldAlert : AlertTriangle;

  return (
    <Link
      href={SES_HEALTH_HREF}
      aria-label={`${health.title}. Open AWS SES analytics.`}
      className={cn(
        'flex min-w-0 max-w-2xl items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
        isCritical
          ? 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-950'
          : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-950'
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{health.title}</span>
      <span className="hidden shrink-0 tabular-nums sm:inline">
        Bounce {health.bounceRate.toFixed(2)}% · Complaint {health.complaintRate.toFixed(3)}%
      </span>
      <span className="ml-auto hidden shrink-0 sm:inline">View SES</span>
    </Link>
  );
}
