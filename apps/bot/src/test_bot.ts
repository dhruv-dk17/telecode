import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
bot.start((ctx) => ctx.reply('Welcome'));
bot.on('message', (ctx) => ctx.reply('Got it'));

console.log('⏳ Launching test bot...');
bot.launch().then(() => {
    console.log('🤖 Test Bot is running!');
}).catch(err => {
    console.error('❌ Error:', err);
});
