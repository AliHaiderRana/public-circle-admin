/**
 * Custom server entry — must stay CommonJS.
 * Loading Next through `tsx server.ts` breaks AsyncLocalStorage in Next 16.
 * Next is required here first; tsx is registered only for our TS socket module.
 */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer();

  server.on('request', async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (error) {
      console.error('Error handling request', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('internal server error');
      }
    }
  });

  server.listen(port, () => {
    console.log(`> Admin ready on http://${hostname}:${port}`);
  });
});
