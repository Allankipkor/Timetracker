import type { VercelRequest, VercelResponse } from '@vercel/node';
import loginHandler from './_auth/login.js';
import signupHandler from './_auth/signup.js';
import meHandler from './_auth/me.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const urlPath = req.url?.split('?')[0] || '';
  
  if (urlPath.endsWith('/login')) {
    return loginHandler(req, res);
  } else if (urlPath.endsWith('/signup')) {
    return signupHandler(req, res);
  } else if (urlPath.endsWith('/me')) {
    return meHandler(req, res);
  }
  
  return res.status(404).json({ error: 'Auth endpoint not found' });
}
