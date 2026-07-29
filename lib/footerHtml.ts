const PUBLIC_CIRCLES_LOGO_URL =
  'https://public-circle-production.s3.ca-central-1.amazonaws.com/PCLogoWhitetext.png';
const FOOTER_LOGO_HEIGHT = 33;
const FOOTER_LOGO_WIDTH = 161;
const FOOTER_LOGO_IMG_STYLE = `height:${FOOTER_LOGO_HEIGHT}px !important; width:auto !important; max-height:${FOOTER_LOGO_HEIGHT}px !important; border:0; display:block; -ms-interpolation-mode:bicubic;`;

export function extractContentWidthFromHtml(html: string | null | undefined): number {
  if (!html || typeof html !== 'string') return 600;

  const normalizedHtml = html.trim();
  if (!normalizedHtml) return 600;

  const bounded = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return 600;
    return Math.max(320, Math.min(1200, value));
  };

  const readNumeric = (raw: string | undefined | null): number | null => {
    if (!raw) return null;
    const match = raw.match(/(\d{2,4})/);
    if (!match) return null;
    const parsed = parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const widthPatterns: RegExp[] = [
    /class=["'][^"']*(?:es-content-body|es-header-body|es-footer-body)[^"']*["'][^>]*\bwidth=["']?(\d{2,4})/i,
    /class=["'][^"']*(?:row-content|u-row|bee-row-content|bee-row)[^"']*["'][^>]*\bwidth=["']?(\d{2,4})/i,
    /\b(?:max-width|width)\s*:\s*(\d{2,4})px\b/i,
  ];

  for (const pattern of widthPatterns) {
    const match = normalizedHtml.match(pattern);
    const parsed = readNumeric(match?.[1]);
    if (parsed) return bounded(parsed);
  }

  return 600;
}

export function generateFooterHtml(
  showPoweredBy: boolean,
  includeUnSubscriber: boolean,
  contentWidth = 600
): string {
  if (!showPoweredBy && !includeUnSubscriber) {
    return '';
  }

  const poweredByInline = showPoweredBy
    ? `<span style="display:inline-block; vertical-align:middle;"><span style="vertical-align:middle;">Powered by</span><a href="https://publiccircles.com" target="_blank" style="display:inline-block; vertical-align:middle; text-decoration:none; margin-left:6px;"><img src="${PUBLIC_CIRCLES_LOGO_URL}" alt="Public Circles" width="${FOOTER_LOGO_WIDTH}" height="${FOOTER_LOGO_HEIGHT}" style="${FOOTER_LOGO_IMG_STYLE}"></a></span>`
    : '';

  const unsubscribeInline = includeUnSubscriber
    ? `<span style="display:inline-block; vertical-align:middle;"><a href="{{unsubscribe}}" style="color:#ffffff; text-decoration:underline; vertical-align:middle;">Unsubscribe</a><span style="color:#ffffff;"> from Emails</span></span>`
    : '';

  const desktopInnerTable = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto; border-collapse:collapse; width:auto;"><tr>${showPoweredBy ? `<td valign="middle" style="padding:0; vertical-align:middle !important; color:#ffffff; font-family:'Cabin', Arial, sans-serif; font-size:14px; line-height:1.4; white-space:nowrap;">Powered by</td><td valign="middle" style="padding:0 0 0 6px; vertical-align:middle !important; line-height:0;"><a href="https://publiccircles.com" target="_blank" style="display:inline-block; text-decoration:none; vertical-align:middle;"><img src="${PUBLIC_CIRCLES_LOGO_URL}" alt="Public Circles" width="${FOOTER_LOGO_WIDTH}" height="${FOOTER_LOGO_HEIGHT}" style="${FOOTER_LOGO_IMG_STYLE}"></a></td>` : ''}${showPoweredBy && includeUnSubscriber ? `<td valign="middle" style="padding:0 8px; vertical-align:middle !important; line-height:1.4;"><span style="display:inline-block; width:4px; height:4px; background-color:#ffffff; border-radius:2px; vertical-align:middle;"></span></td>` : ''}${includeUnSubscriber ? `<td valign="middle" style="padding:0; vertical-align:middle !important; color:#ffffff; font-family:'Cabin', Arial, sans-serif; font-size:14px; line-height:1.4; white-space:nowrap;"><a href="{{unsubscribe}}" style="color:#ffffff; text-decoration:underline;">Unsubscribe</a><span style="color:#ffffff;"> from Emails</span></td>` : ''}</tr></table>`;

  return `<!--PC-FOOTER-START--><style>@media only screen and (max-width: 599px) {.pc-footer-desktop {display: none !important;max-height: 0 !important;overflow: hidden !important;mso-hide: all !important;}.pc-footer-mobile {display: block !important;max-height: none !important;overflow: visible !important;}}</style><div class="footer-content-wrapper" style="margin: 0 auto; padding: 0; width: 100%; max-width: ${contentWidth}px; box-sizing: border-box;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${contentWidth}" align="center" style="background-color: black;"><tr><td align="center" style="padding: 10px; background-color: black;"><![endif]--><table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="width: 100%; max-width: ${contentWidth}px; border-spacing: 0; background-color: black; color: #ffffff; font-family: 'Cabin', Arial, sans-serif; table-layout: fixed; margin: 0 auto; padding: 0; box-sizing: border-box;"><tr><td align="center" style="padding:10px 12px; margin:0; width:100%; box-sizing:border-box;"><div class="pc-footer-desktop" style="display:block; text-align:center; font-family:'Cabin', Arial, sans-serif; font-size:14px; line-height:1.4; color:#ffffff;">${desktopInnerTable}</div><div class="pc-footer-mobile" style="display:none; max-height:0; overflow:hidden; mso-hide:all; text-align:center;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto; border-collapse:collapse; width:auto;">${showPoweredBy ? `<tr><td align="center" style="padding:0; font-family:'Cabin', Arial, sans-serif; font-size:14px; line-height:1.3; color:#ffffff; white-space:nowrap;">${poweredByInline}</td></tr>` : ''}${includeUnSubscriber ? `<tr><td align="center" style="padding:${showPoweredBy ? '4px 0 0 0' : '0'}; font-family:'Cabin', Arial, sans-serif; font-size:14px; line-height:1.4; color:#ffffff; white-space:nowrap;">${unsubscribeInline}</td></tr>` : ''}</table></div></td></tr></table><!--[if mso | IE]></td></tr></table><![endif]--></div><!--PC-FOOTER-END-->`;
}
