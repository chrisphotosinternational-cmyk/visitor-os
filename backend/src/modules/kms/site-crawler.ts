import { AppError } from '../../core/errors/app-error.js';
import type { KnowledgeImporter } from './knowledge-importer.js';
import { KnowledgeIndexer } from './knowledge-indexer.js';
import type { KnowledgeDocument } from './knowledge-types.js';

export type SiteCrawlerInput = {
  organizationId: string;
  siteId: string;
  siteDomain: string;
  startUrl: string;
  startUrls?: string[];
  maxPages?: number;
  delayMs?: number;
  now?: Date;
};

export type SiteCrawlerSummary = {
  startUrl: string;
  domain: string;
  pagesDiscovered: number;
  pagesImported: number;
  pagesSkipped: number;
  errors: string[];
  documentsCreated: number;
  chunksCreated: number;
  imported: Array<{ url: string; documentId: string; chunks: number }>;
  skipped: Array<{ url: string; reason: string }>;
  urls: SiteCrawlerUrlReport[];
  sitemapUrlCount: number;
  discoveredUrlCount: number;
  crawledUrlCount: number;
  importedUrlCount: number;
  skippedUrlCount: number;
  errorUrlCount: number;
  sitemapCoveragePercent: number | null;
};

export type SiteCrawlerUrlReport = {
  initialUrl: string;
  finalUrl: string;
  status: number | null;
  crawlStatus: 'imported' | 'skipped' | 'error';
  reason: string;
  chunks: number;
  title: string;
  canonical: string;
  crawledAt: string;
};

type CrawlResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers?: { get(name: string): string | null };
  url?: string;
};

type CrawlFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<CrawlResponse>;

type ExtractedPage = {
  title: string;
  description?: string;
  content: string;
  links: string[];
  canonical?: string;
};

const defaultMaxPages = 50;
const defaultDelayMs = 250;
const ignoredProtocols = new Set(['mailto:', 'tel:', 'javascript:', 'data:', 'ftp:']);

export class SiteCrawlerService {
  constructor(
    private readonly importer: KnowledgeImporter,
    private readonly fetcher: CrawlFetch = globalThis.fetch,
    private readonly indexer = new KnowledgeIndexer()
  ) {}

  async crawl(input: SiteCrawlerInput): Promise<SiteCrawlerSummary> {
    const maxPages = Math.max(1, Math.min(input.maxPages ?? defaultMaxPages, 250));
    const delayMs = Math.max(0, input.delayMs ?? defaultDelayMs);
    const siteHost = normalizeHost(input.siteDomain);
    const primaryStartUrl = normalizeHttpUrl(input.startUrl, siteHost, siteHost);
    const allowedHosts = allowedHostVariants(siteHost);
    const startUrls = [input.startUrl, ...(input.startUrls ?? [])].map((url) =>
      normalizeHttpUrl(url, siteHost, siteHost, allowedHosts).href
    );
    const domain = primaryStartUrl.hostname;

    if (domain !== siteHost) {
      throw new AppError('Crawler start URL does not match site domain', {
        statusCode: 400,
        code: 'CRAWL_DOMAIN_MISMATCH'
      });
    }

    const robots = await this.loadRobots(primaryStartUrl.origin, siteHost, allowedHosts);
    const sitemapUrls = await this.discoverSitemapUrls(primaryStartUrl.origin, siteHost, allowedHosts, robots.sitemaps);
    const sitemapSet = new Set(sitemapUrls);
    const queue: string[] = [];
    const seen = new Set<string>();
    const discovered = new Set<string>();
    const imported: SiteCrawlerSummary['imported'] = [];
    const skipped: SiteCrawlerSummary['skipped'] = [];
    const reports: SiteCrawlerUrlReport[] = [];
    const errors: string[] = [];
    let chunksCreated = 0;

    const enqueue = (url: string): void => {
      if (discovered.has(url) || discovered.size >= maxPages) return;
      discovered.add(url);
      queue.push(url);
      queue.sort(compareUrlPriority);
    };

    for (const url of [...sitemapUrls, ...startUrls]) enqueue(url);

    while (queue.length > 0 && reports.length < maxPages) {
      const url = queue.shift();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const crawledAt = (input.now ?? new Date()).toISOString();

      if (!robots.isAllowed(new URL(url))) {
        skipped.push({ url, reason: 'robots.txt' });
        reports.push(urlReport(url, url, null, 'skipped', 'robots.txt', 0, '', '', crawledAt));
        continue;
      }

      try {
        const response = await this.fetcher(url, {
          headers: { 'user-agent': 'VISITOR-OS SiteCrawler/1.0' }
        });
        const finalUrl = normalizeRedirectUrl(response.url ?? url, url, siteHost, allowedHosts);
        if (!finalUrl) {
          skipped.push({ url, reason: 'external-redirect' });
          reports.push(urlReport(url, response.url ?? url, response.status, 'skipped', 'external-redirect', 0, '', '', crawledAt));
          continue;
        }
        const contentType = response.headers?.get('content-type')?.toLowerCase() ?? '';

        if (!response.ok) {
          const reason = `http ${response.status}`;
          skipped.push({ url: finalUrl, reason });
          reports.push(urlReport(url, finalUrl, response.status, 'skipped', reason, 0, '', '', crawledAt));
          continue;
        }
        if (contentType && !contentType.includes('text/html')) {
          skipped.push({ url: finalUrl, reason: 'non-html' });
          reports.push(urlReport(url, finalUrl, response.status, 'skipped', 'non-html', 0, '', '', crawledAt));
          continue;
        }

        const html = await response.text();
        const page = extractPage(html, finalUrl, input.now ?? new Date());
        const canonical = normalizeCanonicalUrl(page.canonical, finalUrl, siteHost, allowedHosts) ?? finalUrl;
        for (const link of page.links) {
          const normalized = normalizeDiscoveredUrl(link, finalUrl, siteHost, allowedHosts);
          if (normalized) enqueue(normalized);
        }

        if (!page.content) {
          skipped.push({ url: finalUrl, reason: 'empty-content' });
          reports.push(urlReport(url, finalUrl, response.status, 'skipped', 'empty-content', 0, page.title, canonical, crawledAt));
          continue;
        }

        const chunks = this.indexer.createChunks({
          documentId: finalUrl,
          organizationId: input.organizationId,
          siteId: input.siteId,
          content: page.content
        });
        const document: KnowledgeDocument = await this.importer.import({
          organizationId: input.organizationId,
          siteId: input.siteId,
          title: page.title,
          ...(page.description ? { description: page.description } : {}),
          category: 'website',
          type: 'html',
          content: page.content,
          tags: ['website-crawl', domain],
          source: canonical
        });

        chunksCreated += chunks.length;
        imported.push({ url: finalUrl, documentId: document.id, chunks: chunks.length });
        reports.push(urlReport(url, finalUrl, response.status, 'imported', 'imported', chunks.length, page.title, canonical, crawledAt));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${url}: ${message}`);
        skipped.push({ url, reason: 'error' });
        reports.push(urlReport(url, url, null, 'error', message, 0, '', '', crawledAt));
      }

      if (delayMs > 0 && queue.length > 0 && reports.length < maxPages) {
        await sleep(delayMs);
      }
    }

    const sitemapUrlCount = sitemapSet.size;
    const crawledSitemapUrls = reports.filter((report) => sitemapSet.has(report.initialUrl) || sitemapSet.has(report.finalUrl)).length;

    return {
      startUrl: primaryStartUrl.href,
      domain,
      pagesDiscovered: discovered.size,
      pagesImported: imported.length,
      pagesSkipped: skipped.length,
      errors,
      documentsCreated: imported.length,
      chunksCreated,
      imported,
      skipped,
      urls: reports,
      sitemapUrlCount,
      discoveredUrlCount: discovered.size,
      crawledUrlCount: reports.length,
      importedUrlCount: reports.filter((report) => report.crawlStatus === 'imported').length,
      skippedUrlCount: reports.filter((report) => report.crawlStatus === 'skipped').length,
      errorUrlCount: reports.filter((report) => report.crawlStatus === 'error').length,
      sitemapCoveragePercent: sitemapUrlCount > 0 ? Math.round((crawledSitemapUrls / sitemapUrlCount) * 100) : null
    };
  }

  private async loadRobots(
    origin: string,
    canonicalHost: string,
    allowedHosts: Set<string>
  ): Promise<{ isAllowed(url: URL): boolean; sitemaps: string[] }> {
    try {
      const response = await this.fetcher(`${origin}/robots.txt`, {
        headers: { 'user-agent': 'VISITOR-OS SiteCrawler/1.0' }
      });
      if (!response.ok) return allowAllRobots();

      return parseRobotsTxt(await response.text(), origin, canonicalHost, allowedHosts);
    } catch {
      return allowAllRobots();
    }
  }

  private async discoverSitemapUrls(
    origin: string,
    canonicalHost: string,
    allowedHosts: Set<string>,
    robotsSitemaps: string[]
  ): Promise<string[]> {
    const sitemapLocations = new Set([
      ...robotsSitemaps,
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`
    ]);
    const urls = new Set<string>();
    const visitedSitemaps = new Set<string>();
    const visit = async (sitemapUrl: string): Promise<void> => {
      const normalizedSitemapUrl = normalizeCanonicalUrl(sitemapUrl, origin, canonicalHost, allowedHosts);
      if (!normalizedSitemapUrl || visitedSitemaps.has(normalizedSitemapUrl)) return;
      visitedSitemaps.add(normalizedSitemapUrl);
      try {
        const response = await this.fetcher(normalizedSitemapUrl, {
          headers: { 'user-agent': 'VISITOR-OS SiteCrawler/1.0' }
        });
        if (!response.ok) return;
        const parsed = parseSitemapXml(await response.text(), normalizedSitemapUrl, canonicalHost, allowedHosts);
        for (const childSitemap of parsed.sitemaps) await visit(childSitemap);
        for (const url of parsed.urls) urls.add(url);
      } catch {
        return;
      }
    };

    for (const sitemapUrl of sitemapLocations) await visit(sitemapUrl);

    return [...urls].sort(compareUrlPriority);
  }
}

function normalizeHost(domainOrUrl: string): string {
  const value = domainOrUrl.trim();
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);

  return url.hostname.toLowerCase().replace(/\.$/, '');
}

function originalHost(input: string): string {
  return new URL(input).hostname.toLowerCase().replace(/\.$/, '');
}

function allowedHostVariants(host: string): Set<string> {
  const normalized = host.toLowerCase().replace(/\.$/, '');
  const withoutWww = normalized.replace(/^www\./, '');
  return new Set([normalized, withoutWww, `www.${withoutWww}`]);
}

function normalizeUrlInPlace(url: URL, canonicalHost?: string): void {
  url.hash = '';
  if (canonicalHost) url.hostname = canonicalHost;
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
}

function normalizeRedirectUrl(
  responseUrl: string,
  requestedUrl: string,
  canonicalHost: string,
  allowedHosts: Set<string>
): string | null {
  try {
    const url = new URL(responseUrl, requestedUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!allowedHosts.has(url.hostname.toLowerCase().replace(/\.$/, ''))) return null;
    normalizeUrlInPlace(url, canonicalHost);
    return url.href;
  } catch {
    return null;
  }
}

function normalizeCanonicalUrl(
  href: string | undefined,
  baseUrl: string,
  canonicalHost: string,
  allowedHosts: Set<string>
): string | null {
  if (!href) return null;
  return normalizeRedirectUrl(href, baseUrl, canonicalHost, allowedHosts);
}

function normalizeHttpUrl(
  input: string,
  expectedHost?: string,
  canonicalHost = expectedHost,
  allowedHosts = expectedHost ? allowedHostVariants(expectedHost) : undefined
): URL {
  const url = new URL(input);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('Crawler URL must use HTTP or HTTPS', {
      statusCode: 400,
      code: 'CRAWL_INVALID_PROTOCOL'
    });
  }
  normalizeUrlInPlace(url, canonicalHost);
  if (expectedHost && !(allowedHosts ?? new Set([expectedHost])).has(originalHost(input))) {
    throw new AppError('Crawler URL is outside the site domain', {
      statusCode: 400,
      code: 'CRAWL_EXTERNAL_DOMAIN'
    });
  }

  return url;
}

function normalizeDiscoveredUrl(
  href: string,
  baseUrl: string,
  siteHost: string,
  allowedHosts = allowedHostVariants(siteHost)
): string | null {
  const raw = href.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if ([...ignoredProtocols].some((protocol) => lower.startsWith(protocol))) return null;

  try {
    const url = new URL(raw, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!allowedHosts.has(url.hostname.toLowerCase().replace(/\.$/, ''))) return null;
    normalizeUrlInPlace(url, siteHost);

    return url.href;
  } catch {
    return null;
  }
}

function extractPage(html: string, url: string, crawledAt: Date): ExtractedPage {
  const links = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) =>
    decodeHtml(match[1] ?? '')
  );
  const jsonLd = extractJsonLd(html);
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(nav|footer|header|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const title = firstText(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i) || firstTagText(withoutNoise, 'h1') || url;
  const description = firstAttribute(html, /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const canonical = firstAttribute(html, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i);
  const sections = [
    `URL: ${url}`,
    `Crawled at: ${crawledAt.toISOString()}`,
    `Title: ${title}`,
    description ? `Description: ${description}` : '',
    ...tagTexts(withoutNoise, 'h1').map((text) => `H1: ${text}`),
    ...tagTexts(withoutNoise, 'h2').map((text) => `H2: ${text}`),
    ...tagTexts(withoutNoise, 'h3').map((text) => `H3: ${text}`),
    ...tagTexts(withoutNoise, 'p'),
    ...tagTexts(withoutNoise, 'li').map((text) => `- ${text}`),
    ...extractTables(withoutNoise),
    ...jsonLd
  ];

  return {
    title: compactWhitespace(title).slice(0, 240),
    ...(description ? { description: compactWhitespace(description).slice(0, 1000) } : {}),
    content: dedupeLines(sections).join('\n\n'),
    links,
    ...(canonical ? { canonical } : {})
  };
}

function extractJsonLd(html: string): string[] {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const lines: string[] = [];
  for (const block of blocks) {
    const raw = decodeHtml(block[1] ?? '').trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      for (const item of flattenJsonLd(parsed)) {
        const type = jsonLdType(item);
        if (type.includes('FAQPage')) {
          lines.push(...faqLines(item));
        }
        if (type.includes('LocalBusiness')) {
          lines.push(...localBusinessLines(item));
        }
      }
    } catch {
      continue;
    }
  }

  return lines;
}

function flattenJsonLd(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!isRecord(value)) return [];
  const items = [value];
  const graph = value['@graph'];
  if (Array.isArray(graph)) items.push(...graph.filter(isRecord));

  return items;
}

function jsonLdType(item: Record<string, unknown>): string[] {
  const type = item['@type'];
  if (Array.isArray(type)) return type.map((value) => scalarToString(value)).filter(Boolean);
  return type ? [scalarToString(type)] : [];
}

function faqLines(item: Record<string, unknown>): string[] {
  const entities = item.mainEntity;
  if (!Array.isArray(entities)) return [];

  return entities.flatMap((entity) => {
    if (!isRecord(entity)) return [];
    const question = compactWhitespace(scalarToString(entity.name));
    const acceptedAnswer = entity.acceptedAnswer;
    const answer = isRecord(acceptedAnswer)
      ? compactWhitespace(stripTags(scalarToString(acceptedAnswer.text)))
      : '';
    if (!question && !answer) return [];

    return [`FAQ Question: ${question}\nFAQ Answer: ${answer}`];
  });
}

function localBusinessLines(item: Record<string, unknown>): string[] {
  const lines = [
    item.name ? `LocalBusiness name: ${scalarToString(item.name)}` : '',
    item.telephone ? `LocalBusiness phone: ${scalarToString(item.telephone)}` : '',
    item.email ? `LocalBusiness email: ${scalarToString(item.email)}` : '',
    item.priceRange ? `LocalBusiness price range: ${scalarToString(item.priceRange)}` : '',
    item.address ? `LocalBusiness address: ${flattenValue(item.address)}` : '',
    item.areaServed ? `LocalBusiness area served: ${flattenValue(item.areaServed)}` : ''
  ];

  return lines.filter(Boolean).map(compactWhitespace);
}

function extractTables(html: string): string[] {
  return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((match) => compactWhitespace(stripTags(match[1] ?? '')))
    .filter(Boolean)
    .map((text) => `Table: ${text}`);
}

function tagTexts(html: string, tag: string): string[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))]
    .map((match) => compactWhitespace(stripTags(match[1] ?? '')))
    .filter(Boolean);
}

function firstTagText(html: string, tag: string): string {
  return tagTexts(html, tag)[0] ?? '';
}

function firstText(html: string, pattern: RegExp): string {
  return compactWhitespace(stripTags(html.match(pattern)?.[1] ?? ''));
}

function firstAttribute(html: string, pattern: RegExp): string | undefined {
  const value = html.match(pattern)?.[1];
  return value ? compactWhitespace(decodeHtml(value)) : undefined;
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '));
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function compactKnowledgeBlock(value: string): string {
  return value
    .split(/\r?\n/)
    .map(compactWhitespace)
    .filter(Boolean)
    .join('\n');
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const line of lines.map(compactKnowledgeBlock).filter(Boolean)) {
    const key = compactWhitespace(line).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(line);
  }

  return deduped;
}

function flattenValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(flattenValue).filter(Boolean).join(', ');
  if (isRecord(value)) return Object.values(value).map(flattenValue).filter(Boolean).join(', ');
  return scalarToString(value);
}

function scalarToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }
  return '';
}

function parseRobotsTxt(
  text: string,
  origin: string,
  canonicalHost: string,
  allowedHosts: Set<string>
): { isAllowed(url: URL): boolean; sitemaps: string[] } {
  const disallow: string[] = [];
  const sitemaps: string[] = [];
  let applies = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;
    const [field = '', ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const fieldName = field.toLowerCase();
    if (fieldName === 'user-agent') {
      applies = value === '*';
      continue;
    }
    if (applies && fieldName === 'disallow' && value) {
      disallow.push(value);
    }
    if (fieldName === 'sitemap') {
      const sitemap = normalizeCanonicalUrl(value, origin, canonicalHost, allowedHosts);
      if (sitemap) sitemaps.push(sitemap);
    }
  }

  return {
    sitemaps,
    isAllowed(url: URL): boolean {
      return !disallow.some((path) => url.pathname.startsWith(path));
    }
  };
}

function parseSitemapXml(
  xml: string,
  baseUrl: string,
  canonicalHost: string,
  allowedHosts: Set<string>
): { urls: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1] ?? '').trim())
    .filter(Boolean);
  const isIndex = /<sitemapindex\b/i.test(xml);
  const normalized = locs
    .map((loc) => normalizeCanonicalUrl(loc, baseUrl, canonicalHost, allowedHosts))
    .filter((url): url is string => Boolean(url));

  return isIndex ? { urls: [], sitemaps: normalized } : { urls: normalized, sitemaps: [] };
}

function urlReport(
  initialUrl: string,
  finalUrl: string,
  status: number | null,
  crawlStatus: 'imported' | 'skipped' | 'error',
  reason: string,
  chunks: number,
  title: string,
  canonical: string,
  crawledAt: string
): SiteCrawlerUrlReport {
  return { initialUrl, finalUrl, status, crawlStatus, reason, chunks, title, canonical, crawledAt };
}

const priorityTerms = ['faq', 'questions', 'tarifs', 'forfaits', 'retouches', 'studio', 'couple', 'shooting', 'confidentialite'];

function compareUrlPriority(a: string, b: string): number {
  return urlPriority(b) - urlPriority(a) || a.localeCompare(b);
}

function urlPriority(url: string): number {
  const normalized = decodeURIComponent(normalizeHostSafe(url)).toLowerCase();
  return priorityTerms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

function normalizeHostSafe(value: string): string {
  try {
    const url = new URL(value);
    return `${url.pathname} ${url.search}`;
  } catch {
    return value;
  }
}

function allowAllRobots(): { isAllowed(url: URL): boolean; sitemaps: string[] } {
  return { isAllowed: () => true, sitemaps: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
