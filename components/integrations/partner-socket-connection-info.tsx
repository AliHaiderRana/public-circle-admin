'use client';

import {
  buildPartnerRealtimeConnectionInfo,
} from '@/lib/partner-realtime-connection.util';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PartnerSocketConnectionInfoProps = {
  adminPortalUrl?: string;
  partnerRealtimeSocketUrl?: string;
  serverBaseUrl?: string;
  onPartnerRealtimeSocketUrlChange?: (value: string) => void;
  disabled?: boolean;
};

export function PartnerSocketConnectionInfo({
  adminPortalUrl,
  partnerRealtimeSocketUrl = '',
  serverBaseUrl,
  onPartnerRealtimeSocketUrlChange,
  disabled = false,
}: PartnerSocketConnectionInfoProps) {
  const connection = buildPartnerRealtimeConnectionInfo({
    adminPortalUrl,
    partnerRealtimeSocketUrl,
    serverBaseUrl,
  });

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium">Connection URLs</p>
        <p className="text-xs text-muted-foreground">
          Admin portal URL (above) is redirect-only. Socket URL below is realtime connection.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="partner-socket-url">Socket URL</Label>
        <Input
          id="partner-socket-url"
          placeholder={connection.connectionUrl}
          value={partnerRealtimeSocketUrl}
          disabled={disabled}
          onChange={(event) => onPartnerRealtimeSocketUrlChange?.(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {partnerRealtimeSocketUrl.trim()
            ? `Socket.IO path ${connection.path}`
            : `Leave empty to use ${connection.connectionUrl} (recommended)`}
        </p>
      </div>
    </div>
  );
}
