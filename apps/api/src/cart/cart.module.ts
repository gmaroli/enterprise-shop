import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { cartItemSchema, currencySchema, type CartItemInput, type Currency } from '@shop/shared';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../common/auth';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CartService } from './cart.service';

const quantitySchema = z.object({ quantity: z.number().int().min(1).max(99) });
const currencyParam = new ZodValidationPipe(currencySchema.default('USD'));

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
@UseGuards(AuthGuard)
class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get my cart with totals' })
  @ApiQuery({ name: 'coupon', required: false, description: 'Preview totals with a coupon code' })
  @ApiQuery({ name: 'currency', required: false, description: 'Price the cart in this currency (default USD)' })
  get(
    @CurrentUser() user: AuthUser,
    @Query('coupon') coupon?: string,
    @Query('currency', currencyParam) currency: Currency = 'USD',
  ) {
    return this.cart.get(user.id, coupon, currency);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add a product to the cart (adds to existing quantity)' })
  add(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(cartItemSchema)) body: CartItemInput,
    @Query('currency', currencyParam) currency: Currency = 'USD',
  ) {
    return this.cart.addItem(user.id, body.productId, body.quantity, currency);
  }

  @Patch('items/:productId')
  @ApiOperation({ summary: 'Set the quantity of a cart item' })
  setQuantity(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(quantitySchema)) body: { quantity: number },
    @Query('currency', currencyParam) currency: Currency = 'USD',
  ) {
    return this.cart.setQuantity(user.id, productId, body.quantity, currency);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove an item from the cart' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Query('currency', currencyParam) currency: Currency = 'USD',
  ) {
    return this.cart.removeItem(user.id, productId, currency);
  }

  @Delete()
  @ApiOperation({ summary: 'Empty the cart' })
  clear(@CurrentUser() user: AuthUser, @Query('currency', currencyParam) currency: Currency = 'USD') {
    return this.cart.clear(user.id, currency);
  }
}

@Module({ controllers: [CartController], providers: [CartService], exports: [CartService] })
export class CartModule {}
