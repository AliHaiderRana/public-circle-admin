import { cn } from '@/lib/utils';
import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'full' | 'icon';
  /** Use on dark backgrounds (login brand panel, etc.) */
  onDark?: boolean;
  /** Small label under the wordmark (e.g. Admin, Sales partner) */
  subtitle?: string;
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  subtitleClassName?: string;
};

function LogoIcon({
  onDark,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <Image
        src="/logo/logo-single.png"
        alt=""
        width={40}
        height={40}
        aria-hidden
        className={cn('h-full w-full object-contain', onDark ? 'hidden' : 'block dark:hidden')}
        priority
      />
      <Image
        src="/logo/LogoSingleDarkMode.png"
        alt=""
        width={40}
        height={40}
        aria-hidden
        className={cn(
          'h-full w-full object-contain',
          onDark ? 'block' : 'hidden dark:block',
        )}
        priority
      />
    </div>
  );
}

export function BrandLogo({
  variant = 'full',
  onDark = false,
  subtitle,
  className,
  iconClassName,
  wordmarkClassName,
  subtitleClassName,
}: BrandLogoProps) {
  if (variant === 'icon') {
    return (
      <LogoIcon onDark={onDark} className={cn('h-9 w-9', iconClassName, className)} />
    );
  }

  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-1.5', className)}>
      <div className={cn('relative h-9 w-[202px] min-w-0', wordmarkClassName)}>
        <Image
          src="/logo/PCLogo-withoutbg.png"
          alt="Public Circles"
          width={202}
          height={36}
          className={cn('h-full w-full object-contain object-left', onDark ? 'hidden' : 'block dark:hidden')}
          priority
        />
        <Image
          src="/logo/PCLogoWhitetext-original.png"
          alt="Public Circles"
          width={202}
          height={36}
          className={cn('h-full w-full object-contain object-left', onDark ? 'block' : 'hidden dark:block')}
          priority
        />
      </div>
      {subtitle ? (
        <span
          className={cn(
            'pl-11 text-[10px] font-semibold uppercase leading-none tracking-[0.14em]',
            onDark ? 'text-zinc-400' : 'text-muted-foreground',
            subtitleClassName,
          )}
        >
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}

export function getPartnerPortalSubtitle(referralRole?: string): string {
  if (referralRole === 'ADMIN') return 'Referral admin';
  if (referralRole === 'SALES_PERSON') return 'Sales partner';
  if (referralRole === 'MARKETING_AFFILIATE') return 'Marketing partner';
  return 'Partner workspace';
}
