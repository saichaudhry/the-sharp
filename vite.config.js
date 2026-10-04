import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In production, Vercel turns each file in /api into a serverless function.
// Locally, this small plugin does the same job inside the Vite dev server, so
// `npm run dev` runs the frontend AND the API with no extra tools. It adds the
// three things Vercel gives handlers: req.query, req.body, res.status().json().
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://localhost');
        const name = url.pathname.slice('/api/'.length).replace(/\/$/, '');

        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
          return res;
        };

        if (!/^[a-z]+$/.test(name)) return res.status(404).json({ error: 'Not found' });
        let mod;
        try {
          mod = await server.ssrLoadModule(`/api/${name}.js`);
        } catch {
          return res.status(404).json({ error: 'Not found' });
        }

        let raw = '';
        for await (const chunk of req) raw += chunk;
        req.query = Object.fromEntries(url.searchParams);
        try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }

        await mod.default(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env.local into process.env for the API code. Only VITE_* vars ever
  // reach the browser bundle, and this project doesn't define any.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), localApi()] };
});
