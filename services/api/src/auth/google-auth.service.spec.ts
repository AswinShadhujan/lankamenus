import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthService } from './google-auth.service';
import { OAuth2Client } from 'google-auth-library';

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(),
}));

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let mockVerifyIdToken: jest.Mock;

  const validPayload = {
    email: 'user@gmail.com',
    email_verified: true,
    sub: 'google-sub-123',
    name: 'Test User',
    picture: 'https://example.com/photo.jpg',
  };

  beforeEach(async () => {
    mockVerifyIdToken = jest.fn();
    (OAuth2Client as jest.Mock).mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'GOOGLE_CLIENT_ID' ? 'client-id' : undefined)) },
        },
      ],
    }).compile();

    service = module.get<GoogleAuthService>(GoogleAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isConfigured', () => {
    it('should return true when GOOGLE_CLIENT_ID is set', () => {
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('verifyIdToken', () => {
    it('should return payload when token is valid', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => validPayload,
      });

      const result = await service.verifyIdToken('valid-token');

      expect(result).toEqual({
        email: 'user@gmail.com',
        email_verified: true,
        google_id: 'google-sub-123',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
      });
      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: 'valid-token',
        audience: 'client-id',
      });
    });

    it('should return name and picture as undefined when not in payload', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'u@x.com',
          email_verified: true,
          sub: 'sub-1',
        }),
      });

      const result = await service.verifyIdToken('token');

      expect(result.name).toBeUndefined();
      expect(result.picture).toBeUndefined();
      expect(result.email).toBe('u@x.com');
      expect(result.google_id).toBe('sub-1');
    });

    it('should throw UnauthorizedException when not configured', async () => {
      const moduleUnconfigured = await Test.createTestingModule({
        providers: [
          GoogleAuthService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
        ],
      }).compile();
      const unconfigured = moduleUnconfigured.get<GoogleAuthService>(GoogleAuthService);

      await expect(unconfigured.verifyIdToken('token')).rejects.toThrow(UnauthorizedException);
      await expect(unconfigured.verifyIdToken('token')).rejects.toThrow('Google Sign-In is not configured');
    });

    it('should throw UnauthorizedException when getPayload returns null', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => null });

      await expect(service.verifyIdToken('token')).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyIdToken('token')).rejects.toThrow('Invalid Google token payload');
    });

    it('should throw UnauthorizedException when email is missing', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ ...validPayload, email: undefined }),
      });

      await expect(service.verifyIdToken('token')).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyIdToken('token')).rejects.toThrow('Google token missing email or sub');
    });

    it('should throw UnauthorizedException when sub is missing', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ ...validPayload, sub: undefined }),
      });

      await expect(service.verifyIdToken('token')).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyIdToken('token')).rejects.toThrow('Google token missing email or sub');
    });

    it('should throw UnauthorizedException when email_verified is not true', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ ...validPayload, email_verified: false }),
      });

      await expect(service.verifyIdToken('token')).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyIdToken('token')).rejects.toThrow('Google email is not verified');
    });

    it('should throw UnauthorizedException when verifyIdToken throws', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyIdToken('bad-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyIdToken('bad-token')).rejects.toThrow('Invalid or expired Google token');
    });
  });
});
