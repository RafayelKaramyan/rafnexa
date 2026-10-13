import { loadConfig } from './config.js';
import { createPool, rows } from './db.js';
import { createApp } from './app.js';

const config = loadConfig();
const pool = createPool(config);
await rows(pool, 'SELECT 1');
const { app, auth } = createApp(pool, config, { rateLimiting: config.environment !== 'test' });
const server = app.listen(config.port, '0.0.0.0', () =>
  console.log(`Rafnexa API listening on port ${config.port}.`),
);
const cleanup = setInterval(
  () => {
    void auth.cleanup().catch(() => console.error('Scheduled demo cleanup failed.'));
  },
  30 * 60 * 1000,
);
cleanup.unref();
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(cleanup);
  const deadline = setTimeout(() => {
    console.error('Shutdown deadline exceeded.');
    process.exit(1);
  }, 10_000);
  deadline.unref();
  server.close(() => {
    void pool.end().then(() => {
      clearTimeout(deadline);
      process.exit(0);
    });
  });
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
