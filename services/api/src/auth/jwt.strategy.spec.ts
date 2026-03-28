import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { CacheService } from '../cache/cache.service';
import { CACHE_KEY_SESSION } from '../cache/cache-keys';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let cache: CacheService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => (key === 'JWT_SECRET' ? 'test-secret' : undefined)),
    };
    const mockCacheService = {
      isConfigured: jest.fn().mockReturnValue(false),
      get: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    cache = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user object when payload has sub and role (cache not configured)', async () => {
      const payload = { sub: 1, role: 'user' };
      const result = await strategy.validate(payload);
      expect(result).toEqual({
        userId: 1,
        role: 'user',
        jti: undefined,
      });
      expect(cache.get).not.toHaveBeenCalled();
    });

    it('should return user object with jti when payload has jti and cache not configured', async () => {
      const payload = { sub: 2, role: 'admin', jti: 'session-123' };
      const result = await strategy.validate(payload);
      expect(result).toEqual({
        userId: 2,
        role: 'admin',
        jti: 'session-123',
      });
      expect(cache.get).not.toHaveBeenCalled();
    });

    it('should return user object when cache configured and session exists', async () => {
      (cache.isConfigured as jest.Mock).mockReturnValue(true);
      (cache.get as jest.Mock).mockResolvedValue(JSON.stringify({ userId: 1, role: 'user' }));
      const payload = { sub: 1, role: 'user', jti: 'session-456' };
      const result = await strategy.validate(payload);
      expect(result).toEqual({
        userId: 1,
        role: 'user',
        jti: 'session-456',
      });
      expect(cache.get).toHaveBeenCalledWith(CACHE_KEY_SESSION('session-456'));
    });

    it('should return null when cache configured and session missing (revoked)', async () => {
      (cache.isConfigured as jest.Mock).mockReturnValue(true);
      (cache.get as jest.Mock).mockResolvedValue(null);
      const payload = { sub: 1, role: 'user', jti: 'revoked-session' };
      const result = await strategy.validate(payload);
      expect(result).toBeNull();
      expect(cache.get).toHaveBeenCalledWith(CACHE_KEY_SESSION('revoked-session'));
    });

    it('should return user when payload has no jti even if cache configured', async () => {
      (cache.isConfigured as jest.Mock).mockReturnValue(true);
      const payload = { sub: 3, role: 'user' };
      const result = await strategy.validate(payload);
      expect(result).toEqual({
        userId: 3,
        role: 'user',
        jti: undefined,
      });
      expect(cache.get).not.toHaveBeenCalled();
    });
  });
});
