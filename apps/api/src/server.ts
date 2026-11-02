import http from 'http';
import { createApiServer } from './app';

const api = createApiServer();
const server = http.createServer((req, res) => {
  void api.handleRequest(req, res);
});

if (require.main === module) {
  server.listen(api.config.port, () => {
    console.log(
      `[Daily Sadaqah API] Listening on http://localhost:${api.config.port} (env=${api.config.nodeEnv})`
    );
  });
}

export { server, api };
