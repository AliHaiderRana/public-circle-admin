"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import PartnerRouteGuard from "@/components/PartnerRouteGuard";
import { BrandLogo, getPartnerPortalSubtitle } from "@/components/BrandLogo";
import NotificationDropdown from "@/components/NotificationDropdown";
import { AdminNotificationSoundProvider } from "@/components/AdminNotificationSoundProvider";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  Sparkles,
  Plug,
  Handshake,
  Inbox,
  Bell,
  MailWarning,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, type ComponentType } from "react";
import {
  getActiveAdminSupportTicketId,
  setActiveAdminSupportTicketId,
} from "@/lib/admin-support-view";
import { leaveSupportChatRoom } from "@/lib/support-socket";
import { SupportCountBadge } from "@/components/SupportCountBadge";
import { useSupportStats } from "@/hooks/use-support-stats";
import { formatAdminDisplayName } from "@/lib/support-admin.util";
import { useAdminSupportRealtimeSync } from "@/hooks/use-admin-support-realtime-sync";
import { TooltipProvider } from "@/components/ui/tooltip";

type SidebarItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
  countKey?: "unreadChatMessages" | "openSupportRequests" | "pendingCustomerRequests";
  secondaryCountKey?: "unreadChatMessages" | "openSupportRequests" | "pendingCustomerRequests";
};

const sidebarItems: SidebarItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    name: "Customer Requests",
    href: "/dashboard/customer-requests",
    icon: ClipboardList,
    countKey: "pendingCustomerRequests",
  },
  {
    name: "Support Requests",
    href: "/dashboard/support-requests",
    icon: Inbox,
    countKey: "unreadChatMessages",
    secondaryCountKey: "openSupportRequests",
  },
  { name: "Companies", href: "/dashboard/companies", icon: Building2 },
  { name: "Users", href: "/dashboard/users", icon: Users },
  { name: "Campaigns", href: "/dashboard/campaigns", icon: TrendingUp },
  { name: "Campaign Runs", href: "/dashboard/campaign-runs", icon: Play },
  { name: "Sample Templates", href: "/dashboard/templates", icon: FileText },
  {
    name: "Template Categories",
    href: "/dashboard/template-categories",
    icon: FolderTree,
  },
  { name: "Stripe Dashboard", href: "/dashboard/stripe", icon: CreditCard },
  { name: "Plan Quotas", href: "/dashboard/plans", icon: Layers },
  { name: "Cron Jobs", href: "/dashboard/crons", icon: Clock },
  {
    name: "Dead Letter Queue",
    href: "/dashboard/dlq",
    icon: MailWarning,
    superAdminOnly: true,
  },
  { name: "Translations", href: "/dashboard/translations", icon: Languages },
  { name: "Context help", href: "/dashboard/ui-hints", icon: Info },
  {
    name: "Admin Users",
    href: "/dashboard/admins",
    icon: Shield,
    superAdminOnly: true,
  },
  {
    name: "Referral Users",
    href: "/dashboard/third-party-users",
    icon: Handshake,
    superAdminOnly: true,
  },
  { name: "Changelog", href: "/dashboard/changelog", icon: Sparkles },
  { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
  {
    name: "System Notifications",
    href: "/dashboard/system-notifications",
    icon: Bell,
    superAdminOnly: true,
  },
  {
    name: "Integrations",
    href: "/dashboard/integrations",
    icon: Plug,
    superAdminOnly: true,
  },
  {
    name: "System Configuration",
    href: "/dashboard/config",
    icon: Settings,
    superAdminOnly: true,
  },
];

const partnerSidebarHrefs = new Set([
  "/dashboard/companies",
  "/dashboard/users",
  "/dashboard/campaigns",
  "/dashboard/campaign-runs",
  "/dashboard/support-requests",
  "/dashboard/profile",
]);

function isSidebarItemActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  if (href === "/dashboard/support-requests") {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname.startsWith("/dashboard/support-chat")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { stats } = useSupportStats();
  useAdminSupportRealtimeSync();
  const isSupportInboxPage =
    pathname === "/dashboard/support-requests" ||
    pathname.startsWith("/dashboard/support-requests/");

  useEffect(() => {
    if (isSupportInboxPage) return;

    const activeTicketId = getActiveAdminSupportTicketId();
    if (!activeTicketId) return;

    setActiveAdminSupportTicketId(null);
    void leaveSupportChatRoom(activeTicketId);
  }, [isSupportInboxPage]);

  const portalSubtitle = user?.isPartner
    ? getPartnerPortalSubtitle(user?.referralRole)
    : "Admin";

  return (
    <ProtectedRoute>
      <AdminNotificationSoundProvider>
      <TooltipProvider delayDuration={300}>
      <div className="flex h-screen bg-background text-foreground">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex h-screen w-64 min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out lg:static lg:h-full lg:translate-x-0 lg:shrink-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="hidden border-b border-sidebar-border px-5 py-5 lg:block">
            <BrandLogo
              subtitle={portalSubtitle}
              subtitleClassName="text-sidebar-foreground/55"
            />
          </div>
          <div className="border-b border-sidebar-border px-4 py-4 lg:hidden">
            <BrandLogo
              subtitle={portalSubtitle}
              subtitleClassName="text-sidebar-foreground/55"
            />
          </div>

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {sidebarItems
              .filter((item) => {
                if (user?.isPartner) {
                  return partnerSidebarHrefs.has(item.href);
                }
                if (item.superAdminOnly && !user?.isSuperAdmin) return false;
                return true;
              })
              .map((item) => {
                const isActive = isSidebarItemActive(pathname, item.href);
                const primaryCount = item.countKey ? stats[item.countKey] : 0;
                const secondaryCount = item.secondaryCountKey
                  ? stats[item.secondaryCountKey]
                  : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="flex-1 truncate">{item.name}</span>
                    <div className="flex items-center gap-1">
                      <SupportCountBadge count={primaryCount} />
                      {secondaryCount > 0 && (
                        <SupportCountBadge count={secondaryCount} variant="secondary" />
                      )}
                    </div>
                  </Link>
                );
              })}
          </nav>

          <div className="mt-auto shrink-0 border-t border-sidebar-border px-4 pb-3 pt-3">
            <div className="mb-2 flex items-center gap-3 px-1">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
                <Users className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {formatAdminDisplayName(user?.name, user?.email) || user?.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.isPartner
                    ? getPartnerPortalSubtitle(user?.referralRole)
                    : user?.isSuperAdmin
                      ? "Super Admin"
                      : "Admin"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="relative z-10 h-9 w-full justify-start gap-3 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={logout}
            >
              <LogOut className="size-4 shrink-0" />
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
                  {isSidebarOpen ? (
                    <X className="size-5" />
                  ) : (
                    <Menu className="size-5" />
                  )}
                  <span className="sr-only">Toggle menu</span>
                </Button>
                <div className="lg:hidden">
                  <BrandLogo variant="icon" iconClassName="h-7 w-7" />
                </div>
              </div>
              {!user?.isPartner && <NotificationDropdown />}
              {user?.isPartner && (
                <NotificationDropdown
                  partnerMode
                  partnerReferralUserId={user?.referralUserId || user?.id}
                />
              )}
            </div>
          </header>

          <main
            className={cn(
              "flex-1 bg-muted/30",
              isSupportInboxPage
                ? "flex min-h-0 flex-col overflow-hidden"
                : "overflow-y-auto",
            )}
          >
            <div
              className={cn(
                "p-4 lg:p-8",
                isSupportInboxPage && "flex min-h-0 flex-1 flex-col overflow-hidden",
              )}
            >
              <PartnerRouteGuard>{children}</PartnerRouteGuard>
            </div>
          </main>
        </div>
      </div>
      </TooltipProvider>
      </AdminNotificationSoundProvider>
    </ProtectedRoute>
  );
}
