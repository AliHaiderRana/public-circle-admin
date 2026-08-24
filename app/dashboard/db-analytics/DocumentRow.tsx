'use client';

import { useMemo } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { formatBytes, formatCount } from './format';

const DOC_JSON_TRUNCATE_AT = 20_000;

export function DocumentRow({ doc }: { doc: Record<string, unknown> }) {
  const id = doc._id != null ? String(doc._id) : '(no _id)';
  const sizeBytes = typeof doc.__sizeBytes === 'number' ? doc.__sizeBytes : null;
  const json = useMemo(() => {
    const { __sizeBytes: _omit, ...rest } = doc;
    const full = JSON.stringify(rest, null, 2);
    if (full.length <= DOC_JSON_TRUNCATE_AT) return { text: full, truncated: false };
    return { text: full.slice(0, DOC_JSON_TRUNCATE_AT), truncated: true };
  }, [doc]);

  const preview = useMemo(() => {
    const keys = Object.keys(doc).filter((k) => k !== '_id' && k !== '__sizeBytes');
    return keys.slice(0, 6).join(', ') + (keys.length > 6 ? ', …' : '');
  }, [doc]);

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-left transition-colors hover:bg-muted/50 [&[data-state=open]>svg]:rotate-90"
        >
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform" />
          <span className="shrink-0 font-mono text-xs">{id}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {preview}
          </span>
          {sizeBytes !== null && (
            <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums">
              {formatBytes(sizeBytes)}
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-96 overflow-y-auto border-b bg-muted/30">
          <pre className="whitespace-pre-wrap break-all p-4 font-mono text-[11px] leading-relaxed">
            {json.text}
          </pre>
        </div>
        {json.truncated && (
          <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
            Output truncated at {formatCount(DOC_JSON_TRUNCATE_AT)} characters.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
