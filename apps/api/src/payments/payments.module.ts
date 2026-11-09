import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Module,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { OrdersModule } from '../orders/orders.module';
import { OrdersService } from '../orders/orders.service';
import { isHandledEvent } from './stripe-events';
import { StripeModule } from './stripe.module';
import { StripeService } from './stripe.service';

@ApiExcludeController()
@Controller('webhooks')
class StripeWebhookController {
  constructor(
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature || !req.rawBody) throw new BadRequestException('Missing signature or body');

    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    if (!isHandledEvent(event.type)) return { received: true };

    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    if (!orderId) return { received: true };

    await this.orders.applyStripeSession(orderId, session, event.type);
    return { received: true };
  }
}

@Module({ imports: [StripeModule, OrdersModule], controllers: [StripeWebhookController] })
export class PaymentsModule {}
