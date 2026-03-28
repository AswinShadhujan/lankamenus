import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

const COOLDOWN_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const ENTRY_MAX_AGE_MS = COOLDOWN_MS * 5;

@Injectable()
export class MenuItemClickTrackerService implements OnModuleDestroy {
  private readonly tracker = new Map<string, number>();
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private readonly jwtService: JwtService) {
    this.cleanupInterval = setInterval(() => this.pruneStaleEntries(), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }

  /**
   * Returns true if click_count should be incremented (cooldown consumed).
   * Returns false when the same dish was clicked recently for this client.
   */
  async shouldIncrementClick(itemId: number, req: Request): Promise<boolean> {
    const userIdentifier = await this.resolveUserIdentifier(req);
    const key = `${itemId}:${userIdentifier}`;
    const now = Date.now();
    const lastClick = this.tracker.get(key);
    if (lastClick !== undefined && now - lastClick < COOLDOWN_MS) {
      return false;
    }
    this.tracker.set(key, now);
    return true;
  }

  private pruneStaleEntries(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.tracker.entries()) {
      if (now - timestamp > ENTRY_MAX_AGE_MS) {
        this.tracker.delete(key);
      }
    }
  }

  private async resolveUserIdentifier(req: Request): Promise<string> {
    const auth = req.headers?.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const token = auth.slice(7).trim();
      if (token) {
        try {
          const payload = await this.jwtService.verifyAsync<{ sub?: number }>(token);
          if (payload?.sub != null && Number.isFinite(Number(payload.sub))) {
            return String(payload.sub);
          }
        } catch {
          // Invalid or expired token — fall back to IP
        }
      }
    }
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return ip;
  }
}
