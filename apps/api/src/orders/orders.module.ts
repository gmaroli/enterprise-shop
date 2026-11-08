import { Body, Controller, Get, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { checkoutSchema, type CheckoutInput } from '@shop/shared';
import { AuthGuard, CurrentUser, type AuthUser } from '../common/auth';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(AuthGuard)
class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Create an order from the cart and a Stripe Checkout session' })
  checkout(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(checkoutSchema)) body: CheckoutInput,
  ) {
    return this.orders.checkout(user, body);
  }

  @Get()
  @ApiOperation({ summary: 'List my orders (admins can pass all=true)' })
  @ApiQuery({ name: 'all', required: false })
  list(@CurrentUser() user: AuthUser, @Query('all') all?: string) {
    return this.orders.list(user, all === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one order (owner or admin)' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.get(user, id);
  }
}

@Module({ controllers: [OrdersController], providers: [OrdersService], exports: [OrdersService] })
export class OrdersModule {}
