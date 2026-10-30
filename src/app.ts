import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { routes } from './routes.js';
import { pool } from './db/client.js';

/** Monta o app Express. Separado do server.ts para os testes usarem sem abrir porta. */
export function createApp() {
  const app = express();
  const openApiDocument = buildOpenApiDocument();

  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false })); // CSP desligado só por causa do Swagger UI
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req, res) => {
    await pool.query('select 1');
    res.json({ status: 'ok', database: 'ok' });
  });
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, { customSiteTitle: 'TeamTasks API' }),
  );

  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
