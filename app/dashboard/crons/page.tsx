'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, RefreshCw, Clock } from 'lucide-react';

interface Cron {
  name: string;
  displayName: string;
  lastRun: string | null;
  recordsUpdated: number;
}

export default function CronsPage() {
  const [crons, setCrons] = useState<Cron[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchCrons();
  }, []);

  const fetchCrons = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/crons`, {
        credentials: 'include'
      });
      const data = await res.json();
      setCrons(data.crons || []);
    } catch (error) {
      setMessage('Failed to load crons');
    } finally {
      setLoading(false);
    }
  };

  const triggerCron = async (cronName: string) => {
    setTriggering(cronName);
    setMessage('');
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/crons/trigger/${cronName}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        setMessage(`${cronName} triggered successfully`);
        fetchCrons();
      } else {
        const data = await res.json();
        setMessage(data.error);
      }
    } catch (error) {
      setMessage('Failed to trigger cron');
    } finally {
      setTriggering(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cron Jobs</h2>
          <p className="text-neutral-500">Manage and trigger scheduled tasks</p>
        </div>
        <Button onClick={fetchCrons} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {message && (
        <div className="p-4 bg-neutral-100 rounded-lg">
          <p className="text-sm">{message}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cron Name</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Records Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crons.map((cron) => (
                <TableRow key={cron.name}>
                  <TableCell className="font-medium">{cron.displayName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-neutral-500" />
                      {formatDate(cron.lastRun)}
                    </div>
                  </TableCell>
                  <TableCell>{cron.recordsUpdated}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => triggerCron(cron.name)}
                      disabled={triggering === cron.name}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {triggering === cron.name ? 'Running...' : 'Trigger'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
