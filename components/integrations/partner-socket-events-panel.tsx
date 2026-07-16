'use client';

import { useMemo } from 'react';
import {
  mergePartnerSocketEvents,
  type PartnerSocketEvent,
} from '@/lib/partner-socket-events.catalog';
import { MAX_PARTNER_SOCKET_EVENTS } from '@/lib/partner-realtime-connection.util';
import { PartnerSocketConnectionInfo } from '@/components/integrations/partner-socket-connection-info';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type PartnerSocketEventsPanelProps = {
  events: PartnerSocketEvent[] | undefined;
  saving: boolean;
  onSave: () => void;
  dirty: boolean;
  adminPortalUrl?: string;
  serverBaseUrl?: string;
  partnerRealtimeSocketUrl?: string;
  onPartnerRealtimeSocketUrlChange?: (value: string) => void;
  enabled: boolean;
  parentEnabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onEventsChange: (events: PartnerSocketEvent[]) => void;
};

export function PartnerSocketEventsPanel({
  events,
  saving,
  onSave,
  dirty,
  adminPortalUrl,
  serverBaseUrl,
  partnerRealtimeSocketUrl,
  onPartnerRealtimeSocketUrlChange,
  enabled,
  parentEnabled,
  onEnabledChange,
  onEventsChange,
}: PartnerSocketEventsPanelProps) {
  const mergedEvents = useMemo(
    () =>
      [...mergePartnerSocketEvents(events)].sort((a, b) => {
        const rank = { 'socket-listen': 0, 'socket-emit': 1 };
        const kindDiff = (rank[a.kind] ?? 2) - (rank[b.kind] ?? 2);
        if (kindDiff !== 0) return kindDiff;
        return String(a.path).localeCompare(String(b.path));
      }),
    [events],
  );

  return (
    <Card className="ml-4 border-l-4 sm:ml-8">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Customer portal realtime</CardTitle>
          <CardDescription>
            Child integration for the socket connection and four fixed events.
          </CardDescription>
        </div>
        <Switch
          aria-label="Enable customer portal realtime"
          checked={parentEnabled && enabled}
          disabled={!parentEnabled || saving}
          onCheckedChange={onEnabledChange}
        />
      </CardHeader>
      <CardContent className={`space-y-4 ${!parentEnabled || !enabled ? 'opacity-60' : ''}`}>
        <PartnerSocketConnectionInfo
          adminPortalUrl={adminPortalUrl}
          serverBaseUrl={serverBaseUrl}
          partnerRealtimeSocketUrl={partnerRealtimeSocketUrl}
          onPartnerRealtimeSocketUrlChange={onPartnerRealtimeSocketUrlChange}
          disabled={!parentEnabled || !enabled}
        />

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">
            Fixed socket events ({mergedEvents.length} / {MAX_PARTNER_SOCKET_EVENTS})
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="text-right">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mergedEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Badge variant={event.kind === 'socket-listen' ? 'default' : 'secondary'}>
                      {event.kind === 'socket-listen' ? 'Listen' : 'Emit'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm">{event.path}</code>
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      aria-label={`Enable ${event.label}`}
                      checked={parentEnabled && enabled && event.enabled}
                      disabled={!parentEnabled || !enabled || saving}
                      onCheckedChange={(checked) =>
                        onEventsChange(
                          mergedEvents.map((entry) =>
                            entry.id === event.id ? { ...entry, enabled: checked } : entry,
                          ),
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {dirty ? 'Unsaved socket changes — save to apply.' : null}
          </p>
          <Button type="button" onClick={onSave} disabled={!dirty || saving || !parentEnabled}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save socket connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
