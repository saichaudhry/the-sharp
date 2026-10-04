// Server-side Supabase client. Uses the service-role key, which bypasses
// row-level security, so this file must only ever be imported from /api.
import { createClient } from '@supabase/supabase-js';

let client = null;

export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new HttpError(500, 'Database is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

// Lets any handler `throw new HttpError(400, '...')` and have it turned into
// a clean JSON error by `handle()` below.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wraps a handler so every error becomes {"error": "..."} with a sensible status
// instead of an HTML crash page.
export function handle(methods) {
  return async (req, res) => {
    const fn = methods[req.method];
    if (!fn) {
      res.setHeader('Allow', Object.keys(methods).join(', '));
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
    try {
      const result = await fn(req, res);
      if (!res.headersSent) res.status(200).json(result ?? {});
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      res.status(status).json({ error: status >= 500 && !err.status ? 'Something went wrong on our end.' : err.message });
    }
  };
}

// Throws if a Supabase response has an error, otherwise returns its data.
export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}
