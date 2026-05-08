import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import 'dotenv/config';
console.log('🚀 Starting bot script...');
import { ApiService } from './api.service';

// ─── Setup ───────────────────────────────────────────────────────────────────

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error('❌  TELEGRAM_BOT_TOKEN is not set!');
  process.exit(1);
}

const bot = new Telegraf(botToken);
const api = new ApiService();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUser(u: { username?: string | null; firstName?: string | null }): string {
  return u.username ? `@${u.username}` : (u.firstName ?? 'there');
}

async function ensureUser(telegramId: number, from: any) {
  return api.registerUser({
    telegramId: String(telegramId),
    username: from.username,
    firstName: from.first_name,
    lastName: from.last_name,
  });
}

// ─── Commands ────────────────────────────────────────────────────────────────

/** /start — welcome + register user */
bot.start(async (ctx) => {
  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  const name = user ? formatUser(user) : ctx.from.first_name;

  await ctx.reply(
    `👋 Welcome to *Telecode*, ${name}!\n\n` +
    `I'm your AI coding continuity agent. Here's what I can do:\n\n` +
    `📋 */connect* \`owner/repo\` — link a GitHub repo\n` +
    `🔍 */explain* \`<question>\` — explain code / answer questions\n` +
    `🔎 */search* \`<query>\` — search for files/code in the repo\n` +
    `🗺 */plan* \`<feature>\` — plan a feature implementation\n` +
    `⚡ */execute* \`<task>\` — execute a safe code change\n` +
    `↩️ */undo* — roll back the last task\n` +
    `📂 */repos* — list connected repositories\n` +
    `📜 */tasks* — show recent task history\n` +
    `❓ */help* — show this message`,
    { parse_mode: 'Markdown' }
  );
});

/** /help */
bot.help(async (ctx) => {
  await ctx.reply(
    `*Telecode Commands*\n\n` +
    `📋 */connect* \`owner/repo\` — Link a GitHub repository\n` +
    `🔍 */explain* \`<question>\` — Get code explanations (read-only)\n` +
    `🔎 */search* \`<query>\` — Search for files or code logic\n` +
    `🗺 */plan* \`<feature>\` — Generate an implementation plan\n` +
    `⚡ */execute* \`<task>\` — Run an AI code change (creates a branch + PR)\n` +
    `↩️ */undo* — Revert the last completed task\n` +
    `📂 */repos* — List your connected repositories\n` +
    `📜 */tasks* — View recent task history`,
    { parse_mode: 'Markdown' }
  );
});

/** /connect owner/repo — link a GitHub repository */
bot.command('connect', async (ctx) => {
  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  if (!user) return ctx.reply('⚠️ Could not register you. Is the server running?');

  const arg = ctx.message.text.split(' ').slice(1).join('').trim();
  if (!arg || !arg.includes('/')) {
    return ctx.reply('Usage: `/connect owner/repo-name`', { parse_mode: 'Markdown' });
  }

  await ctx.reply(`🔗 Connecting to *${arg}*...`, { parse_mode: 'Markdown' });

  try {
    const repo = await api.connectRepo(user.id, arg);
    await ctx.reply(
      `✅ Connected to *${repo.fullName}*!\nDefault branch: \`${repo.defaultBranch}\`\n\nNow you can use /explain, /plan, or /execute with this repo as context.`,
      { parse_mode: 'Markdown' }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Failed to connect: ${err?.response?.data?.message ?? err.message}`);
  }
});

/** /repos — list connected repositories */
bot.command('repos', async (ctx) => {
  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  if (!user) return ctx.reply('⚠️ Could not reach the server.');

  try {
    const repos = await api.listRepos(user.id);
    if (!repos.length) {
      return ctx.reply('You have no connected repositories yet.\n\nUse `/connect owner/repo` to add one.', { parse_mode: 'Markdown' });
    }

    const list = repos
      .map((r: any) => `${r.isActive ? '✅' : '⚪'} \`${r.fullName}\` (${r.defaultBranch})`)
      .join('\n');

    await ctx.reply(`*Your Repositories:*\n\n${list}`, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('❌ Could not fetch repositories. Is the server running?');
  }
});

bot.command('search', async (ctx) => {
  const prompt = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!prompt) return ctx.reply('Usage: `/search <your query>`', { parse_mode: 'Markdown' });

  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  if (!user) return ctx.reply('⚠️ Could not reach the server.');

  const activeRepo = await api.getActiveRepo(user.id).catch(() => null);

  await ctx.reply(`🔎 *Search mode* — hunting for information...\n\n_"${prompt}"_`, { parse_mode: 'Markdown' });

  try {
    if (!ctx.chat) return;
    const task = await api.submitTask({
      userId: user.id,
      repositoryId: activeRepo?.id,
      mode: 'SEARCH',
      prompt,
      botToken,
      chatId: String(ctx.chat.id),
    });
    await ctx.reply(
      `🔍 *Phase 2: Knowledge Extraction* — ID: \`${task.id}\`\n` +
      `_(The AI is searching the repository. I'll post the results here shortly.)_`,
      { parse_mode: 'Markdown' }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Error: ${err?.response?.data?.message ?? err.message}`);
  }
});

/** /explain <question> — EXPLAIN mode (read-only) */
bot.command('explain', async (ctx) => {
  const prompt = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!prompt) return ctx.reply('Usage: `/explain <your question>`', { parse_mode: 'Markdown' });

  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  if (!user) return ctx.reply('⚠️ Could not reach the server.');

  const activeRepo = await api.getActiveRepo(user.id).catch(() => null);

  await ctx.reply(`🔍 *Explain mode* — analysing your question...\n\n_"${prompt}"_`, { parse_mode: 'Markdown' });

  try {
    if (!ctx.chat) return;
    const task = await api.submitTask({
      userId: user.id,
      repositoryId: activeRepo?.id,
      mode: 'EXPLAIN',
      prompt,
      botToken,
      chatId: String(ctx.chat.id),
    });
    await ctx.reply(
      `🧠 *Phase 2: Knowledge Extraction* — ID: \`${task.id}\`\n` +
      `_(AI worker is analyzing your question. I'll post the response here once ready.)_`,
      { parse_mode: 'Markdown' }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Error: ${err?.response?.data?.message ?? err.message}`);
  }
});

/** /plan <feature> — PLAN mode */
bot.command('plan', async (ctx) => {
  const prompt = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!prompt) return ctx.reply('Usage: `/plan <feature description>`', { parse_mode: 'Markdown' });

  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  if (!user) return ctx.reply('⚠️ Could not reach the server.');

  const activeRepo = await api.getActiveRepo(user.id).catch(() => null);
  if (!activeRepo) {
    return ctx.reply('⚠️ No active repository. Use `/connect owner/repo` first.', { parse_mode: 'Markdown' });
  }

  await ctx.reply(
    `🗺 *Plan mode* — building implementation strategy...\n\n_"${prompt}"_\n\nRepo: \`${activeRepo.fullName}\``,
    { parse_mode: 'Markdown' }
  );

  try {
    if (!ctx.chat) return;
    const task = await api.submitTask({
      userId: user.id,
      repositoryId: activeRepo.id,
      mode: 'PLAN',
      prompt,
      botToken,
      chatId: String(ctx.chat.id),
    });
    await ctx.reply(
      `📋 *Phase 3: Planning* — ID: \`${task.id}\`\n` +
      `_(The implementation strategy is being generated. Hang tight!)_`,
      { parse_mode: 'Markdown' }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Error: ${err?.response?.data?.message ?? err.message}`);
  }
});

/** /execute <task> — EXECUTE mode */
bot.command('execute', async (ctx) => {
  const prompt = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!prompt) return ctx.reply('Usage: `/execute <what to change>`', { parse_mode: 'Markdown' });

  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  if (!user) return ctx.reply('⚠️ Could not reach the server.');

  const activeRepo = await api.getActiveRepo(user.id).catch(() => null);
  if (!activeRepo) {
    return ctx.reply('⚠️ No active repository. Use `/connect owner/repo` first.', { parse_mode: 'Markdown' });
  }

  // Confirm before executing
  await ctx.reply(
    `⚡ *Execute mode* — I will make code changes to \`${activeRepo.fullName}\`.\n\n` +
    `Task: _"${prompt}"_\n\n` +
    `This will create a new branch and open a PR. Confirm?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.callback('✅ Confirm', `exec_confirm:${user.id}:${activeRepo.id}:${encodeURIComponent(prompt)}`),
        Markup.button.callback('❌ Cancel', 'exec_cancel'),
      ]),
    }
  );
});

bot.action('exec_cancel', async (ctx) => {
  await ctx.answerCbQuery('Cancelled.');
  await ctx.editMessageText('❌ Execution cancelled.');
});

bot.action(/^exec_confirm:(.+):(.+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('Submitting...');
  const [, userId, repositoryId, encodedPrompt] = ctx.match;
  const prompt = decodeURIComponent(encodedPrompt);

  try {
    if (!ctx.chat) return;
    const task = await api.submitTask({
      userId,
      repositoryId,
      mode: 'EXECUTE',
      prompt,
      botToken,
      chatId: String(ctx.chat.id),
    });
    await ctx.editMessageText(
      `⚡ *Phase 3: Actionable AI* initiated!\nID: \`${task.id}\`\n\n_(The AI is preparing code changes and creating a PR. You'll be notified when it's live.)_`,
      { parse_mode: 'Markdown' }
    );
  } catch (err: any) {
    await ctx.editMessageText(`❌ Error: ${err?.response?.data?.message ?? err.message}`);
  }
});

/** /undo — roll back last task */
bot.command('undo', async (ctx) => {
  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  if (!user) return ctx.reply('⚠️ Could not reach the server.');

  try {
    const task = await api.rollbackLastTask(user.id);
    await ctx.reply(
      `↩️ Task \`${task.id}\` rolled back.\nStatus: \`${task.status}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (err: any) {
    await ctx.reply(`❌ ${err?.response?.data?.message ?? err.message}`);
  }
});

/** /sync — generate a code for VS Code extension */
bot.command('sync', async (ctx) => {
  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  if (!user) return ctx.reply('⚠️ Could not reach the server.');

  try {
    const code = await api.generateSyncCode(user.id);
    await ctx.reply(
      `🔑 Your sync code: \`${code}\`\n\n` +
      `Enter this code in your VS Code Telecode extension to link your account.\n` +
      `This code will expire in 10 minutes.`,
      { parse_mode: 'Markdown' }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Failed to generate code: ${err?.response?.data?.message ?? err.message}`);
  }
});

/** /tasks — recent history */
bot.command('tasks', async (ctx) => {
  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  if (!user) return ctx.reply('⚠️ Could not reach the server.');

  try {
    const tasks = await api.listTasks(user.id);
    if (!tasks.length) return ctx.reply('No tasks yet. Use /explain, /plan, or /execute to get started!');

    const list = tasks
      .slice(0, 5)
      .map((t: any, i: number) =>
        `${i + 1}. [${t.mode}] \`${t.status}\` — ${t.prompt.slice(0, 50)}...`
      )
      .join('\n');

    await ctx.reply(`*Recent Tasks:*\n\n${list}`, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('❌ Could not fetch tasks.');
  }
});

/** Fallthrough — treat plain text as /explain */
bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return; // unknown command

  const user = await ensureUser(ctx.from.id, ctx.from).catch(() => null);
  if (!user) return ctx.reply('⚠️ Could not reach the server. Is it running?');

  const activeRepo = await api.getActiveRepo(user.id).catch(() => null);

  await ctx.reply(
    `💬 Got it! Treating this as an *explain* request...\n\n` +
    `${activeRepo ? `Repo: \`${activeRepo.fullName}\`` : '_(No active repo — use /connect to link one)_'}\n\n` +
    `Use /explain, /plan, or /execute to be more specific.`,
    { parse_mode: 'Markdown' }
  );

  try {
    if (!ctx.chat) return;
    await api.submitTask({
      userId: user.id,
      repositoryId: activeRepo?.id,
      mode: 'EXPLAIN',
      prompt: text,
      botToken,
      chatId: String(ctx.chat.id),
    });
  } catch {
    // silently queue even if server is slow
  }
});

// ─── Launch ──────────────────────────────────────────────────────────────────
console.log('⏳ Launching bot...');
bot.launch().then(() => {
  console.log('🤖 Telecode Bot is running!');
}).catch((err) => {
  console.error('❌ Failed to launch bot:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
