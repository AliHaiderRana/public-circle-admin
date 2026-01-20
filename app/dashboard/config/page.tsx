'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, UserPlus } from 'lucide-react';

export default function ConfigPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [appleRelayEmail, setAppleRelayEmail] = useState<string>('');
  const [deleteCompanyContactsAfterDays, setDeleteCompanyContactsAfterDays] = useState<number>(7);
  const [dlqLastProcessedAt, setDlqLastProcessedAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Redirect non-super-admins
  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchConfig();
    }
  }, [user]);

  // Don't render anything for non-super-admins
  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setAppleRelayEmail(data.appleRelayEmail ?? '');
      setDeleteCompanyContactsAfterDays(data.deleteCompanyContactsAfterDays ?? 7);
      setDlqLastProcessedAt(data.DlqLastProcessedAt ? new Date(data.DlqLastProcessedAt).toLocaleString() : '');
    } catch (err) {
      console.error('Failed to load config');
    } finally {
      setLoading(false);
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
