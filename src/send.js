'use strict';
// Telegram sender. Without a token it prints instead of sending (dry mode),
// so the pipeline can be tested with zero secrets.
const config = require('./config');

async function send(html) {
  if (!config.telegramToken || !config.chatId) {
    console.log('--- DRY (no TELEGRAM_BOT_TOKEN/CHAT_ID) — message that WOULD post: ---');
    console.log(html.replace(/<[^>]+>/g, ''));
    console.log('--- end ---');
    return { ok: true, dry: true };
  }
  const res = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error('Telegram rejected message: ' + (json.description || res.status));
  return { ok: true, messageId: json.result.message_id };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { send, sleep };
