import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    googleLogin: jest.fn(),
    getMe: jest.fn(),
    logout: jest.fn(),
  };

  const mockGoogleAuthService = {
    isConfigured: jest.fn().mockReturnValue(true),
    verifyIdToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGoogleAuthService.isConfigured.mockReturnValue(true);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: GoogleAuthService, useValue: mockGoogleAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /auth/me (me)', () => {
    it('should return user when req.user.userId is set and getMe returns user', async () => {
      const user = { id: 1, email: 'u@test.com', name: 'User', role: 'user' };
      mockAuthService.getMe.mockResolvedValue(user);
      const req = { user: { userId: 1, role: 'user', jti: 'jti-1' } };
      const result = await controller.me(req);
      expect(authService.getMe).toHaveBeenCalledWith(1);
      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException when req.user is undefined', async () => {
      const req = { user: undefined };
      await expect(controller.me(req)).rejects.toThrow(UnauthorizedException);
      expect(authService.getMe).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when req.user.userId is null', async () => {
      const req = { user: { userId: null, role: 'user' } };
      await expect(controller.me(req)).rejects.toThrow(UnauthorizedException);
      expect(authService.getMe).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when getMe returns null', async () => {
      mockAuthService.getMe.mockResolvedValue(null);
      const req = { user: { userId: 999, role: 'user' } };
      await expect(controller.me(req)).rejects.toThrow(UnauthorizedException);
      expect(authService.getMe).toHaveBeenCalledWith(999);
    });
  });

  describe('POST /auth/logout (logout)', () => {
    it('should call logout with jti and return result', async () => {
      mockAuthService.logout.mockResolvedValue({ ok: true });
      const req = { user: { userId: 1, role: 'user', jti: 'session-123' } };
      const result = await controller.logout(req);
      expect(authService.logout).toHaveBeenCalledWith('session-123');
      expect(result).toEqual({ ok: true });
    });

    it('should call logout with undefined when user has no jti', async () => {
      mockAuthService.logout.mockResolvedValue({ ok: true });
      const req = { user: { userId: 1, role: 'user' } };
      const result = await controller.logout(req);
      expect(authService.logout).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('POST /auth/google (googleLogin)', () => {
    it('should return accessToken and user when Google is configured and login succeeds', async () => {
      const tokenResponse = { accessToken: 'jwt-123', user: { id: 1, email: 'u@x.com', role: 'admin' } };
      mockAuthService.googleLogin.mockResolvedValue(tokenResponse);

      const result = await controller.googleLogin({ idToken: 'google-id-token' });

      expect(mockGoogleAuthService.isConfigured).toHaveBeenCalled();
      expect(authService.googleLogin).toHaveBeenCalledWith('google-id-token');
      expect(result).toEqual(tokenResponse);
    });

    it('should throw BadRequestException when Google is not configured', async () => {
      mockGoogleAuthService.isConfigured.mockReturnValue(false);

      await expect(controller.googleLogin({ idToken: 'token' })).rejects.toThrow(BadRequestException);
      await expect(controller.googleLogin({ idToken: 'token' })).rejects.toThrow('Google Sign-In is not configured');
      expect(authService.googleLogin).not.toHaveBeenCalled();
    });

    it('should propagate UnauthorizedException when googleLogin throws', async () => {
      mockAuthService.googleLogin.mockRejectedValue(new UnauthorizedException('Invalid or expired Google token'));

      await expect(controller.googleLogin({ idToken: 'bad-token' })).rejects.toThrow(UnauthorizedException);
    });
  });
});
