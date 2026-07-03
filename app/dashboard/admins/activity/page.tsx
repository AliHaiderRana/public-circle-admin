"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import AdminActivityGroupedPanel from "@/components/AdminActivityGroupedPanel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

function AdminActivityDetailPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const adminEmail = (searchParams.get("adminEmail") || "").trim();
  const adminName = (searchParams.get("adminName") || "").trim();
  const userType = (searchParams.get("userType") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const displayName = adminName || adminEmail;
  const isReferralUser = userType === "support_partner";
  const backHref =
    from === "referral_users"
      ? "/dashboard/third-party-users"
      : "/dashboard/admins";
  const backLabel =
    from === "referral_users" ? "Referral Users" : "Admin Users";

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin && !adminEmail) {
      router.replace("/dashboard/admins");
    }
  }, [authLoading, user, adminEmail, router]);

  if (authLoading || !user?.isSuperAdmin || !adminEmail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {isReferralUser ? (
          <>
            <span className="mx-1.5 text-border">·</span>
            Referral user
          </>
        ) : null}
      </div>

      <AdminActivityGroupedPanel
        adminEmail={adminEmail}
        adminName={adminName}
      />
    </div>
  );
}

export default function AdminActivityDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <AdminActivityDetailPageContent />
    </Suspense>
  );
}
