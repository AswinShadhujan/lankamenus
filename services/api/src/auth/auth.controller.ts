import { Controller, Get, Post, Body, Req, UseGuards, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { GoogleCodeAuthDto } from './dto/google-code-auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private googleAuth: GoogleAuthService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.name);
  }

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Post('google')
  async googleLogin(@Body() body: GoogleAuthDto) {
    if (!this.googleAuth.isConfigured()) {
      throw new BadRequestException('Google Sign-In is not configured');
    }
    return this.authService.googleLogin(body.idToken);
  }

  /** Mobile: exchange authorization code (from OAuth redirect) for JWT. Requires GOOGLE_CLIENT_SECRET. */
  @Public()
  @Post('google/code')
  async googleLoginWithCode(@Body() body: GoogleCodeAuthDto) {
    if (!this.googleAuth.isCodeExchangeConfigured()) {
      throw new BadRequestException('Google code exchange is not configured (set GOOGLE_CLIENT_SECRET for mobile)');
    }
    return this.authService.googleLoginWithCode(body.code, body.redirectUri);
  }

  /** Return current user (id, email, name, role). Requires valid JWT. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: { user?: { userId?: number; role?: string; jti?: string } }) {
    const userId = req.user?.userId;
    if (userId == null) {
      throw new UnauthorizedException();
    }
    const user = await this.authService.getMe(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  /** Revoke current session (logout). Requires valid JWT. When Redis is configured, the session is removed so the token cannot be used again. */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: { user?: { jti?: string } }) {
    return this.authService.logout(req.user?.jti);
  }
}
