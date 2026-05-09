import { Telegraf } from 'telegraf';
import 'dotenv/config';

const botToken = process.env.TELEGRAM_BOT_TOKEN;
console.log('Token length:', botToken?.length);
const bot = new Telegraf(botToken!);

async function test() {
    console.log('Calling getMe via Telegraf...');
    try {
        const me = await bot.telegram.getMe();
        console.log('Success!', me.username);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}
test();
