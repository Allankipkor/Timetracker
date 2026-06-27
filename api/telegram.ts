import https from 'https';

export async function sendTelegramNotification(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('Telegram Bot Token or Chat ID not configured. Notification skipped.');
    return false;
  }

  return new Promise((resolve) => {
    try {
      const data = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      });

      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            console.error('Failed to send Telegram message:', responseBody);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Telegram notification error:', error);
        resolve(false);
      });

      req.write(data);
      req.end();
    } catch (err) {
      console.error('Telegram request exception:', err);
      resolve(false);
    }
  });
}
