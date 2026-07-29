'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HardDrive, Mail } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SECTIONS = [
  {
    id: 's3',
    label: 'S3 Storage',
    href: '/dashboard/aws-analytics',
    icon: HardDrive,
    match: (pathname: string) =>
      pathname === '/dashboard/aws-analytics' ||
      (pathname.startsWith('/dashboard/aws-analytics/') &&
        !pathname.startsWith('/dashboard/aws-analytics/ses')),
  },
  {
    id: 'ses',
    label: 'SES Email',
    href: '/dashboard/aws-analytics/ses',
    icon: Mail,
    match: (pathname: string) => pathname.startsWith('/dashboard/aws-analytics/ses'),
  },
] as const;

export default function AwsAnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = SECTIONS.find((s) => s.match(pathname))?.id ?? 's3';

  return (
    <div className="space-y-4">
      <Tabs value={active}>
        <TabsList>
          {SECTIONS.map(({ id, label, href, icon: Icon }) => (
            <TabsTrigger key={id} value={id} asChild>
              <Link href={href} className="inline-flex items-center gap-1.5">
                <Icon className="size-3.5" />
                {label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {children}
    </div>
  );
}
