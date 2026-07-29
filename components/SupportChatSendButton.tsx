import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SupportChatSendButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  className?: string;
  iconClassName?: string;
  variant?: 'default' | 'secondary';
};

/**
 * Lucide Send paths with a small left/down nudge so round stroke caps at the
 * top-right tip don't make the glyph look shifted up-right in a circle.
 */
function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('block shrink-0', className)}
      aria-hidden
    >
      <g transform="translate(-0.85 0.65)">
        <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
        <path d="m21.854 2.147-10.94 10.939" />
      </g>
    </svg>
  );
}

export function SupportChatSendButton({
  onClick,
  disabled,
  loading,
  title,
  className,
  iconClassName = 'size-4',
  variant = 'default',
}: SupportChatSendButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      aria-label={title}
      className={cn('rounded-full', className)}
    >
      {loading ? (
        <Loader2 className={cn(iconClassName, 'animate-spin')} aria-hidden />
      ) : (
        <SendIcon className={iconClassName} />
      )}
    </Button>
  );
}
