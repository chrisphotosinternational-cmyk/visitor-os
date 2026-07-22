import { createHash, randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeImportInput,
  KnowledgeSearchInput,
  KnowledgeSearchResult,
  KnowledgeStatistics,
  KnowledgeVersion
} from './knowledge-types.js';
import { tokenizeKnowledge } from './knowledge-indexer.js';

export type KnowledgeListFilters = {
  organizationId: string;
  siteId?: string;
  search?: string;
  category?: string;
  status?: string;
};

export class KnowledgeRepository {
  constructor(private readonly database: Database) {}

  async upsertDocument(input: KnowledgeImportInput): Promise<KnowledgeDocument> {
    const hash = hashContent(input.content);
    const existing = await this.findExistingDocument(
      input.organizationId,
      input.siteId,
      hash,
      input.source
    );
    const version = existing ? existing.version + 1 : 1;
    const documentId = existing?.id ?? randomUUID();
    const result = await this.database.query<KnowledgeDocument>(
      `
      insert into knowledge_documents (
        id,
        organization_id,
        site_id,
        title,
        description,
        category,
        type,
        language,
        version,
        size_bytes,
        hash,
        status,
        tags,
        author,
        source,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, $13, $14, now())
      on conflict (id)
      do update set
        title = excluded.title,
        description = excluded.description,
        category = excluded.category,
        type = excluded.type,
        language = excluded.language,
        version = excluded.version,
        size_bytes = excluded.size_bytes,
        hash = excluded.hash,
        status = 'active',
        tags = excluded.tags,
        author = excluded.author,
        source = excluded.source,
        updated_at = now()
      returning *
      `,
      [
        documentId,
        input.organizationId,
        input.siteId ?? null,
        input.title,
        input.description ?? null,
        input.category,
        input.type,
        input.language ?? 'fr',
        version,
        Buffer.byteLength(input.content, 'utf8'),
        hash,
        input.tags ?? [],
        input.author ?? null,
        input.source ?? 'manual'
      ]
    );
    const document = requireRow(result.rows[0], 'Knowledge document was not saved');

    await this.addVersion({
      documentId: document.id,
      organizationId: document.organization_id,
      version: document.version,
      title: document.title,
      content: input.content,
      hash,
      ...(input.author ? { author: input.author } : {})
    });

    return document;
  }

  async replaceChunks(document: KnowledgeDocument, chunks: KnowledgeChunk[]): Promise<void> {
    await this.database.query(`delete from knowledge_chunks where document_id = $1`, [document.id]);

    for (const chunk of chunks) {
      await this.database.query(
        `
        insert into knowledge_chunks (
          id,
          document_id,
          organization_id,
          site_id,
          content,
          position,
          tokens,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        `,
        [
          chunk.id,
          chunk.documentId,
          chunk.organizationId,
          chunk.siteId ?? null,
          chunk.content,
          chunk.position,
          chunk.tokens,
          JSON.stringify(chunk.metadata)
        ]
      );
    }
  }

  async list(filters: KnowledgeListFilters): Promise<KnowledgeDocument[]> {
    const result = await this.database.query<KnowledgeDocument>(
      `
      select *
      from knowledge_documents d
      where d.organization_id = $1
        and ($2::uuid is null or d.site_id = $2 or d.site_id is null)
        and ($3::text is null or d.status = $3)
        and ($4::text is null or d.category = $4)
        and (
          $5::text is null
          or d.title ilike '%' || $5 || '%'
          or exists (
            select 1
            from knowledge_chunks c
            where c.document_id = d.id and c.content ilike '%' || $5 || '%'
          )
        )
      order by d.updated_at desc
      limit 200
      `,
      [
        filters.organizationId,
        filters.siteId ?? null,
        filters.status ?? null,
        filters.category ?? null,
        filters.search ?? null
      ]
    );

    return result.rows;
  }

  async find(documentId: string, organizationId: string): Promise<KnowledgeDocument | null> {
    const result = await this.database.query<KnowledgeDocument>(
      `select * from knowledge_documents where id = $1 and organization_id = $2`,
      [documentId, organizationId]
    );

    return result.rows[0] ?? null;
  }

  async versions(documentId: string, organizationId: string): Promise<KnowledgeVersion[]> {
    const result = await this.database.query<KnowledgeVersion>(
      `
      select *
      from knowledge_versions
      where document_id = $1 and organization_id = $2
      order by version desc
      `,
      [documentId, organizationId]
    );

    return result.rows;
  }

  async archive(documentId: string, organizationId: string): Promise<KnowledgeDocument | null> {
    const result = await this.database.query<KnowledgeDocument>(
      `
      update knowledge_documents
      set status = 'archived', updated_at = now()
      where id = $1 and organization_id = $2
      returning *
      `,
      [documentId, organizationId]
    );

    return result.rows[0] ?? null;
  }

  async delete(documentId: string, organizationId: string): Promise<boolean> {
    const result = await this.database.query(
      `
      update knowledge_documents
      set status = 'deleted', updated_at = now()
      where id = $1 and organization_id = $2
      `,
      [documentId, organizationId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult[]> {
    const tokens = tokenizeKnowledge(input.query);
    if (tokens.length === 0) return [];

    const result = await this.database.query<{
      document_id: string;
      title: string;
      content: string;
      category: string;
      language: string;
      source: string;
      score: string;
    }>(
      `
      select
        d.id as document_id,
        d.title,
        c.content,
        d.category,
        d.language,
        d.source,
        (
          (
            select count(*)
            from unnest(c.tokens) token
            where token = any($3::text[])
          ) * 0.22
          + case when d.title ilike '%' || $4 || '%' then 0.35 else 0 end
          + case when $4 = any(d.tags) then 0.25 else 0 end
        )::text as score
      from knowledge_chunks c
      join knowledge_documents d on d.id = c.document_id
      where d.organization_id = $1
        and ($2::uuid is null or d.site_id = $2 or d.site_id is null)
        and d.status = 'active'
        and ($5::text is null or d.language = $5)
        and ($7::text is null or d.category = $7)
        and ($8::text[] is null or d.tags && $8::text[])
        and (
          c.tokens && $3::text[]
          or d.title ilike '%' || $4 || '%'
          or $4 = any(d.tags)
        )
      order by (
        (
          select count(*)
          from unnest(c.tokens) token
          where token = any($3::text[])
        ) * 0.22
        + case when d.title ilike '%' || $4 || '%' then 0.35 else 0 end
        + case when $4 = any(d.tags) then 0.25 else 0 end
      ) desc, d.updated_at desc
      limit $6
      `,
      [
        input.organizationId,
        input.siteId ?? null,
        tokens,
        input.query,
        input.language ?? null,
        input.limit ?? 5,
        input.category ?? null,
        input.tags && input.tags.length > 0 ? input.tags : null
      ]
    );

    const searchId = randomUUID();
    await this.database.query(
      `
      insert into knowledge_search_events (
        id,
        organization_id,
        site_id,
        query,
        result_count
      )
      values ($1, $2, $3, $4, $5)
      `,
      [searchId, input.organizationId, input.siteId ?? null, input.query, result.rows.length]
    );

    if (result.rows[0]) {
      await this.database.query(
        `update knowledge_documents set usage_count = usage_count + 1 where id = $1`,
        [result.rows[0].document_id]
      );
    }

    return result.rows.map((row) => {
      const score = Math.min(0.98, Number(row.score));

      return {
        documentId: row.document_id,
        title: row.title,
        content: row.content,
        category: row.category,
        language: row.language,
        score,
        relevance: score >= 0.7 ? 'high' : score >= 0.45 ? 'medium' : 'low',
        source: row.source
      };
    });
  }

  async statistics(organizationId: string, siteId?: string): Promise<KnowledgeStatistics> {
    const result = await this.database.query<{
      documents: string;
      total_size_bytes: string;
      searches: string;
      consulted_documents: string;
      never_used_documents: string;
    }>(
      `
      select
        count(*)::text as documents,
        coalesce(sum(size_bytes), 0)::text as total_size_bytes,
        (select count(*)::text from knowledge_search_events e where e.organization_id = $1) as searches,
        count(*) filter (where usage_count > 0)::text as consulted_documents,
        count(*) filter (where usage_count = 0)::text as never_used_documents
      from knowledge_documents d
      where d.organization_id = $1
        and ($2::uuid is null or d.site_id = $2 or d.site_id is null)
        and d.status <> 'deleted'
      `,
      [organizationId, siteId ?? null]
    );
    const categoryResult = await this.database.query<{ category: string; count: string }>(
      `
      select category, count(*)::text as count
      from knowledge_documents
      where organization_id = $1
        and ($2::uuid is null or site_id = $2 or site_id is null)
        and status <> 'deleted'
      group by category
      order by count(*) desc, category asc
      `,
      [organizationId, siteId ?? null]
    );
    const row = result.rows[0];

    return {
      documents: Number(row?.documents ?? 0),
      totalSizeBytes: Number(row?.total_size_bytes ?? 0),
      categories: categoryResult.rows.map((category) => ({
        category: category.category,
        count: Number(category.count)
      })),
      searches: Number(row?.searches ?? 0),
      consultedDocuments: Number(row?.consulted_documents ?? 0),
      neverUsedDocuments: Number(row?.never_used_documents ?? 0)
    };
  }

  private async addVersion(input: {
    documentId: string;
    organizationId: string;
    version: number;
    title: string;
    content: string;
    hash: string;
    author?: string;
  }): Promise<void> {
    await this.database.query(
      `
      insert into knowledge_versions (
        id,
        document_id,
        organization_id,
        version,
        title,
        content,
        hash,
        author
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        randomUUID(),
        input.documentId,
        input.organizationId,
        input.version,
        input.title,
        input.content,
        input.hash,
        input.author ?? null
      ]
    );
  }

  private async findExistingDocument(
    organizationId: string,
    siteId: string | undefined,
    hash: string,
    source?: string
  ): Promise<KnowledgeDocument | null> {
    const result = await this.database.query<KnowledgeDocument>(
      `
      select *
      from knowledge_documents
      where organization_id = $1
        and ($2::uuid is null or site_id = $2)
        and (
          hash = $3
          or ($4::text like 'file:%' and source = $4)
        )
        and status <> 'deleted'
      order by updated_at desc
      limit 1
      `,
      [documentId, input.organizationId, input.siteId ?? null, input.query, result.rows.length]
    );

    return result.rows[0] ?? null;
  }
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new Error(message);
  }

  return row;
}
