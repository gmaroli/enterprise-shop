import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@shop/shared';
import { AuthGuard, CurrentUser, type AuthUser } from '../common/auth';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create a customer account' })
  @ApiBody({
    schema: {
      example: { email: 'new.user@example.com', password: 'a-long-password', name: 'New User' },
    },
  })
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in and receive a bearer token' })
  @ApiBody({ schema: { example: { email: 'customer@shop.test', password: 'Customer123!' } } })
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
