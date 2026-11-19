import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Global,
  Injectable,
  Module,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BASE_CURRENCY,
  currencySchema,
  exchangeRateSchema,
  type Currency,
  type ExchangeRateInput,
} from '@shop/shared';
import { AuthGuard, Roles, RolesGuard } from '../common/auth';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService) {}

  async all() {
    const rows = await this.prisma.exchangeRate.findMany({ orderBy: { currency: 'asc' } });
    return rows.map((r) => ({
      currency: r.currency,
      perUsd: r.perUsd.toNumber(),
      source: r.source,
      updatedAt: r.updatedAt,
    }));
  }

  /** Units of the currency per 1 USD. */
  async rateFor(currency: Currency): Promise<number> {
    if (currency === BASE_CURRENCY) return 1;
    const row = await this.prisma.exchangeRate.findUnique({ where: { currency } });
    if (!row) throw new BadRequestException(`No exchange rate for ${currency}`);
    return row.perUsd.toNumber();
  }

  async update(currency: Currency, input: ExchangeRateInput) {
    if (currency === BASE_CURRENCY)
      throw new BadRequestException('USD is the base currency and cannot be changed');
    const row = await this.prisma.exchangeRate.upsert({
      where: { currency },
      update: { perUsd: input.perUsd, source: 'admin' },
      create: { currency, perUsd: input.perUsd, source: 'admin' },
    });
    return {
      currency: row.currency,
      perUsd: row.perUsd.toNumber(),
      source: row.source,
      updatedAt: row.updatedAt,
    };
  }
}

@ApiTags('rates')
@Controller('rates')
class RatesController {
  constructor(private readonly rates: RatesService) {}

  @Get()
  @ApiOperation({ summary: 'Exchange rates (units of each currency per 1 USD)' })
  list() {
    return this.rates.all();
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/rates')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
class AdminRatesController {
  constructor(private readonly rates: RatesService) {}

  @Put(':currency')
  @ApiOperation({ summary: 'Set the exchange rate for a currency (admin)' })
  update(
    @Param('currency', new ZodValidationPipe(currencySchema)) currency: Currency,
    @Body(new ZodValidationPipe(exchangeRateSchema)) body: ExchangeRateInput,
  ) {
    return this.rates.update(currency, body);
  }
}

@Global()
@Module({
  controllers: [RatesController, AdminRatesController],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}
