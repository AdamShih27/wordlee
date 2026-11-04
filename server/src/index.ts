import { createApp } from './app';
import { config } from './config';

const app = createApp({ dbPath: config.dbPath });

app.httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`🟦 Wordlee server listening on http://0.0.0.0:${config.port}`);
  console.log(`   leaderboard db: ${config.dbPath}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    process.exit(0);
  });
}
