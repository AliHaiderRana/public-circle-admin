'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildIntegrationDocs,
  getIntegrationCallerLabel,
  type IntegrationDocSection,
  type IntegrationDocsResponse,
  type IntegrationCaller,
  type HttpMethod,
} from '@/lib/integration-docs.catalog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Circle, BookOpen, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type IntegrationDocsPanelProps = {
  adminPortalUrl: string;
  serverBaseUrl: string;
  partnerEnabled: boolean;
  referralEnabled: boolean;
  partnerPortalSsoSecret: string;
  serverEnabled: boolean;
  internalApiKey: string;
};

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  PUT: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  WS: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
};

const CALLER_STYLES: Record<IntegrationCaller, string> = {
  'venndii-referral-app': 'border-pink-200 bg-pink-50 text-pink-900 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-200',
  'venndii-referral-be': 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
  'public-circle-admin': 'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200',
  'public-circle-server': 'border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200',
};

function ConfigChecklist({ section }: { section: IntegrationDocSection }) {
  const required = section.configRequirements.filter((item) => item.required);
  const ready = required.every((item) => item.configured);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={ready ? 'default' : 'secondary'}>
          {ready ? 'Ready' : 'Incomplete'}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {required.filter((item) => item.configured).length}/{required.length} required settings
        </span>
      </div>
      <ul className="space-y-2">
        {section.configRequirements.map((item) => (
          <li key={item.key} className="flex gap-2 text-sm">
            {item.configured ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <div>
              <span className={cn('font-medium', !item.configured && item.required && 'text-amber-700 dark:text-amber-400')}>
                {item.label}
                {item.required ? '' : ' (optional)'}
              </span>
              {item.hint ? (
                <p className="text-muted-foreground">{item.hint}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowList({ section }: { section: IntegrationDocSection }) {
  return (
    <ol className="space-y-3">
      {section.flow.map((step) => (
        <li key={step.step} className="flex gap-3 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {step.step}
          </span>
          <div>
            <p className="font-medium">
              {step.actor === 'partner-user' ? 'Partner user' : getIntegrationCallerLabel(step.actor)}
            </p>
            <p className="text-muted-foreground">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ApiCallList({ section }: { section: IntegrationDocSection }) {
  const grouped = useMemo(() => {
    const map = new Map<IntegrationCaller, typeof section.apis>();
    for (const call of section.apis) {
      const list = map.get(call.caller) ?? [];
      list.push(call);
      map.set(call.caller, list);
    }
    return Array.from(map.entries());
  }, [section.apis]);

  return (
    <div className="space-y-5">
      {grouped.map(([caller, calls]) => (
        <div key={caller} className="space-y-3">
          <Badge variant="outline" className={cn('font-normal', CALLER_STYLES[caller])}>
            {getIntegrationCallerLabel(caller)}
          </Badge>
          <div className="space-y-3">
            {calls.map((call) => (
              <div key={call.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn('font-mono text-[11px]', METHOD_STYLES[call.method])}>
                    {call.method}
                  </Badge>
                  <code className="break-all text-sm font-medium">{call.resolvedPath}</code>
                </div>
                <p className="mt-2 text-sm">{call.purpose}</p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Auth</dt>
                    <dd>{call.auth}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">When it runs</dt>
                    <dd>{call.trigger}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">
                  Template: <code>{call.path}</code>
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionPanel({ section }: { section: IntegrationDocSection }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{section.summary}</p>

      {section.prerequisites.length > 0 ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Prerequisites</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {section.prerequisites.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h4 className="mb-2 text-sm font-semibold">Configuration checklist</h4>
        <ConfigChecklist section={section} />
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Request flow</h4>
        <FlowList section={section} />
      </div>

      <Separator />

      <div>
        <h4 className="mb-3 text-sm font-semibold">API calls</h4>
        <ApiCallList section={section} />
      </div>
    </div>
  );
}

export function IntegrationDocsPanel({
  adminPortalUrl,
  serverBaseUrl,
  partnerEnabled,
  referralEnabled,
  partnerPortalSsoSecret,
  serverEnabled,
  internalApiKey,
}: IntegrationDocsPanelProps) {
  const [remoteDocs, setRemoteDocs] = useState<IntegrationDocsResponse | null>(null);

  const localDocs = useMemo(
    () =>
      buildIntegrationDocs({
        adminPortalUrl,
        serverBaseUrl,
        adminPortal: {
          enabled: partnerEnabled,
          referralEnabled,
          adminPortalUrl,
          partnerPortalSsoSecret,
        },
        publicCircleServer: {
          enabled: serverEnabled,
          serverBaseUrl,
          internalApiKey,
        },
      }),
    [
      adminPortalUrl,
      serverBaseUrl,
      partnerEnabled,
      referralEnabled,
      partnerPortalSsoSecret,
      serverEnabled,
      internalApiKey,
    ],
  );

  useEffect(() => {
    const params = new URLSearchParams({
      adminPortalUrl,
      serverBaseUrl,
      partnerEnabled: String(partnerEnabled),
      referralEnabled: String(referralEnabled),
      serverEnabled: String(serverEnabled),
    });
    if (partnerPortalSsoSecret) {
      params.set('partnerPortalSsoSecret', partnerPortalSsoSecret);
    }
    if (internalApiKey) {
      params.set('internalApiKey', internalApiKey);
    }

    const timer = window.setTimeout(() => {
      void fetch(`/api/integrations/docs?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.sections) setRemoteDocs(data);
        })
        .catch(() => {
          setRemoteDocs(null);
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    adminPortalUrl,
    serverBaseUrl,
    partnerEnabled,
    referralEnabled,
    partnerPortalSsoSecret,
    serverEnabled,
    internalApiKey,
  ]);

  const docs = remoteDocs ?? localDocs;
  const defaultTab = docs.sections[0]?.id ?? 'partner-handoff';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="size-5" />
          Integration reference
        </CardTitle>
        <CardDescription>
          Live documentation for the URLs and toggles above. Paths update as you type.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Admin portal base</p>
            <code className="break-all">{docs.bases.adminPortalUrl}</code>
          </div>
          <div>
            <p className="text-muted-foreground">Public Circle server base</p>
            <code className="break-all">{docs.bases.serverBaseUrl}</code>
          </div>
          <div>
            <p className="text-muted-foreground">Referral app (default)</p>
            <code className="break-all">{docs.bases.referralAppUrl}</code>
          </div>
          <div>
            <p className="text-muted-foreground">Referral API (default)</p>
            <code className="break-all">{docs.bases.referralApiUrl}</code>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ArrowRight className="size-3.5" />
          <span>Pink = Referral App</span>
          <span>·</span>
          <span>Sky = Referral API</span>
          <span>·</span>
          <span>Indigo = Admin</span>
          <span>·</span>
          <span>Slate = Public Circle Server</span>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="h-auto flex-wrap justify-start">
            {docs.sections.map((section) => (
              <TabsTrigger key={section.id} value={section.id} className="text-xs sm:text-sm">
                {section.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {docs.sections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="mt-4">
              <SectionPanel section={section} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
