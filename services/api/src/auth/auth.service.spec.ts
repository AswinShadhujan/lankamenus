import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from '../cache/cache.service';
import { GoogleAuthService } from './google-auth.service';
import { CACHE_KEY_SESSION, SESSION_TTL_SECONDS } from '../cache/cache-keys';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;
  let cache: CacheService;
  let mockGoogleAuth: { verifyIdToken: jest.Mock; isConfigured: jest.Mock };
  let mockTx: {
    users: { create: jest.Mock };
    auth_providers: { create: jest.Mock };
  };

  const mockUser = {
    id: 1,
    email: 'user@test.com',
    password: 'hashed',
    name: 'Test User',
    role: 'user',
  };

  beforeEach(async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const mockPrisma = {
      users: {
        create: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
      },
      auth_providers: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        mockTx = {
          users: { create: jest.fn().mockResolvedValue(mockUser) },
          auth_providers: { create: jest.fn().mockResolvedValue(undefined) },
        };
        return cb(mockTx);
      }),
    };
    const mockJwt = {
      sign: jest.fn().mockReturnValue('fake-jwt-token'),
    };
    const mockCache = {
      isConfigured: jest.fn().mockReturnValue(false),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    mockGoogleAuth = {
      verifyIdToken: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: CacheService, useValue: mockCache },
        { provide: GoogleAuthService, useValue: mockGoogleAuth },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
    cache = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create user, auth_provider, and return accessToken and user', async () => {
      const result = await service.register('user@test.com', 'password', 'Test User');
      expect(bcrypt.hash).toHaveBeenCalledWith('password', 10);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.users.create).toHaveBeenCalledWith({
        data: {
          email: 'user@test.com',
          password: 'hashed',
          name: 'Test User',
        },
      });
      expect(mockTx.auth_providers.create).toHaveBeenCalledWith({
        data: { provider: 'email', provider_id: 'user@test.com', user_id: mockUser.id },
      });
      expect(result).toHaveProperty('accessToken', 'fake-jwt-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, role: mockUser.role },
        expect.objectContaining({ jwtid: expect.any(String) }),
      );
    });

    it('should throw ConflictException when email already registered', async () => {
      const err = new PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '1',
      });
      (prisma.$transaction as jest.Mock).mockRejectedValue(err);
      await expect(
        service.register('existing@test.com', 'password'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.register('existing@test.com', 'password'),
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue(null);
      await expect(
        service.login('nobody@test.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login('nobody@test.com', 'password'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when user has no password (Google-only)', async () => {
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue({ ...mockUser, password: null } as never);
      await expect(
        service.login('user@test.com', 'any'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login('user@test.com', 'any'),
      ).rejects.toThrow('Use Google to sign in');
    });

    it('should throw UnauthorizedException when password invalid', async () => {
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue(mockUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login('user@test.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return accessToken and user when credentials valid', async () => {
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue(mockUser as never);
      jest.spyOn(prisma.auth_providers, 'findUnique').mockResolvedValue(null);
      const result = await service.login('user@test.com', 'password');
      expect(result).toHaveProperty('accessToken', 'fake-jwt-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, role: mockUser.role },
        expect.objectContaining({ jwtid: expect.any(String) }),
      );
    });

    it('should call cache.set with session when cache is configured', async () => {
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue(mockUser as never);
      (cache.isConfigured as jest.Mock).mockReturnValue(true);
      (jwt.sign as jest.Mock).mockImplementation((_payload, opts) => {
        return `token-${opts?.jwtid ?? 'no-jti'}`;
      });
      await service.login('user@test.com', 'password');
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^session:[a-f0-9-]+$/),
        JSON.stringify({
          userId: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        }),
        SESSION_TTL_SECONDS,
      );
    });

    it('should not call cache.set when cache is not configured', async () => {
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue(mockUser as never);
      (cache.isConfigured as jest.Mock).mockReturnValue(false);
      await service.login('user@test.com', 'password');
      expect(cache.set).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('should return user (id, email, name, avatar_url, role) when user exists', async () => {
      const meUser = { id: 1, email: 'user@test.com', name: 'Test User', avatar_url: null, role: 'user' };
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue(meUser as never);
      const result = await service.getMe(1);
      expect(prisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, email: true, name: true, avatar_url: true, role: true },
      });
      expect(result).toEqual(meUser);
    });

    it('should return null when user not found', async () => {
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue(null);
      const result = await service.getMe(999);
      expect(result).toBeNull();
    });
  });

  describe('googleLogin', () => {
    const googlePayload = {
      email: 'google@test.com',
      email_verified: true,
      google_id: 'google-sub-123',
      name: 'Google User',
      picture: 'https://lh3.google.com/photo.jpg',
    };

    it('should login when AuthProvider(google, google_id) exists', async () => {
      const linkedUser = { id: 2, email: 'google@test.com', name: 'Google User', role: 'user' };
      mockGoogleAuth.verifyIdToken.mockResolvedValue(googlePayload);
      jest.spyOn(prisma.auth_providers, 'findUnique').mockResolvedValue({
        id: 1,
        provider: 'google',
        provider_id: 'google-sub-123',
        user_id: 2,
        user: linkedUser,
      } as never);

      const result = await service.googleLogin('id-token');

      expect(mockGoogleAuth.verifyIdToken).toHaveBeenCalledWith('id-token');
      expect(prisma.auth_providers.findUnique).toHaveBeenCalledWith({
        where: { provider_provider_id: { provider: 'google', provider_id: 'google-sub-123' } },
        include: { user: true },
      });
      expect(result).toHaveProperty('accessToken', 'fake-jwt-token');
      expect(result.user).toEqual({ id: linkedUser.id, email: linkedUser.email, role: linkedUser.role });
      expect(prisma.users.findUnique).not.toHaveBeenCalled();
    });

    it('should link Google provider to existing user by email and return token', async () => {
      mockGoogleAuth.verifyIdToken.mockResolvedValue(googlePayload);
      jest.spyOn(prisma.auth_providers, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue({
        id: 3,
        email: 'google@test.com',
        password: 'hashed',
        name: 'Existing',
        role: 'user',
      } as never);
      jest.spyOn(prisma.users, 'update').mockResolvedValue({
        id: 3,
        email: 'google@test.com',
        name: 'Google User',
        role: 'user',
      } as never);

      const result = await service.googleLogin('id-token');

      expect(prisma.auth_providers.create).toHaveBeenCalledWith({
        data: { provider: 'google', provider_id: 'google-sub-123', user_id: 3 },
      });
      expect(prisma.users.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { name: 'Google User', avatar_url: 'https://lh3.google.com/photo.jpg' },
      });
      expect(result.accessToken).toBe('fake-jwt-token');
      expect(result.user.id).toBe(3);
    });

    it('should create new user and Google provider when no existing user', async () => {
      mockGoogleAuth.verifyIdToken.mockResolvedValue(googlePayload);
      jest.spyOn(prisma.auth_providers, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue(null);
      const newUser = { id: 10, email: 'google@test.com', password: null, name: 'Google User', role: 'user' };
      let capturedTx: { users: { create: jest.Mock }; auth_providers: { create: jest.Mock } };
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        capturedTx = {
          users: { create: jest.fn().mockResolvedValue(newUser) },
          auth_providers: { create: jest.fn().mockResolvedValue(undefined) },
        };
        return cb(capturedTx);
      });

      const result = await service.googleLogin('id-token');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(capturedTx!.users.create).toHaveBeenCalledWith({
        data: {
          email: 'google@test.com',
          password: null,
          name: 'Google User',
          avatar_url: 'https://lh3.google.com/photo.jpg',
        },
      });
      expect(capturedTx!.auth_providers.create).toHaveBeenCalledWith({
        data: { provider: 'google', provider_id: 'google-sub-123', user_id: newUser.id },
      });
      expect(result.user.id).toBe(10);
    });

    it('should handle P2002 on provider create (race) by re-fetching and returning token', async () => {
      mockGoogleAuth.verifyIdToken.mockResolvedValue(googlePayload);
      jest.spyOn(prisma.auth_providers, 'findUnique')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 1,
          provider: 'google',
          provider_id: 'google-sub-123',
          user_id: 4,
          user: { id: 4, email: 'google@test.com', name: 'User', role: 'user' },
        } as never);
      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue({
        id: 4,
        email: 'google@test.com',
        password: null,
        name: 'User',
        role: 'user',
      } as never);
      const p2002 = new PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '1' });
      jest.spyOn(prisma.auth_providers, 'create').mockRejectedValue(p2002);

      const result = await service.googleLogin('id-token');

      expect(prisma.auth_providers.findUnique).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('fake-jwt-token');
      expect(result.user.id).toBe(4);
    });
  });

  describe('logout', () => {
    it('should return { ok: true } and not call cache.del when sessionId is undefined', async () => {
      (cache.isConfigured as jest.Mock).mockReturnValue(true);
      const result = await service.logout(undefined);
      expect(result).toEqual({ ok: true });
      expect(cache.del).not.toHaveBeenCalled();
    });

    it('should return { ok: true } and not call cache.del when cache is not configured', async () => {
      (cache.isConfigured as jest.Mock).mockReturnValue(false);
      const result = await service.logout('some-session-id');
      expect(result).toEqual({ ok: true });
      expect(cache.del).not.toHaveBeenCalled();
    });

    it('should call cache.del with session key when sessionId and cache configured', async () => {
      (cache.isConfigured as jest.Mock).mockReturnValue(true);
      const sessionId = 'abc-123-session';
      const result = await service.logout(sessionId);
      expect(result).toEqual({ ok: true });
      expect(cache.del).toHaveBeenCalledWith(CACHE_KEY_SESSION(sessionId));
    });
  });
});
