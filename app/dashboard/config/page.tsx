'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ShieldAlert, UserPlus } from 'lucide-react';

export default function ConfigPage() {
  const [isSignupAllowed, setIsSignupAllowed] = useState<boolean>(true);
  const [appleRelayEmail, setAppleRelayEmail] = useState<string>('');
  const [deleteCompanyContactsAfterDays, setDeleteCompanyContactsAfterDays] = useState<number>(7);
  const [dlqLastProcessedAt, setDlqLastProcessedAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setIsSignupAllowed(data.isSignupAllowed);
      setAppleRelayEmail(data.appleRelayEmail ?? '');
      setDeleteCompanyContactsAfterDays(data.deleteCompanyContactsAfterDays ?? 7);
      setDlqLastProcessedAt(data.DlqLastProcessedAt ? new Date(data.DlqLastProcessedAt).toLocaleString() : '');
    } catch (err) {
      console.error('Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSignup = async (checked: boolean) => {
    setUpdating(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSignupAllowed: checked }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsSignupAllowed(data.isSignupAllowed);
        setAppleRelayEmail(data.appleRelayEmail ?? '');
        setDeleteCompanyContactsAfterDays(data.deleteCompanyContactsAfterDays ?? 7);
        setDlqLastProcessedAt(data.DlqLastProcessedAt ? new Date(data.DlqLastProcessedAt).toLocaleString() : '');
      }
    } catch (err) {
      console.error('Failed to update config');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveSystemSettings = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appleRelayEmail: appleRelayEmail.trim() === '' ? null : appleRelayEmail.trim(),
          deleteCompanyContactsAfterDays,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAppleRelayEmail(data.appleRelayEmail ?? '');
        setDeleteCompanyContactsAfterDays(data.deleteCompanyContactsAfterDays ?? 7);
        setDlqLastProcessedAt(data.DlqLastProcessedAt ? new Date(data.DlqLastProcessedAt).toLocaleString() : '');
        setIsSignupAllowed(data.isSignupAllowed);
      }
    } catch (err) {
      console.error('Failed to update config');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">System Configuration</h2>
        <p className="text-neutral-500">Fine-tune internal application behaviors and access controls.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <CardTitle>Registration Protocol</CardTitle>
            </div>
            <CardDescription>
              Control whether new admin and company accounts can be created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900 border rounded-lg">
                <div className="space-y-0.5">
                  <div className="font-medium flex items-center gap-2">
                    Allow New Signups
                    {updating && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  </div>
                  <p className="text-sm text-neutral-500">
                    If disabled, the signup page will be blocked for all new users.
                  </p>
                </div>
                <Switch 
                  checked={isSignupAllowed} 
                  onCheckedChange={handleToggleSignup}
                  disabled={updating}
                />
              </div>
            )}
            
            {!isSignupAllowed && !loading && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-sm rounded-md border border-amber-200 dark:border-amber-900/50">
                <ShieldAlert size={16} />
                <span>Signups are currently disabled. Existing users can still log in.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <CardTitle>System Settings</CardTitle>
            </div>
            <CardDescription>
              Manage operational settings. DLQ status is read-only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-28" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="appleRelayEmail">Apple Relay Email</Label>
                  <Input
                    id="appleRelayEmail"
                    type="email"
                    value={appleRelayEmail}
                    onChange={(e) => setAppleRelayEmail(e.target.value)}
                    placeholder="dp79z6h8xg@privaterelay.appleid.com"
                    disabled={updating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deleteCompanyContactsAfterDays">Delete Company Contacts After (days)</Label>
                  <Input
                    id="deleteCompanyContactsAfterDays"
                    type="number"
                    min={0}
                    value={Number.isFinite(deleteCompanyContactsAfterDays) ? deleteCompanyContactsAfterDays : 0}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setDeleteCompanyContactsAfterDays(val === '' ? 0 : Number(val));
                    }}
                    disabled={updating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dlqLastProcessedAt">DLQ Last Processed At (read-only)</Label>
                  <Input
                    id="dlqLastProcessedAt"
                    type="text"
                    value={dlqLastProcessedAt}
                    readOnly
                    disabled
                  />
                </div>

                <div className="flex items-center justify-end">
                  <Button onClick={handleSaveSystemSettings} disabled={updating}>
                    {updating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
