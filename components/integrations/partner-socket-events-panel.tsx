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
    <Card>
      <CardHeader>
        <CardTitle>Customer portal realtime</CardTitle>
        <CardDescription>
          Keep this simple: one socket URL + four fixed events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PartnerSocketConnectionInfo
          adminPortalUrl={adminPortalUrl}
          serverBaseUrl={serverBaseUrl}
          partnerRealtimeSocketUrl={partnerRealtimeSocketUrl}
          onPartnerRealtimeSocketUrlChange={onPartnerRealtimeSocketUrlChange}
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
                <TableHead>Status</TableHead>
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
                  <TableCell>
                    <Badge variant={event.enabled ? 'default' : 'outline'}>
                      {event.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {dirty ? 'Unsaved socket connection changes.' : 'Socket connection saved.'}
          </p>
          <Button type="button" onClick={onSave} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save socket connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
