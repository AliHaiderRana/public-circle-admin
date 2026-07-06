'use client';

import { useMemo, useState } from 'react';
import {
  DEFAULT_PARTNER_SOCKET_EVENTS,
  mergePartnerSocketEvents,
  type PartnerSocketEvent,
} from '@/lib/partner-socket-events.catalog';
import { MAX_PARTNER_SOCKET_EVENTS } from '@/lib/partner-realtime-connection.util';
import { PartnerSocketConnectionInfo } from '@/components/integrations/partner-socket-connection-info';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type PartnerSocketEventsPanelProps = {
  events: PartnerSocketEvent[] | undefined;
  saving: boolean;
  onChange: (events: PartnerSocketEvent[]) => void;
  onSave: () => void;
  dirty: boolean;
  adminPortalUrl?: string;
  partnerRealtimeSocketUrl?: string;
  partnerSocketAuthValidator?: string;
  partnerRealtimeSocketKey?: string;
  onPartnerRealtimeSocketUrlChange?: (value: string) => void;
  onPartnerSocketAuthValidatorChange?: (value: string) => void;
  onRegenerateSocketKey?: () => void;
};

type EditorState = {
  mode: 'add' | 'edit';
  event: PartnerSocketEvent;
};

function emptyCustomEvent(kind: PartnerSocketEvent['kind']): PartnerSocketEvent {
  return {
    id: `custom-${Date.now()}`,
    kind,
    method: 'SOCKET',
    path: '',
    enabled: true,
    label: '',
    auth: 'Socket auth.token = partner access token (JWT)',
    builtin: false,
    requestBodySample: kind === 'socket-emit' ? '{\n  \n}' : undefined,
    responseSample: kind === 'socket-listen' ? '{\n  "count": 0\n}' : undefined,
  };
}

export function PartnerSocketEventsPanel({
  events,
  saving,
  onChange,
  onSave,
  dirty,
  adminPortalUrl,
  partnerRealtimeSocketUrl,
  partnerSocketAuthValidator,
  partnerRealtimeSocketKey,
  onPartnerRealtimeSocketUrlChange,
  onPartnerSocketAuthValidatorChange,
  onRegenerateSocketKey,
}: PartnerSocketEventsPanelProps) {
  const mergedEvents = useMemo(() => mergePartnerSocketEvents(events), [events]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartnerSocketEvent | null>(null);
  const atEventLimit = mergedEvents.length >= MAX_PARTNER_SOCKET_EVENTS;

  const openAddEditor = (kind: PartnerSocketEvent['kind']) => {
    if (atEventLimit) return;
    setEditor({ mode: 'add', event: emptyCustomEvent(kind) });
  };

  const updateEvent = (id: string, patch: Partial<PartnerSocketEvent>) => {
    onChange(
      mergedEvents.map((event) => (event.id === id ? { ...event, ...patch } : event)),
    );
  };

  const saveEditor = () => {
    if (!editor) return;
    const path = editor.event.path.trim();
    if (!path) return;

    if (editor.mode === 'add' && mergedEvents.length >= MAX_PARTNER_SOCKET_EVENTS) {
      return;
    }

    const next = {
      ...editor.event,
      path,
      label: editor.event.label.trim() || path,
    };

    if (editor.mode === 'add') {
      onChange([...mergedEvents, next]);
    } else {
      onChange(mergedEvents.map((event) => (event.id === next.id ? next : event)));
    }
    setEditor(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onChange(mergedEvents.filter((event) => event.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Partner socket</CardTitle>
          <CardDescription>
            Real-time badge counts over Socket.IO. Maximum {MAX_PARTNER_SOCKET_EVENTS} events —
            delete any event to add a new one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PartnerSocketConnectionInfo
            adminPortalUrl={adminPortalUrl}
            partnerRealtimeSocketUrl={partnerRealtimeSocketUrl}
            partnerSocketAuthValidator={partnerSocketAuthValidator}
            partnerRealtimeSocketKey={partnerRealtimeSocketKey}
            onPartnerRealtimeSocketUrlChange={onPartnerRealtimeSocketUrlChange}
            onPartnerSocketAuthValidatorChange={onPartnerSocketAuthValidatorChange}
            onRegenerateSocketKey={onRegenerateSocketKey}
          />

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">
              Socket events ({mergedEvents.length} / {MAX_PARTNER_SOCKET_EVENTS})
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={atEventLimit}
                onClick={() => openAddEditor('socket-listen')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add listen event
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={atEventLimit}
                onClick={() => openAddEditor('socket-emit')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add emit event
              </Button>
            </div>
            {atEventLimit ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Maximum {MAX_PARTNER_SOCKET_EVENTS} events reached. Delete an event to add another.
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            {mergedEvents.map((event) => {
              const paired = mergedEvents.find((entry) => entry.id === event.pairedEventId);
              const sample =
                event.kind === 'socket-listen'
                  ? event.responseSample
                  : event.requestBodySample;

              return (
                <div key={event.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={event.kind === 'socket-listen' ? 'default' : 'secondary'}>
                          {event.kind === 'socket-listen' ? 'Listen' : 'Emit'}
                        </Badge>
                        <code className="text-sm">{event.path}</code>
                        {event.builtin ? <Badge variant="outline">Built-in</Badge> : null}
                      </div>
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{event.auth}</p>
                      {paired ? (
                        <p className="text-xs text-muted-foreground">
                          Paired with <code>{paired.path}</code>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={event.enabled}
                          onCheckedChange={(checked) =>
                            updateEvent(event.id, { enabled: checked })
                          }
                        />
                        <Label className="text-xs">On</Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditor({ mode: 'edit', event })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(event)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {sample ? (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        {event.kind === 'socket-listen' ? 'Sample response' : 'Request body sample'}
                      </p>
                      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{sample}</pre>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {dirty ? 'Unsaved socket event changes.' : 'Socket events saved.'}
            </p>
            <Button type="button" onClick={onSave} disabled={!dirty || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save socket events
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === 'add' ? 'Add socket event' : 'Edit socket event'}
            </DialogTitle>
            <DialogDescription>
              Use dotted names. Pair listen events with a matching <code>.refresh</code> emit.
            </DialogDescription>
          </DialogHeader>

          {editor ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Direction</Label>
                <Input value={editor.event.kind} disabled />
              </div>
              <div className="space-y-1">
                <Label>Event name</Label>
                <Input
                  value={editor.event.path}
                  placeholder="partner.example.refresh"
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      event: { ...editor.event, path: event.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Label</Label>
                <Input
                  value={editor.event.label}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      event: { ...editor.event, label: event.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Paired event id</Label>
                <Input
                  value={editor.event.pairedEventId || ''}
                  placeholder="socket-open-tickets-refresh"
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      event: { ...editor.event, pairedEventId: event.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Auth notes</Label>
                <Input
                  value={editor.event.auth}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      event: { ...editor.event, auth: event.target.value },
                    })
                  }
                />
              </div>
              {editor.event.kind === 'socket-listen' ? (
                <div className="space-y-1">
                  <Label>Sample response (JSON)</Label>
                  <Textarea
                    rows={5}
                    value={editor.event.responseSample || ''}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        event: { ...editor.event, responseSample: event.target.value },
                      })
                    }
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Request body sample (JSON)</Label>
                  <Textarea
                    rows={5}
                    value={editor.event.requestBodySample || ''}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        event: { ...editor.event, requestBodySample: event.target.value },
                      })
                    }
                  />
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEditor}>
              {editor?.mode === 'add' ? 'Add' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete socket event?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <code>{deleteTarget?.path}</code> from the integration contract?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { DEFAULT_PARTNER_SOCKET_EVENTS };
