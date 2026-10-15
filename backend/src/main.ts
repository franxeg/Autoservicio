import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const messages = errors.map((err) => {
          const constraints = err.constraints ? Object.values(err.constraints).join(', ') : 'Dato inválido';
          // Traducir mensajes comunes al español
          let msg = constraints
            .replace(/should not be empty/g, 'no debe estar vacío')
            .replace(/must be a string/g, 'debe ser un texto')
            .replace(/must be a number/g, 'debe ser un número')
            .replace(/must be an email/g, 'debe ser un email válido')
            .replace(/property .* should not exist/g, 'propiedad no permitida');
          return `${err.property}: ${msg}`;
        });
        return new (require('@nestjs/common').BadRequestException)({
          message: messages,
          error: 'Datos inválidos',
          statusCode: 400,
        });
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Autoservicio API')
    .setDescription('API - Compras, Ventas, Stock, Caja')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Modo producción: servir el frontend ya compilado desde el mismo proceso.
  // No afecta al modo dev (no existe la carpeta con index.html).
  const webDir = process.env.WEB_DIR || join(process.cwd(), 'public');
  if (existsSync(join(webDir, 'index.html'))) {
    app.useStaticAssets(webDir, { index: false });
    const server = app.getHttpAdapter().getInstance();
    server.get(/^\/(?!api(?:\/|$)).*/, (req: any, res: any, next: any) => {
      if (req.method !== 'GET') return next();
      res.sendFile(join(webDir, 'index.html'));
    });
    console.log(`Frontend servido desde ${webDir}`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API corriendo en http://localhost:${port}/api`);
  console.log(`Docs en http://localhost:${port}/api/docs`);
}
bootstrap();
