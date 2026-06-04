'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import NotificationDropdown from '@/components/NotificationDropdown';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardList,
  TrendingUp,
  Play,
  CreditCard,
  UserCircle,
  Shield,
  Clock,
  FileText,
  FolderTree,
  Layers,
  Languages,
  Info,
  ScrollText,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const sidebarItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Customer Requests', href: '/dashboard/customer-requests', icon: ClipboardList },
  { name: 'Companies', href: '/dashboard/companies', icon: Building2 },
  { name: 'Users', href: '/dashboard/users', icon: Users },
  { name: 'Campaigns', href: '/dashboard/campaigns', icon: TrendingUp },
  { name: 'Campaign Runs', href: '/dashboard/campaign-runs', icon: Play },
  { name: 'Sample Templates', href: '/dashboard/templates', icon: FileText },
  { name: 'Template Categories', href: '/dashboard/template-categories', icon: FolderTree },
  { name: 'Stripe Dashboard', href: '/dashboard/stripe', icon: CreditCard },
  { name: 'Plan Quotas', href: '/dashboard/plans', icon: Layers },
  { name: 'Cron Jobs', href: '/dashboard/crons', icon: Clock },
  { name: 'Translations', href: '/dashboard/translations', icon: Languages },
  { name: 'Context help', href: '/dashboard/ui-hints', icon: Info },
  { name: 'Panel audit log', href: '/dashboard/admin-activity', icon: ScrollText, superAdminOnly: true },
  { name: 'Customer session audit', href: '/dashboard/impersonation-activity', icon: ShieldAlert, superAdminOnly: true },
  { name: 'Admin Users', href: '/dashboard/admins', icon: Shield, superAdminOnly: true },
  { name: 'Profile', href: '/dashboard/profile', icon: UserCircle },
  { name: 'System Configuration', href: '/dashboard/config', icon: Settings, superAdminOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background text-foreground">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 lg:shrink-0',
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="hidden border-b border-sidebar-border p-6 lg:block">
            <div className="flex items-center gap-3">
              <img
                src="/logo-single.png"
                alt="Public Circle Admin"
                className="h-8 w-8 rounded-lg object-cover"
              />
              <h1 className="text-lg font-semibold text-sidebar-foreground">
                Public Circle Admin
              </h1>
            </div>
          </div>
          <div className="border-b border-sidebar-border p-4 lg:hidden">
            <div className="flex items-center gap-3">
              <img
                src="/logo-single.png"
                alt="Public Circle Admin"
                className="h-6 w-6 rounded-lg object-cover"
              />
              <h1 className="text-base font-semibold">Public Circle Admin</h1>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {sidebarItems
              .filter((item) => {
                if (item.superAdminOnly && !user?.isSuperAdmin) return false;
                return true;
              })
              .map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="mb-3 flex items-center gap-3 px-2">
              <div className="flex size-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
                <Users className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.isSuperAdmin ? 'Super Admin' : 'Admin'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={logout}
            >
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
        </aside>

        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center border-b border-border bg-card px-4 lg:h-16 lg:px-6">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                  {isSidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                  <span className="sr-only">Toggle menu</span>
                </Button>
                <div className="flex items-center gap-2 lg:hidden">
                  <img
                    src="/logo-single.png"
                    alt="Public Circle Admin"
                    className="size-6 rounded-lg object-cover"
                  />
                  <span className="text-sm font-semibold">Public Circle Admin</span>
                </div>
              </div>
              <NotificationDropdown />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-muted/30">
            <div className="p-4 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
