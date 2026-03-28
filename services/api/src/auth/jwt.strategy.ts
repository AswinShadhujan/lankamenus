import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CacheService } from '../cache/cache.service';
import { CACHE_KEY_SESSION } from '../cache/cache-keys';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private cache: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: number; role?: string; jti?: string }) {
    if (payload.jti && this.cache.isConfigured()) {
      const session = await this.cache.get(CACHE_KEY_SESSION(payload.jti));
      if (!session) {
        return null;
      }
    }
    return {
      userId: payload.sub,
      role: payload.role,
      jti: payload.jti,
    };
  }
}
