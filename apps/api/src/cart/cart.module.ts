import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { cartItemSchema, type CartItemInput } from '@shop/shared';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../common/auth';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CartService } from './cart.service';

const quantitySchema = z.object({ quantity: z.number().int().min(1).max(99) });

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
@UseGuards(AuthGuard)
class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get my cart with totals' })
  @ApiQuery({ name: 'coupon', required: false, description: 'Preview totals with a coupon code' })
  get(@CurrentUser() user: AuthUser, @Query('coupon') coupon?: string) {
    return this.cart.get(user.id, coupon);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add a product to the cart (adds to existing quantity)' })
  add(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(cartItemSchema)) body: CartItemInput,
  ) {
    return this.cart.addItem(user.id, body.productId, body.quantity);
  }

  @Patch('items/:productId')
  @ApiOperation({ summary: 'Set the quantity of a cart item' })
  setQuantity(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(quantitySchema)) body: { quantity: number },
  ) {
    return this.cart.setQuantity(user.id, productId, body.quantity);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove an item from the cart' })
  remove(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.cart.removeItem(user.id, productId);
  }

  @Delete()
  @ApiOperation({ summary: 'Empty the cart' })
  clear(@CurrentUser() user: AuthUser) {
    return this.cart.clear(user.id);
  }
}

@Module({ controllers: [CartController], providers: [CartService], exports: [CartService] })
export class CartModule {}
