import { Telegraf } from 'telegraf';
import 'dotenv/config';

const botToken = process.env.TELEGRAM_BOT_TOKEN;
console.log('Testing token:', botToken);

const bot = new Telegraf(botToken!);

bot.on('text', (ctx) => {
  console.log('Received message:', ctx.message.text);
  ctx.reply('I am alive!');
});

console.log('Starting test bot...');
bot.launch().then(() => {
  console.log('Test bot launched successfully!');
}).catch(err => {
  console.error('Test bot failed:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
