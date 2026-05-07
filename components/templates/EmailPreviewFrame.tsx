'use client';

import { useEffect, useMemo, useRef } from 'react';

export type PreviewMode = 'desktop' | 'mobile';

type EmailPreviewFrameProps = {
  html: string;
  mode: PreviewMode;
  mobileHeight?: number | string;
  desktopAutoHeight?: boolean;
  desktopHeight?: number | string;
};

function buildDocument(rawHtml: string, mode: PreviewMode) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml || '', 'text/html');
  const html = doc.documentElement;
  const head = doc.head || doc.createElement('head');
  const body = doc.body || doc.createElement('body');

  if (!doc.head) {
    html.insertBefore(head, body);
  }

  body.classList.add(mode === 'mobile' ? 'force-mobile' : 'force-desktop');

  if (mode === 'mobile') {
    const scope = doc.querySelector('.hide-desktop') || doc;
    scope.querySelectorAll('span').forEach((span) => {
      const text = (span.textContent || '').replace(/\u00a0/g, ' ').trim();
      if (text === '•' || text === '.') {
        span.remove();
      }
    });
  }

  const meta = doc.createElement('meta');
  meta.setAttribute('name', 'viewport');
  meta.setAttribute('content', 'width=device-width,initial-scale=1,maximum-scale=1');
  head.appendChild(meta);

  const style = doc.createElement('style');
  style.textContent = `
    .force-desktop .hide-desktop { display: none !important; }
    .force-desktop .hide-mobile { display: block !important; }
    .force-mobile .hide-mobile { display: none !important; }
    .force-mobile .hide-desktop { display: block !important; }

    html, body { margin: 0; padding: 0; }
    img { max-width: 100% !important; height: auto !important; }
    table { border-collapse: collapse; }

    .force-mobile .u-row, .force-mobile [class*="u-col-"], .force-mobile .u-col {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
    }

    .force-mobile [style*="min-width: 600px"] { min-width: 0 !important; }
    .force-mobile [style*="max-width: 600px"] { max-width: 100% !important; }
    .force-mobile [style*="width: 600px"] { width: 100% !important; }
    .force-mobile [width="600"], .force-mobile [width="580"],
    .force-mobile [width="300"], .force-mobile [width="229"] { width: 100% !important; }

    .force-mobile table, .force-mobile tbody, .force-mobile tr, .force-mobile td {
      max-width: 100% !important;
    }

    .force-mobile td { word-break: break-word; }
    .hide-mobile .footer-poweredby { white-space: nowrap !important; }
    .force-mobile .separator-dot { display: none !important; }
  `;
  head.appendChild(style);

  return `<!doctype html>\n${html.outerHTML}`;
}

export default function EmailPreviewFrame({
  html,
  mode,
  mobileHeight = 720,
  desktopAutoHeight = true,
  desktopHeight,
}: EmailPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const src = useMemo(() => buildDocument(html, mode), [html, mode]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (!(mode === 'desktop' && desktopAutoHeight)) return;

    const onLoad = () => {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      requestAnimationFrame(() => {
        const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
        iframe.style.height = `${height}px`;
      });
    };

    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [src, mode, desktopAutoHeight]);

  const iframeWidth = mode === 'mobile' ? 375 : 600;
  const mobileViewportHeight = typeof mobileHeight === 'number' ? `${mobileHeight}px` : mobileHeight;
  const explicitDesktopHeight =
    mode === 'desktop' && !desktopAutoHeight && desktopHeight !== undefined
      ? typeof desktopHeight === 'number'
        ? `${desktopHeight}px`
        : desktopHeight
      : undefined;

  if (mode === 'mobile') {
    return (
      <div
        style={{
          width: iframeWidth + 24,
          maxWidth: '100%',
          height: mobileViewportHeight,
          maxHeight: '100%',
          background: '#333',
          padding: 12,
          borderRadius: 34,
          boxShadow: '0 6px 24px rgba(0,0,0,.25)',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 120,
            height: 18,
            background: '#000',
            borderRadius: 10,
            zIndex: 2,
          }}
        />
        <iframe
          ref={iframeRef}
          title="Email Preview (Mobile)"
          scrolling="yes"
          style={{
            width: iframeWidth,
            maxWidth: '100%',
            height: '100%',
            border: 0,
            borderRadius: 22,
            overflow: 'auto',
            background: '#fff',
            display: 'block',
            flex: 1,
          }}
          srcDoc={src}
        />
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title="Email Preview (Desktop)"
      scrolling={explicitDesktopHeight ? 'yes' : 'no'}
      style={{
        width: iframeWidth,
        height: explicitDesktopHeight,
        border: '1px solid #ddd',
        borderRadius: 8,
        overflow: explicitDesktopHeight ? 'auto' : 'hidden',
        background: '#fff',
        display: 'block',
      }}
      srcDoc={src}
    />
  );
}
