import { AppError } from '../../core/errors/app-error.js';
import type { KnowledgeImporter } from './knowledge-importer.js';
import { KnowledgeIndexer } from './knowledge-indexer.js';
import type { KnowledgeDocument } from './knowledge-types.js';

export type SiteCrawlerInput = {
  organizationId: string;
  siteId: string;
  siteDomain: string;
  startUrl: string;
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
};

type CrawlResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers?: { get(name: string): string | null };
};

type CrawlFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<CrawlResponse>;

type ExtractedPage = {
  title: string;
  description?: string;
  content: string;
  links: string[];
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
    const startUrl = normalizeHttpUrl(input.startUrl, siteHost);
    const domain = startUrl.hostname;

    if (domain !== siteHost) {
      throw new AppError('Crawler start URL does not match site domain', {
        statusCode: 400,
        code: 'CRAWL_DOMAIN_MISMATCH'
      });
    }

    const robots = await this.loadRobots(startUrl.origin);
    const queue = [startUrl.href];
    const seen = new Set<string>();
    const discovered = new Set<string>(queue);
    const imported: SiteCrawlerSummary['imported'] = [];
    const skipped: SiteCrawlerSummary['skipped'] = [];
    const errors: string[] = [];
    let chunksCreated = 0;

    while (queue.length > 0 && imported.length + skipped.length < maxPages) {
      const url = queue.shift();
      if (!url || seen.has(url)) continue;
      seen.add(url);

      if (!robots.isAllowed(new URL(url))) {
        skipped.push({ url, reason: 'robots.txt' });
        continue;
      }

      try {
        const response = await this.fetcher(url, {
          headers: { 'user-agent': 'VISITOR-OS SiteCrawler/1.0' }
        });
        const contentType = response.headers?.get('content-type')?.toLowerCase() ?? '';

        if (!response.ok) {
          skipped.push({ url, reason: `http ${response.status}` });
          continue;
        }
        if (contentType && !contentType.includes('text/html')) {
          skipped.push({ url, reason: 'non-html' });
          continue;
        }

        const html = await response.text();
        const page = extractPage(html, url, input.now ?? new Date());
        for (const link of page.links) {
          const normalized = normalizeDiscoveredUrl(link, url, domain);
          if (normalized && !discovered.has(normalized) && discovered.size < maxPages) {
            discovered.add(normalized);
            queue.push(normalized);
          }
        }

        if (!page.content) {
          skipped.push({ url, reason: 'empty-content' });
          continue;
        }

        const chunks = this.indexer.createChunks({
          documentId: url,
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
          source: url
        });

        chunksCreated += chunks.length;
        imported.push({ url, documentId: document.id, chunks: chunks.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${url}: ${message}`);
        skipped.push({ url, reason: 'error' });
      }

      if (delayMs > 0 && queue.length > 0 && imported.length + skipped.length < maxPages) {
        await sleep(delayMs);
      }
    }

    return {
      startUrl: startUrl.href,
      domain,
      pagesDiscovered: discovered.size,
      pagesImported: imported.length,
      pagesSkipped: skipped.length,
      errors,
      documentsCreated: imported.length,
      chunksCreated,
      imported,
      skipped
    };
  }

  private async loadRobots(origin: string): Promise<{ isAllowed(url: URL): boolean }> {
    try {
      const response = await this.fetcher(`${origin}/robots.txt`, {
        headers: { 'user-agent': 'VISITOR-OS SiteCrawler/1.0' }
      });
      if (!response.ok) return allowAllRobots();

      return parseRobotsTxt(await response.text());
    } catch {
      return allowAllRobots();
    }
  }
}

function normalizeHost(domainOrUrl: string): string {
  const value = domainOrUrl.trim();
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);

  return url.hostname.toLowerCase().replace(/\.$/, '');
}

function normalizeHttpUrl(input: string, expectedHost?: string): URL {
  const url = new URL(input);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('Crawler URL must use HTTP or HTTPS', {
      statusCode: 400,
      code: 'CRAWL_INVALID_PROTOCOL'
    });
  }
  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (expectedHost && url.hostname !== expectedHost) {
    throw new AppError('Crawler URL is outside the site domain', {
      statusCode: 400,
      code: 'CRAWL_EXTERNAL_DOMAIN'
    });
  }

  return url;
}

function normalizeDiscoveredUrl(href: string, baseUrl: string, siteHost: string): string | null {
  const raw = href.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if ([...ignoredProtocols].some((protocol) => lower.startsWith(protocol))) return null;

  try {
    const url = new URL(raw, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.hostname !== siteHost) return null;

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
    links
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

function parseRobotsTxt(text: string): { isAllowed(url: URL): boolean } {
  const disallow: string[] = [];
  let applies = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;
    const [field = '', ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (field.toLowerCase() === 'user-agent') {
      applies = value === '*';
      continue;
    }
    if (applies && field.toLowerCase() === 'disallow' && value) {
      disallow.push(value);
    }
  }

  return {
    isAllowed(url: URL): boolean {
      return !disallow.some((path) => url.pathname.startsWith(path));
    }
  };
}

function allowAllRobots(): { isAllowed(url: URL): boolean } {
  return { isAllowed: () => true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
