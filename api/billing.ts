import type { VercelRequest, VercelResponse } from '@vercel/node';
import settingsHandler from './_billing/settings.js';
import subscribeHandler from './_billing/subscribe.js';
import payheroCallbackHandler from './_billing/payhero-callback.js';
import statusHandler from './_billing/status.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const urlPath = req.url?.split('?')[0] || '';

  if (urlPath.endsWith('/settings')) {
    return settingsHandler(req, res);
  } else if (urlPath.endsWith('/subscribe')) {
    return subscribeHandler(req, res);
  } else if (urlPath.endsWith('/payhero-callback')) {
    return payheroCallbackHandler(req, res);
  } else if (urlPath.endsWith('/status')) {
    return statusHandler(req, res);
  }

  return res.status(404).json({ error: 'Billing endpoint not found' });
}
