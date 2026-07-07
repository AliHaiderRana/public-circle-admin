'use client';

import {
  buildPartnerRealtimeConnectionInfo,
  PARTNER_SOCKET_AUTH_VALIDATOR,
} from '@/lib/partner-realtime-connection.util';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { SecretInput } from '@/components/integrations/secret-input';

type PartnerSocketConnectionInfoProps = {
  adminPortalUrl?: string;
  partnerRealtimeSocketUrl?: string;
  partnerSocketAuthValidator?: string;
  partnerRealtimeSocketKey?: string;
  onPartnerRealtimeSocketUrlChange?: (value: string) => void;
  onPartnerSocketAuthValidatorChange?: (value: string) => void;
  onRegenerateSocketKey?: () => void;
};

export function PartnerSocketConnectionInfo({
  adminPortalUrl,
  partnerRealtimeSocketUrl = '',
  partnerSocketAuthValidator = PARTNER_SOCKET_AUTH_VALIDATOR,
  partnerRealtimeSocketKey = '',
  onPartnerRealtimeSocketUrlChange,
  onPartnerSocketAuthValidatorChange,
  onRegenerateSocketKey,
}: PartnerSocketConnectionInfoProps) {
  const connection = buildPartnerRealtimeConnectionInfo({
    adminPortalUrl,
    partnerRealtimeSocketUrl,
    partnerSocketAuthValidator,
  });

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium">Socket connection</p>
        <p className="text-xs text-muted-foreground">
          One URL for the referral app to connect over Socket.IO.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="partner-socket-url">Socket URL</Label>
        <Input
          id="partner-socket-url"
          placeholder={connection.connectionUrl}
          value={partnerRealtimeSocketUrl}
          onChange={(event) => onPartnerRealtimeSocketUrlChange?.(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {partnerRealtimeSocketUrl.trim()
            ? `Socket.IO path ${connection.path}`
            : `Leave empty to use ${connection.connectionUrl} from admin portal URL`}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="partner-socket-auth-validator">Socket auth validator</Label>
        <Input
          id="partner-socket-auth-validator"
          value={partnerSocketAuthValidator}
          onChange={(event) => onPartnerSocketAuthValidatorChange?.(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Partner JWT and socket key are sent as <code>auth.token</code> and <code>auth.socketKey</code>{' '}
          when connecting.
        </p>
      </div>

      <div className="space-y-2">
        <SecretInput
          id="partner-socket-key"
          label="Partner socket key"
          value={partnerRealtimeSocketKey}
          readOnly
          helperText="Generated on admin. Referral app sends this as auth.socketKey. Auto-generated on save if empty."
        />
        {onRegenerateSocketKey ? (
          <Button type="button" variant="outline" size="sm" onClick={onRegenerateSocketKey}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate socket key
          </Button>
        ) : null}
      </div>
    </div>
  );
}
