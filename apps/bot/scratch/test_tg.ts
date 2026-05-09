import { Telegraf } from 'telegraf';
import 'dotenv/config';

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

const bot = new Telegraf(botToken);

async function test() {
  console.log('Testing Telegram connectivity...');
  try {
    const me = await bot.telegram.getMe();
    console.log('✅ Success! Bot name:', me.first_name);
  } catch (err) {
    console.error('❌ Failed:', err);
  }
}

test();
