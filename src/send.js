'use strict';
// Telegram sender. Without credentials it prints instead of sending
// (dry mode), so the pipeline is testable with zero secrets.
// Supports replying to the original prediction + 429 backoff.
const config = require('./config');

async function send(html, opts = {}) {
  if (opts.dryRun || !config.telegramToken || !config.chatId) {
    console.log('--- DRY (no TELEGRAM_BOT_TOKEN/CHAT_ID) — message that WOULD post: ---');
    console.log(html.replace(/<[^>]+>/g, ''));
    if (opts.replyTo) console.log(`(as reply to message ${opts.replyTo})`);
    console.log('--- end ---');
    return { ok: true, dry: true };
  }
  const payload = {
    chat_id: config.chatId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (opts.replyTo) payload.reply_to_message_id = opts.replyTo;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (json.ok) return { ok: true, messageId: json.result.message_id };
    if (res.status === 429 && attempt < 3) {
      const wait = Math.min(60000, ((json.parameters && json.parameters.retry_after) || 5) * 1000);
      console.log(`telegram 429, backing off ${wait}ms`);
      await sleep(wait);
      continue;
    }
    // Reply target deleted? Retry once as a standalone message.
    if (opts.replyTo && !opts.retriedPlain &&
      /reply message not found|message to reply not found/i.test(json.description || '')) {
      console.log('original message gone — reposting result standalone');
      return send(html, { ...opts, replyTo: null, retriedPlain: true });
    }
    throw new Error('Telegram rejected message: ' + (json.description || res.status));
  }
  throw new Error('Telegram rate-limited after retries');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { send, sleep };
