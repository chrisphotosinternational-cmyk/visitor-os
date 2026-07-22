import { inflateRawSync } from 'node:zlib';
import type {
  KnowledgeDocumentType,
  KnowledgeExtractionResult,
  KnowledgeFileImportInput
} from './knowledge-types.js';

type KnowledgeFileExtractionInput = Omit<KnowledgeFileImportInput, 'siteId'> & {
  siteId?: string;
};

const textTypes = ['txt', 'markdown'] as const;

export class KnowledgeDocumentExtractor {
  extract(input: KnowledgeFileExtractionInput): KnowledgeExtractionResult {
    const detectedType = input.type ?? detectDocumentType(input.fileName, input.mimeType);
    const rawText = input.data.toString('utf8');
    const warnings: string[] = [];
    let text = '';
    let title: string | undefined = input.title;
    let author: string | undefined = input.author;
    let pageCount: number | undefined;
    let rowCount: number | undefined;

    if (textTypes.includes(detectedType as (typeof textTypes)[number])) {
      text = rawText;
    } else if (detectedType === 'html') {
      text = extractHtmlText(rawText);
    } else if (detectedType === 'csv') {
      const csv = extractCsvText(rawText);
      text = csv.text;
      rowCount = csv.rowCount;
    } else if (detectedType === 'json') {
      text = extractJsonText(rawText);
    } else if (detectedType === 'pdf') {
      const pdf = extractPdfText(input.data);
      text = pdf.text;
      title ??= pdf.title;
      author ??= pdf.author;
      pageCount = pdf.pageCount;
      warnings.push(...pdf.warnings);
    } else if (detectedType === 'docx') {
      const docx = extractDocxText(input.data);
      text = docx.text;
      title ??= docx.title;
      author ??= docx.author;
      warnings.push(...docx.warnings);
    } else {
      throw new Error(`Unsupported knowledge document type: ${detectedType}`);
    }

    const cleanedText = normalizeExtractedText(text);
    if (!cleanedText) {
      throw new Error(`No text could be extracted from ${input.fileName}`);
    }

    return {
      text: cleanedText,
      metadata: {
        fileName: input.fileName,
        ...(input.mimeType ? { mimeType: input.mimeType } : {}),
        detectedType,
        ...(title ? { title: normalizeExtractedText(title).slice(0, 240) } : {}),
        ...(author ? { author: normalizeExtractedText(author).slice(0, 120) } : {}),
        ...(pageCount ? { pageCount } : {}),
        ...(rowCount ? { rowCount } : {}),
        sizeBytes: input.data.byteLength
      },
      warnings
    };
  }
}

export function detectDocumentType(fileName: string, mimeType?: string): KnowledgeDocumentType {
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'md' || extension === 'markdown') return 'markdown';
  if (extension === 'txt') return 'txt';
  if (extension === 'html' || extension === 'htm') return 'html';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'docx';
  if (extension === 'csv') return 'csv';
  if (extension === 'json') return 'json';

  if (mimeType?.includes('markdown')) return 'markdown';
  if (mimeType?.includes('text/plain')) return 'txt';
  if (mimeType?.includes('text/html')) return 'html';
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.includes('wordprocessingml')) return 'docx';
  if (mimeType?.includes('csv')) return 'csv';
  if (mimeType?.includes('json')) return 'json';

  throw new Error(`Unable to detect document type for ${fileName}`);
}

function extractHtmlText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function extractCsvText(value: string): { text: string; rowCount: number } {
  const rows = parseCsv(value);
  const text = rows.map((row) => row.filter(Boolean).join(' | ')).join('\n');

  return { text, rowCount: rows.length };
}

function extractJsonText(value: string): string {
  const parsed = JSON.parse(value) as unknown;

  return flattenJson(parsed).join('\n');
}

function flattenJson(value: unknown, path = ''): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [`${path ? `${path}: ` : ''}${String(value)}`];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenJson(item, `${path}[${index}]`));
  }
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      flattenJson(item, path ? `${path}.${key}` : key)
    );
  }

  return [];
}

function extractPdfText(buffer: Buffer): {
  text: string;
  warnings: string[];
  title?: string;
  author?: string;
  pageCount?: number;
} {
  const warnings: string[] = [];
  const raw = buffer.toString('latin1');
  const streamTexts = extractPdfStreams(raw, warnings);
  const directText = extractPdfTextOperators(raw);
  const text = [...streamTexts, ...directText].join('\n');
  const title = extractPdfMetadata(raw, 'Title');
  const author = extractPdfMetadata(raw, 'Author');
  const pageCount = (raw.match(/\/Type\s*\/Page\b/g) ?? []).length || undefined;

  if (!text.trim()) {
    warnings.push('PDF extraction is limited to readable text streams and simple text operators.');
  }

  return {
    text,
    warnings,
    ...(title ? { title } : {}),
    ...(author ? { author } : {}),
    ...(pageCount ? { pageCount } : {})
  };
}

function extractPdfStreams(raw: string, warnings: string[]): string[] {
  const texts: string[] = [];
  const streamRegex = /<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(raw)) !== null) {
    const dictionary = match[1] ?? '';
    const stream = match[2] ?? '';
    if (!dictionary.includes('/FlateDecode')) continue;

    try {
      const inflated = inflateRawSync(Buffer.from(stream, 'latin1')).toString('latin1');
      texts.push(...extractPdfTextOperators(inflated));
    } catch {
      warnings.push('A compressed PDF stream could not be inflated.');
    }
  }

  return texts;
}

function extractPdfTextOperators(raw: string): string[] {
  const texts: string[] = [];
  const literalRegex = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const arrayRegex = /\[(.*?)\]\s*TJ/g;
  const hexRegex = /<([0-9a-fA-F\s]+)>\s*Tj/g;
  let match: RegExpExecArray | null;

  while ((match = literalRegex.exec(raw)) !== null) {
    texts.push(decodePdfLiteral(match[0].replace(/\)\s*Tj$/, '').slice(1)));
  }
  while ((match = arrayRegex.exec(raw)) !== null) {
    const content = match[1] ?? '';
    const parts = [...content.matchAll(/\((?:\\.|[^\\)])*\)/g)].map((part) =>
      decodePdfLiteral(part[0].slice(1, -1))
    );
    if (parts.length > 0) texts.push(parts.join(''));
  }
  while ((match = hexRegex.exec(raw)) !== null) {
    texts.push(decodePdfHex(match[1] ?? ''));
  }

  return texts;
}

function extractPdfMetadata(raw: string, key: string): string | undefined {
  const match = new RegExp(`/${key}\\s*\\((.*?)\\)`).exec(raw);

  return match?.[1] ? decodePdfLiteral(match[1]) : undefined;
}

function extractDocxText(buffer: Buffer): {
  text: string;
  warnings: string[];
  title?: string;
  author?: string;
} {
  const warnings: string[] = [];
  const files = readZipEntries(buffer, warnings);
  const documentXml = files.get('word/document.xml');
  if (!documentXml) {
    throw new Error('DOCX document.xml is missing');
  }
  const coreXml = files.get('docProps/core.xml')?.toString('utf8');
  const xml = documentXml.toString('utf8');
  const text = [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeHtmlEntities(match[1] ?? ''))
    .join(' ');
  const title = coreXml ? extractXmlTag(coreXml, 'dc:title') : undefined;
  const author = coreXml ? extractXmlTag(coreXml, 'dc:creator') : undefined;

  return {
    text,
    warnings,
    ...(title ? { title } : {}),
    ...(author ? { author } : {})
  };
}

function readZipEntries(buffer: Buffer, warnings: string[]): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let offset = 0;

  while (offset + 30 < buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const fileName = buffer.subarray(offset + 30, offset + 30 + fileNameLength).toString('utf8');
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const compressed = buffer.subarray(dataStart, dataEnd);

    if (compression === 0) {
      files.set(fileName, compressed);
    } else if (compression === 8) {
      files.set(fileName, inflateRawSync(compressed));
    } else {
      warnings.push(`Unsupported DOCX zip compression method ${compression} for ${fileName}.`);
    }

    offset = dataEnd;
    if (uncompressedSize === 0 && compressedSize === 0) offset += 1;
  }

  return files;
}

function parseCsv(value: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((item) => item.some(Boolean));
}

function extractXmlTag(xml: string, tag: string): string | undefined {
  const escaped = tag.replace(':', '\\:');
  const match = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`).exec(xml);

  return match?.[1] ? decodeHtmlEntities(match[1]) : undefined;
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\([()\\])/g, '$1');
}

function decodePdfHex(value: string): string {
  const hex = value.replace(/\s+/g, '');
  const bytes: number[] = [];
  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(Number.parseInt(hex.slice(index, index + 2).padEnd(2, '0'), 16));
  }

  return Buffer.from(bytes).toString('utf8');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function normalizeExtractedText(value: string): string {
  return value
    .split(String.fromCharCode(0))
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
