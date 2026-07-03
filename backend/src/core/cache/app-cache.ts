export type CacheStats = {
  enabled: boolean;
  keys: number;
  hits: number;
  misses: number;
  invalidations: number;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  tags: Set<string>;
};

export class AppCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private invalidations = 0;

  constructor(
    private readonly options: {
      enabled: boolean;
      defaultTtlMs: number;
    }
  ) {}

  async getOrSet<T>(
    key: string,
    tags: string[],
    producer: () => Promise<T>,
    ttlMs = this.options.defaultTtlMs
  ): Promise<T> {
    if (!this.options.enabled || ttlMs <= 0) return producer();

    const now = Date.now();
    const existing = this.entries.get(key) as CacheEntry<T> | undefined;
    if (existing && existing.expiresAt > now) {
      this.hits += 1;
      return existing.value;
    }

    if (existing) this.entries.delete(key);
    this.misses += 1;
    const value = await producer();
    this.entries.set(key, {
      value,
      expiresAt: now + ttlMs,
      tags: new Set(tags)
    });

    return value;
  }

  invalidateTags(tags: string[]): number {
    if (tags.length === 0) return 0;

    let deleted = 0;
    for (const [key, entry] of this.entries.entries()) {
      if (tags.some((tag) => entry.tags.has(tag))) {
        this.entries.delete(key);
        deleted += 1;
      }
    }

    this.invalidations += deleted;
    return deleted;
  }

  clear(): void {
    this.invalidations += this.entries.size;
    this.entries.clear();
  }

  stats(): CacheStats {
    this.pruneExpired();

    return {
      enabled: this.options.enabled,
      keys: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations
    };
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
