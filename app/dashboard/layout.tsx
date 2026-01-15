'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import NotificationDropdown from '@/components/NotificationDropdown';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Bell,
  Search,
  Play,
  CreditCard,
  UserCircle,
  Shield,
  Clock
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
  { name: 'Stripe Dashboard', href: '/dashboard/stripe', icon: CreditCard },
  { name: 'Cron Jobs', href: '/dashboard/crons', icon: Clock },
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
      <div className="flex h-screen bg-neutral-100 dark:bg-neutral-900">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:flex-shrink-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            <div className="p-6 hidden lg:block">
              <div className="flex items-center gap-3">
                <img 
                  src="/logo-single.png" 
                  alt="Public Circle Admin" 
                  className="h-8 w-8 rounded-lg object-cover"
                />
                <h1 className="text-xl font-bold text-primary">Public Circle Admin</h1>
              </div>
            </div>
            <div className="p-4 lg:hidden">
              <div className="flex items-center gap-3">
                <img 
                  src="/logo-single.png" 
                  alt="Public Circle Admin" 
                  className="h-6 w-6 rounded-lg object-cover"
                />
                <h1 className="text-lg font-bold text-primary">Public Circle Admin</h1>
              </div>
            </div>

            <nav className="flex-1 px-4 space-y-2">
              {sidebarItems
                .filter((item: any) => {
                  // Hide super-admin-only items for non-super-admin users
                  if (item.superAdminOnly && !user?.isSuperAdmin) {
                    return false;
                  }
                  return true;
                })
                .map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-4 py-2 rounded-lg transition-colors
                      ${isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'}
                    `}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <item.icon size={20} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3 mb-4 px-4">
                <div className="bg-primary/10 text-primary p-2 rounded-full">
                  <Users size={20} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-neutral-500">Administrator</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={logout}
              >
                <LogOut size={20} />
                <span className="text-sm">Logout</span>
              </Button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:ml-0">
          {/* Header */}
          <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 lg:px-6 lg:h-16 flex-shrink-0">
            <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  >
                    {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                  </Button>
                  <div className="flex items-center gap-2">
                    <img 
                      src="/logo-single.png" 
                      alt="Public Circle Admin" 
                      className="h-6 w-6 rounded-lg object-cover"
                    />
                    <h1 className="text-lg font-bold text-primary">Public Circle Admin</h1>
                  </div>
                </div>
              
              <div className="flex items-center gap-3">
                <NotificationDropdown />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-900">
            <div className="p-4 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
