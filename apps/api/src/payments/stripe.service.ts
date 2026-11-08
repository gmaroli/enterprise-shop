import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private client?: Stripe;

  constructor(private readonly config: ConfigService) {}

  get stripe(): Stripe {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key || key.includes('replace_me')) {
      throw new ServiceUnavailableException('Stripe is not configured (set STRIPE_SECRET_KEY)');
    }
    this.client ??= new Stripe(key);
    return this.client;
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret || secret.includes('replace_me')) {
      throw new ServiceUnavailableException('Stripe webhook secret is not configured');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
