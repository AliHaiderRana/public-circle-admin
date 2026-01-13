'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, RefreshCw, Clock, AlertCircle, CheckCircle2, Loader2, Database } from 'lucide-react';

interface Cron {
  _id: string;
  name: string;
  displayName: string;
  schedule: string;
  description: string;
  lastRunAt: string | null;
  lastRecordsUpdated: number;
  lastDurationMs: number | null;
  lastError: string | null;
  isEnabled: boolean;
}

export default function CronsPage() {
  const [crons, setCrons] = useState<Cron[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    fetchCrons();
  }, []);

  const fetchCrons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crons', {
        credentials: 'include'
      });
      const data = await res.json();
      setCrons(data.crons || []);
      if (data.crons?.length === 0) {
        setMessage({ text: 'No crons found. Click "Seed Crons" to populate the database.', type: 'info' });
      }
    } catch (error) {
      setMessage({ text: 'Failed to load crons', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const seedCrons = async () => {
    setSeeding(true);
    setMessage(null);
    
    try {
      const res = await fetch('/api/crons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'seed' })
      });

      const data = await res.json();
      
      if (res.ok) {
        setCrons(data.crons || []);
        setMessage({ text: 'Cron metadata seeded successfully', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Failed to seed crons', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Failed to seed crons', type: 'error' });
    } finally {
      setSeeding(false);
    }
  };

  const triggerCron = async (cronName: string) => {
    setTriggering(cronName);
    setMessage(null);
    
    try {
      const res = await fetch(`/api/crons/trigger/${cronName}`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ 
          text: `${cronName} triggered successfully${data.data?.durationMs ? ` (${data.data.durationMs}ms)` : ''}`, 
          type: 'success' 
        });
        // Refresh to get updated lastRunAt
        fetchCrons();
      } else {
        setMessage({ text: data.error || 'Failed to trigger cron', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Failed to trigger cron', type: 'error' });
    } finally {
      setTriggering(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleString();
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getScheduleDescription = (schedule: string) => {
    const scheduleMap: Record<string, string> = {
      '*/1 * * * *': 'Every minute',
      '*/10 * * * *': 'Every 10 minutes',
      '0 0 * * *': 'Daily at midnight',
      '0 0 0 * * *': 'Daily at midnight',
      '0 1 * * *': 'Daily at 1 AM',
      '0 4 * * *': 'Daily at 4 AM',
      '0 6 * * *': 'Daily at 6 AM',
      '0 0,12 * * *': 'Twice daily (12 AM & 12 PM)',
    };
    return scheduleMap[schedule] || schedule;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cron Jobs</h2>
          <p className="text-neutral-500">Manage and trigger scheduled tasks</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchCrons} variant="outline" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> :
           message.type === 'error' ? <AlertCircle className="h-4 w-4" /> :
           <AlertCircle className="h-4 w-4" />}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {crons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-neutral-400 mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No cron jobs found</h3>
            <p className="text-neutral-500 mb-4">Click the button below to seed the cron metadata</p>
            <Button onClick={seedCrons} disabled={seeding}>
              <Database className="mr-2 h-4 w-4" />
              {seeding ? 'Seeding...' : 'Seed Cron Metadata'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Jobs</CardTitle>
            <CardDescription>
              {crons.length} cron job{crons.length !== 1 ? 's' : ''} registered
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cron Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crons.map((cron) => (
                  <TableRow key={cron._id || cron.name}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{cron.displayName}</div>
                        <div className="text-xs text-neutral-500">{cron.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-mono text-xs">{cron.schedule}</div>
                        <div className="text-xs text-neutral-500">{getScheduleDescription(cron.schedule)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-neutral-400" />
                        <span className="text-sm">{formatDate(cron.lastRunAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono">{formatDuration(cron.lastDurationMs)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{cron.lastRecordsUpdated}</span>
                    </TableCell>
                    <TableCell>
                      {cron.lastError ? (
                        <Badge variant="destructive" className="text-xs">
                          Error
                        </Badge>
                      ) : cron.lastRunAt ? (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => triggerCron(cron.name)}
                        disabled={triggering === cron.name}
                      >
                        {triggering === cron.name ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        {triggering === cron.name ? 'Running...' : 'Trigger'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
