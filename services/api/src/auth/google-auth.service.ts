import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { Logger } from '@nestjs/common';

export interface GoogleTokenPayload {
  email: string;
  email_verified: boolean;
  google_id: string; // sub
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly client: OAuth2Client | null = null;
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;

  constructor(private config: ConfigService) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (this.clientId) {
      this.client = new OAuth2Client(
        this.clientId,
        this.clientSecret ?? undefined,
        undefined,
      );
    }
  }

  isConfigured(): boolean {
    return !!this.client && !!this.clientId;
  }

  /** True when code exchange (e.g. for mobile) is available; requires client secret. */
  isCodeExchangeConfigured(): boolean {
    return !!this.client && !!this.clientId && !!this.clientSecret;
  }

  /**
   * Verify Google ID token and extract claims.
   * Validates: signature, expiration, audience (GOOGLE_CLIENT_ID), email_verified.
   */
  async verifyIdToken(idToken: string): Promise<GoogleTokenPayload> {
    if (!this.client || !this.clientId) {
      throw new UnauthorizedException('Google Sign-In is not configured');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      const email = payload.email;
      const emailVerified = payload.email_verified === true;
      const sub = payload.sub;

      if (!email || !sub) {
        throw new UnauthorizedException('Google token missing email or sub');
      }

      if (!emailVerified) {
        throw new UnauthorizedException('Google email is not verified');
      }

      return {
        email,
        email_verified: emailVerified,
        google_id: sub,
        name: payload.name ?? undefined,
        picture: payload.picture ?? undefined,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.warn(`Google token verification failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new UnauthorizedException('Invalid or expired Google token');
    }
  }

  /**
   * Exchange authorization code (from mobile OAuth flow) for id_token, then verify and return payload.
   * Requires GOOGLE_CLIENT_SECRET.
   */
  async exchangeCodeForIdToken(code: string, redirectUri: string): Promise<GoogleTokenPayload> {
    if (!this.client || !this.clientId || !this.clientSecret) {
      throw new UnauthorizedException('Google code exchange is not configured');
    }
    try {
      const { tokens } = await this.client.getToken({ code, redirect_uri: redirectUri });
      const idToken = tokens.id_token;
      if (!idToken) {
        throw new UnauthorizedException('Google did not return an ID token');
      }
      return this.verifyIdToken(idToken);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn(`Google code exchange failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new UnauthorizedException('Invalid or expired authorization code');
    }
  }
}
