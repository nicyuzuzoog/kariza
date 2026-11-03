import app from '../server/app.js';

/**
 * Vercel catch-all function. All /api/* requests land here and are handed to
 * the Express app. Some runtimes strip the /api prefix from req.url, so we
 * normalise it before dispatch.
 */
export default function handler(req, res) {
  const url = req.url || '/';
  if (!url.startsWith('/api')) {
    req.url = `/api${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return app(req, res);
}
