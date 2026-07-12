'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { User, Lock, Mail, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatAdminDisplayName } from '@/lib/support-admin.util';

import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const isPartnerView = Boolean(authUser?.isPartner);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [suggestedName, setSuggestedName] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        const emailValue = data.user?.email || '';
        const nameValue = data.user?.name || '';
        setEmail(emailValue);
        setName(nameValue);
        setSuggestedName(formatAdminDisplayName(nameValue, emailValue));
      });
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfile(true);
    setMessage(null);

    try {
      const nameRes = await fetch('/api/auth/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const nameData = await nameRes.json();
      if (!nameRes.ok) {
        throw new Error(nameData.error || 'Failed to update name');
      }

      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoadingPassword(true);
    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Password updated successfully' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update password' });
    } finally {
      setLoadingPassword(false);
    }
  };

  if (isPartnerView) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
          <p className="text-muted-foreground mt-1">
            Your partner portal account. Update your password in the Venndii Referral App.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Read-only partner session details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Name</Label>
              <p className="text-sm font-medium mt-1">{name || suggestedName || '—'}</p>
            </div>
            <div>
              <Label>Email</Label>
              <p className="text-sm font-medium mt-1">{email || '—'}</p>
            </div>
            <div>
              <Label>Role</Label>
              <p className="text-sm font-medium mt-1">
                {authUser?.referralRole === 'ADMIN'
                  ? 'Referral Admin'
                  : authUser?.referralRole === 'SALES_PERSON'
                    ? 'Sales Partner'
                    : 'Marketing Partner'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
          <p className="text-muted-foreground mt-1">Update your personal details and keep your account secure.</p>
        </div>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="h-5 w-5 text-primary" />
              </div>
              Account settings
            </CardTitle>
            <CardDescription>Manage how your profile looks and how you sign in.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Full name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={suggestedName || 'Enter your name'}
                  />
                  {suggestedName && suggestedName !== name.trim() && (
                    <p className="text-xs text-muted-foreground">
                      Suggested display name:{' '}
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs font-medium"
                        onClick={() => setName(suggestedName)}
                      >
                        {suggestedName}
                      </Button>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                  />
                </div>


                <div className="flex justify-end">
                  <Button type="submit" disabled={loadingProfile}>
                    {loadingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save changes'
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">
                    Current password
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">
                      New password
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirm new password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={loadingPassword}>
                    {loadingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update password'
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
