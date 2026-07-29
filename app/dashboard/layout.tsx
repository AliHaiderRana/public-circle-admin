"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import PartnerRouteGuard from "@/components/PartnerRouteGuard";
import { BrandLogo, getPartnerPortalSubtitle } from "@/components/BrandLogo";
import NotificationDropdown from "@/components/NotificationDropdown";
import { AdminNotificationSoundProvider } from "@/components/AdminNotificationSoundProvider";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  ChevronDown,
  Link2,
  Database,
  Cloud,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type SidebarChildItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type SidebarItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
  countKey?:
    | "unreadChatMessages"
    | "openSupportRequests"
    | "pendingCustomerRequests";
  secondaryCountKey?:
    | "unreadChatMessages"
    | "openSupportRequests"
    | "pendingCustomerRequests";
  children?: SidebarChildItem[];
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
    children: [
      {
        name: "Customer Portal",
        href: "/dashboard/integrations",
        icon: Link2,
      },
    ],
  },
  {
    name: "DB Analytics",
    href: "/dashboard/db-analytics",
    icon: Database,
    superAdminOnly: true,
  },
  {
    name: "AWS Analytics",
    href: "/dashboard/aws-analytics",
    icon: Cloud,
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

  const userDisplayName =
    formatAdminDisplayName(user?.name, user?.email) || user?.email || "";
  const userInitials = userDisplayName
    .split(/\s+/)
    .map((word: string) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const userRoleLabel = user?.isPartner
    ? getPartnerPortalSubtitle(user?.referralRole)
    : user?.isSuperAdmin
      ? "Super Admin"
      : "Admin";

  const sidebarContent = (
    <>
      <div className="hidden h-16 shrink-0 items-center border-b border-sidebar-border px-5 lg:flex">
        <BrandLogo
          subtitle={portalSubtitle}
          subtitleClassName="text-sidebar-foreground/55"
        />
      </div>
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4 lg:hidden">
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
            const primaryCount =
              (item.countKey ? stats[item.countKey] : 0) ?? 0;
            const secondaryCount =
              (item.secondaryCountKey ? stats[item.secondaryCountKey] : 0) ?? 0;

            if (item.children?.length) {
              const hasActiveChild = item.children.some((child) =>
                isSidebarItemActive(pathname, child.href),
              );

              return (
                <Collapsible
                  key={item.href}
                  defaultOpen={hasActiveChild}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-full justify-start gap-3 px-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <item.icon className="size-5 shrink-0" />
                      <span className="flex-1 truncate text-left">
                        {item.name}
                      </span>
                      <ChevronDown className="size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                      {item.children.map((child) => {
                        const childActive = isSidebarItemActive(
                          pathname,
                          child.href,
                        );
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                              childActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                            onClick={() => setIsSidebarOpen(false)}
                          >
                            <child.icon className="size-4 shrink-0" />
                            <span className="truncate">{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            }

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
                    <SupportCountBadge
                      count={secondaryCount}
                      variant="secondary"
                    />
                  )}
                </div>
              </Link>
            );
          })}
      </nav>

      <div className="mt-auto shrink-0 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-md p-1.5">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="text-xs font-semibold">
              {userInitials || <Users className="size-4" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">
              {userDisplayName}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {userRoleLabel}
              {user?.email && user.email !== userDisplayName
                ? ` · ${user.email}`
                : ""}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                onClick={logout}
              >
                <LogOut className="size-4" />
                <span className="sr-only">Logout</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Logout</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );

  return (
    <ProtectedRoute>
      <AdminNotificationSoundProvider>
        <TooltipProvider delayDuration={300}>
          <div className="flex h-screen bg-background text-foreground">
            <aside className="hidden w-64 min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:h-full lg:shrink-0">
              {sidebarContent}
            </aside>

            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetContent
                side="left"
                className="w-64 gap-0 bg-sidebar p-0 text-sidebar-foreground"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation menu</SheetTitle>
                </SheetHeader>
                {sidebarContent}
              </SheetContent>
            </Sheet>

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
                  <div className="flex items-center gap-1">
                    <ThemeToggle />
                    {!user?.isPartner && <NotificationDropdown />}
                    {user?.isPartner && (
                      <NotificationDropdown
                        partnerMode
                        partnerReferralUserId={user?.referralUserId || user?.id}
                      />
                    )}
                  </div>
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
                    isSupportInboxPage &&
                      "flex min-h-0 flex-1 flex-col overflow-hidden",
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
