'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { UserPlus, User, Mail, Calendar, Eye, EyeOff } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Admin {
  _id: string;
  email: string;
  name?: string;
  createdAt: string;
  isSuperAdmin?: boolean;
}

export default function AdminsPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingAdminId, setConfirmingAdminId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admins');
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (error) {
      setMessage('Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.isSuperAdmin) return;

    // Prevent deleting yourself
    if (user.id && user.id === id) {
      setMessage("You can't delete your own admin account.");
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admins?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage('Admin deleted successfully');
        fetchAdmins();
      } else {
        const data = await res.json();
        setMessage(data.error || 'Failed to delete admin');
      }
    } catch (error) {
      setMessage('Failed to delete admin');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      if (res.ok) {
        setMessage('Admin created successfully');
        setEmail('');
        setPassword('');
        setName('');
        setShowForm(false);
        fetchAdmins();
      } else {
        const data = await res.json();
        setMessage(data.error);
      }
    } catch (error) {
      setMessage('Failed to create admin');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Users</h2>
          <p className="text-neutral-500">Manage administrator accounts</p>
        </div>
        {user?.isSuperAdmin && (
          <Button onClick={() => setShowForm(!showForm)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Admin
          </Button>
        )}
      </div>

      {message && (
        <div className="p-4 bg-neutral-100 rounded-lg">
          <p className="text-sm">{message}</p>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit">Create Admin</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-[120px]" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-[180px]" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-[90px] rounded-full" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-[100px]" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : admins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-48 text-neutral-500">
                    <div className="flex flex-col items-center gap-2">
                      <User size={40} className="text-neutral-300" />
                      <p>No admin users found.</p>
                      {user?.isSuperAdmin && (
                        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                          Add your first admin
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                admins.map((admin) => (
                  <TableRow key={admin._id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <User size={14} />
                        </div>
                        <span className="font-medium">{admin.name || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail size={14} className="text-neutral-400" />
                        {admin.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={admin.isSuperAdmin ? "default" : "secondary"} className="text-xs">
                        {admin.isSuperAdmin ? 'Super Admin' : 'Admin'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <Calendar size={14} className="text-neutral-400" />
                        {new Date(admin.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    {user?.isSuperAdmin && admin._id !== user?.id && (
                      <TableCell align="right">
                        <AlertDialog
                          open={confirmingAdminId === admin._id}
                          onOpenChange={(open) => {
                            setConfirmingAdminId(open ? admin._id : null);
                          }}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500 border-red-200 hover:bg-red-50"
                              onClick={() => setConfirmingAdminId(admin._id)}
                              disabled={deletingId === admin._id}
                            >
                              {deletingId === admin._id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete admin user?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. The selected admin will permanently lose access to the
                                admin panel.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={async () => {
                                  await handleDelete(admin._id);
                                  setConfirmingAdminId(null);
                                }}
                              >
                                Confirm delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
