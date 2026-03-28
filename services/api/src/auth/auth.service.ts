import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from '../cache/cache.service';
import { CACHE_KEY_SESSION, SESSION_TTL_SECONDS } from '../cache/cache-keys';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import { GoogleAuthService, GoogleTokenPayload } from './google-auth.service';

const PROVIDER_EMAIL = 'email';
const PROVIDER_GOOGLE = 'google';

/** Max length for avatar_url (e.g. from Google picture) to avoid unbounded storage. */
const MAX_AVATAR_URL_LENGTH = 2048;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cache: CacheService,
    private googleAuth: GoogleAuthService,
  ) {}

  async register(email: string, password: string, name?: string) {
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const u = await tx.users.create({
          data: {
            email,
            password: hashedPassword,
            name,
          },
        });
        await tx.auth_providers.create({
          data: {
            provider: PROVIDER_EMAIL,
            provider_id: email,
            user_id: u.id,
          },
        });
        return u;
      });
      return this.issueToken(user);
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`Login failed: no user for email "${email}"`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.password == null) {
      this.logger.warn(`Login failed: user "${email}" has no password (Google-only account)`);
      throw new UnauthorizedException('Use Google to sign in');
    }

    if (!(await bcrypt.compare(password, user.password))) {
      this.logger.warn(`Login failed: invalid credentials for email "${email}"`);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.ensureEmailProvider(user.id, email);
    return this.issueToken(user);
  }

  /** Ensure an auth_provider record exists for email login (for backward compatibility). */
  private async ensureEmailProvider(userId: number, email: string): Promise<void> {
    const existing = await this.prisma.auth_providers.findUnique({
      where: {
        provider_provider_id: { provider: PROVIDER_EMAIL, provider_id: email },
      },
    });
    if (!existing) {
      await this.prisma.auth_providers.create({
        data: {
          provider: PROVIDER_EMAIL,
          provider_id: email,
          user_id: userId,
        },
      });
    }
  }

  /**
   * Authenticate with Google ID token (web).
   * Verifies token then resolves/links/creates user.
   */
  async googleLogin(idToken: string) {
    const payload = await this.googleAuth.verifyIdToken(idToken);
    return this.resolveGooglePayload(payload);
  }

  /**
   * Authenticate with Google authorization code (mobile OAuth flow).
   * Exchanges code for id_token then resolves/links/creates user.
   */
  async googleLoginWithCode(code: string, redirectUri: string) {
    const payload = await this.googleAuth.exchangeCodeForIdToken(code, redirectUri);
    return this.resolveGooglePayload(payload);
  }

  /**
   * Resolve user from verified Google payload: find by provider, link by email, or create.
   */
  private async resolveGooglePayload(payload: GoogleTokenPayload) {
    const byProvider = await this.prisma.auth_providers.findUnique({
      where: {
        provider_provider_id: { provider: PROVIDER_GOOGLE, provider_id: payload.google_id },
      },
      include: { user: true },
    });

    if (byProvider) {
      this.logger.log('[Auth] Google login success');
      return this.issueToken(byProvider.user);
    }

    const byEmail = await this.prisma.users.findUnique({
      where: { email: payload.email },
    });

    if (byEmail) {
      try {
        await this.prisma.auth_providers.create({
          data: {
            provider: PROVIDER_GOOGLE,
            provider_id: payload.google_id,
            user_id: byEmail.id,
          },
        });
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
          const existing = await this.prisma.auth_providers.findUnique({
            where: {
              provider_provider_id: { provider: PROVIDER_GOOGLE, provider_id: payload.google_id },
            },
            include: { user: true },
          });
          if (existing) {
            this.logger.log('[Auth] Google login success (provider already linked)');
            return this.issueToken(existing.user);
          }
        }
        throw err;
      }
      this.logger.log('[Auth] Existing account linked to Google');
      const avatarUrl = payload.picture != null
        ? payload.picture.slice(0, MAX_AVATAR_URL_LENGTH)
        : undefined;
      const updated = await this.prisma.users.update({
        where: { id: byEmail.id },
        data: {
          ...(payload.name != null && { name: payload.name }),
          ...(avatarUrl !== undefined && { avatar_url: avatarUrl }),
        },
      });
      return this.issueToken(updated);
    }

    const avatarUrl = payload.picture != null
      ? payload.picture.slice(0, MAX_AVATAR_URL_LENGTH)
      : null;
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.users.create({
        data: {
          email: payload.email,
          password: null,
          name: payload.name ?? null,
          avatar_url: avatarUrl,
        },
      });
      await tx.auth_providers.create({
        data: {
          provider: PROVIDER_GOOGLE,
          provider_id: payload.google_id,
          user_id: u.id,
        },
      });
      return u;
    });
    this.logger.log('[Auth] New user created via Google');
    return this.issueToken(user);
  }

  private issueToken(user: { id: number; email: string; role: string }) {
    const payload = {
      sub: user.id,
      role: user.role,
    };
    const sessionId = randomUUID();
    const accessToken = this.jwt.sign(payload, { jwtid: sessionId });

    if (this.cache.isConfigured()) {
      this.cache
        .set(
          CACHE_KEY_SESSION(sessionId),
          JSON.stringify({
            userId: user.id,
            email: user.email,
            role: user.role,
          }),
          SESSION_TTL_SECONDS,
        )
        .catch(() => {});
    }

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Return current user by id (for GET /auth/me). Returns null if user not found.
   */
  async getMe(userId: number): Promise<{ id: number; email: string; name: string | null; avatar_url: string | null; role: string } | null> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatar_url: true, role: true },
    });
    return user;
  }

  /** Revoke session (logout). No-op if Redis not configured. Does not throw if Redis fails. */
  async logout(sessionId: string | undefined): Promise<{ ok: boolean }> {
    if (!sessionId || !this.cache.isConfigured()) {
      return { ok: true };
    }
    try {
      await this.cache.del(CACHE_KEY_SESSION(sessionId));
    } catch {
      // Redis down or del failed; still report ok so client can clear token
    }
    return { ok: true };
  }
}
