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
import { statusForStripeEvent } from './stripe-events';
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

    const status = statusForStripeEvent(event.type);
    if (!status) return { received: true };

    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    if (!orderId) return { received: true };

    const paymentIntent =
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    await this.orders.applyStripeStatus(orderId, status, paymentIntent);
    return { received: true };
  }
}

@Module({ imports: [StripeModule, OrdersModule], controllers: [StripeWebhookController] })
export class PaymentsModule {}
