import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Enterprise Shop API')
    .setDescription('REST API for the Enterprise Shop storefront and admin.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api (docs at /api/docs)`);
}

void bootstrap();
