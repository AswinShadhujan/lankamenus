import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import {
  CACHE_KEY_LOG_MAX_LENGTH,
  CACHE_PREFIX_RESTAURANTS_LIST,
  MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS,
} from './cache-keys';

function sanitizeKeyForLog(key: string): string {
  if (key.length <= CACHE_KEY_LOG_MAX_LENGTH) return key;
  return `${key.slice(0, CACHE_KEY_LOG_MAX_LENGTH)}…(len=${key.length})`;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;

  constructor(private config: ConfigService) {
    const url = this.resolveRedisUrl();
    if (!url) {
      // Optional in dev; .env.example documents REDIS_URL / REDIS_HOST.
      this.logger.debug(
        'Redis not configured — optional. Set REDIS_URL or REDIS_HOST to enable list caching.',
      );
      return;
    }
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => (times <= 3 ? 500 : null),
        lazyConnect: true,
      });
      this.client.on('error', (err) => {
        this.logger.warn(`Redis connection error: ${(err as Error).message}`);
      });
    } catch (err) {
      this.logger.warn(
        `Redis: failed to create client (${(err as Error).message})`,
      );
    }
  }

  /** Resolve redis:// URL from REDIS_URL or REDIS_HOST + REDIS_PORT. */
  private resolveRedisUrl(): string | null {
    const explicit = this.config.get<string>('REDIS_URL')?.trim();
    if (explicit) return explicit;

    const host = this.config.get<string>('REDIS_HOST')?.trim();
    if (!host) return null;

    const port = this.config.get<number>('REDIS_PORT') ?? 6379;
    return `redis://${host}:${port}`;
  }

  async onModuleDestroy() {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch (err) {
      this.logger.warn(`Redis quit: ${(err as Error).message}`);
    } finally {
      this.client = null;
    }
  }

  /** Whether Redis is configured and connected (or will connect on first use). */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Low-level Redis client. **Internal use only** (e.g. tests, ops tooling).
   * Misuse can run destructive commands (FLUSHALL, etc.).
   */
  getClient(): Redis | null {
    return this.client;
  }

  private shouldLogListKey(key: string): boolean {
    return key.startsWith(CACHE_PREFIX_RESTAURANTS_LIST);
  }

  /**
   * Get a string value. Returns null if key does not exist or Redis is not configured.
   */
  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      const val = await this.client.get(key);
      if (this.shouldLogListKey(key)) {
        const safe = sanitizeKeyForLog(key);
        if (val === null) {
          this.logger.log(`[Cache] MISS key=${safe}`);
        } else {
          this.logger.log(`[Cache] HIT key=${safe}`);
        }
      }
      return val;
    } catch (err) {
      this.logger.warn(`Redis get(${sanitizeKeyForLog(key)}): ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Set a string value with optional TTL in seconds.
   * TTL for `restaurants:list:*` keys is capped at {@link MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS}.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      const safe = sanitizeKeyForLog(key);
      let displayTtl = 'none';
      if (ttlSeconds != null && ttlSeconds > 0) {
        let ttl = Math.floor(ttlSeconds);
        if (key.startsWith(CACHE_PREFIX_RESTAURANTS_LIST)) {
          if (ttl > MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS) {
            this.logger.debug(
              `[Cache] TTL capped key=${safe} ${ttl}s → ${MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS}s`,
            );
            ttl = MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS;
          }
        }
        displayTtl = `${ttl}s`;
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      if (this.shouldLogListKey(key)) {
        this.logger.log(`[Cache] SET key=${safe} ttl=${displayTtl}`);
      }
    } catch (err) {
      this.logger.warn(`Redis set(${sanitizeKeyForLog(key)}): ${(err as Error).message}`);
    }
  }

  /**
   * Delete a key. No-op if not configured.
   */
  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Redis del(${sanitizeKeyForLog(key)}): ${(err as Error).message}`);
    }
  }

  /**
   * Delete keys matching a pattern (e.g. "restaurants:list:*"). Uses SCAN to avoid blocking.
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
      this.logger.log(
        `[Cache] INVALIDATE pattern=${sanitizeKeyForLog(pattern)}`,
      );
    } catch (err) {
      const safePattern =
        pattern.length <= CACHE_KEY_LOG_MAX_LENGTH
          ? pattern
          : `${pattern.slice(0, CACHE_KEY_LOG_MAX_LENGTH)}…(len=${pattern.length})`;
      this.logger.warn(
        `Redis delByPattern(${safePattern}): ${(err as Error).message}`,
      );
    }
  }
}
