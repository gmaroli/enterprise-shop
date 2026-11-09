import { Controller, Get, Headers, Injectable, Module, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { currencyForCountry, type Currency } from '@shop/shared';
import type { Request } from 'express';
import maxmind, { type CountryResponse, type Reader } from 'maxmind';
import { isPrivateIp, normalizeIp } from './ip';

export type GeoResult = {
  country: string;
  currency: Currency;
  /** ip: looked up from the client address; dev_ip: GEO_DEV_IP stood in for a private address; default: no usable address. */
  source: 'ip' | 'dev_ip' | 'default';
};

@Injectable()
export class GeoService {
  private reader?: Promise<Reader<CountryResponse>>;

  constructor(private readonly config: ConfigService) {}

  private open() {
    // Bundled country database (CC0, from regional registry data); no account or network access needed.
    this.reader ??= maxmind.open<CountryResponse>(
      require.resolve('@ip-location-db/geo-whois-asn-country-mmdb/geo-whois-asn-country.mmdb'),
    );
    return this.reader;
  }

  async detect(rawIp: string | undefined | null): Promise<GeoResult> {
    const fallback = (this.config.get<string>('GEO_DEFAULT_COUNTRY') ?? 'US').toUpperCase();
    let ip = normalizeIp(rawIp);
    let source: GeoResult['source'] = 'ip';

    if (!ip || isPrivateIp(ip)) {
      ip = normalizeIp(this.config.get<string>('GEO_DEV_IP'));
      source = 'dev_ip';
    }
    if (!ip) return { country: fallback, currency: currencyForCountry(fallback), source: 'default' };

    const reader = await this.open();
    // This database stores a flat { country_code } record rather than MaxMind's nested layout.
    const record = reader.get(ip) as unknown as { country_code?: string } | null;
    const code = record?.country_code?.toUpperCase();
    if (!code) return { country: fallback, currency: currencyForCountry(fallback), source: 'default' };
    return { country: code, currency: currencyForCountry(code), source };
  }
}

@ApiTags('geo')
@Controller('geo')
class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get()
  @ApiOperation({ summary: 'Country and currency for the caller, detected from the IP address' })
  @ApiHeader({ name: 'x-client-ip', required: false, description: 'End-user IP forwarded by the web app' })
  detect(@Req() req: Request, @Headers('x-client-ip') clientIp?: string) {
    return this.geo.detect(clientIp ?? req.ip);
  }
}

@Module({ controllers: [GeoController], providers: [GeoService], exports: [GeoService] })
export class GeoModule {}
