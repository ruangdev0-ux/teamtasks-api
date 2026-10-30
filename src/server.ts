import { env } from './config/env.js';
import { createApp } from './app.js';
import { pool } from './db/client.js';

const server = createApp().listen(env.PORT, () => {
  console.info(`TeamTasks API em http://localhost:${env.PORT} (docs em /docs)`);
});

// Encerramento limpo: para de aceitar conexões e fecha o pool do banco.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });
}
