import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import axios from 'axios';
import { UsersService } from './users/users.service';
import { RepositoriesService } from './repositories/repositories.service';
import { TasksService, CreateTaskDto } from './tasks/tasks.service';
import { WorkerService } from './worker/worker.service';
import { SyncCodesService } from './users/sync-codes.service';
import { TaskMode, TaskStatus } from '@prisma/client';

// ── DTOs ────────────────────────────────────────────────────────────────────

export class RegisterUserDto {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export class ConnectRepoDto {
  userId: string;
  fullName: string;          // "owner/repo"
  defaultBranch?: string;
}

export class SubmitTaskDto {
  userId: string;
  repositoryId?: string;
  mode: TaskMode;
  prompt: string;
  botToken: string;   // Required for worker to push results
  chatId: string;     // Required for worker to push results
}

export class UpdateTaskDto {
  status: TaskStatus;
  result?: string;
  branchName?: string;
  prUrl?: string;
}

// ── Controller ───────────────────────────────────────────────────────────────

@Controller('bot')
export class BotController {
  constructor(
    private readonly users: UsersService,
    private readonly repos: RepositoriesService,
    private readonly tasks: TasksService,
    private readonly worker: WorkerService,
    private readonly syncCodes: SyncCodesService,
  ) {}

  // ─ Users ─────────────────────────────────────────────────────────────────

  /** Called on every /start — idempotent user upsert */
  @Post('users/register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() dto: RegisterUserDto) {
    const user = await this.users.findOrCreate({
      telegramId: dto.telegramId,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    return { user };
  }

  @Get('users/:telegramId')
  async getUser(@Param('telegramId') telegramId: string) {
    const user = await this.users.findByTelegramId(telegramId);
    return { user };
  }

  // ─ Repositories ──────────────────────────────────────────────────────────

  @Post('repos/connect')
  @HttpCode(HttpStatus.OK)
  async connectRepo(@Body() dto: ConnectRepoDto) {
    const repo = await this.repos.connect(
      dto.userId,
      dto.fullName,
      dto.defaultBranch,
    );
    return { repo };
  }

  @Get('repos/:userId')
  async listRepos(@Param('userId') userId: string) {
    const repos = await this.repos.findAllForUser(userId);
    return { repos };
  }

  @Get('repos/:userId/active')
  async activeRepo(@Param('userId') userId: string) {
    const repo = await this.repos.findActiveForUser(userId);
    return { repo };
  }

  // ─ Tasks ─────────────────────────────────────────────────────────────────

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  async submitTask(@Body() dto: SubmitTaskDto) {
    const task = await this.tasks.create({
      userId: dto.userId,
      repositoryId: dto.repositoryId,
      mode: dto.mode,
      prompt: dto.prompt,
    });

    let repoFullName: string | undefined;
    let repoDefaultBranch: string | undefined;

    if (dto.repositoryId) {
      const repo = await this.repos.findById(dto.repositoryId);
      if (repo) {
        repoFullName = repo.fullName;
        repoDefaultBranch = repo.defaultBranch;
      }
    }

    // Fire and forget: dispatch to AI worker
    this.worker.dispatch({
      task,
      repoFullName,
      repoDefaultBranch,
      botToken: dto.botToken,
      chatId: dto.chatId,
    });

    return { task };
  }

  @Get('tasks/:userId')
  async listTasks(@Param('userId') userId: string) {
    const tasks = await this.tasks.findAllForUser(userId);
    return { tasks };
  }

  @Get('tasks/token/:apiToken')
  async listTasksByToken(@Param('apiToken') apiToken: string) {
    const user = await this.users.findByApiToken(apiToken);
    if (!user) {
      return { tasks: [] };
    }
    const tasks = await this.tasks.findAllForUser(user.id);
    return { tasks };
  }

  @Get('tasks/:userId/last')
  async lastTask(@Param('userId') userId: string) {
    const task = await this.tasks.getLastTask(userId);
    return { task };
  }

  @Post('tasks/:id/update')
  @HttpCode(HttpStatus.OK)
  async updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto & { userId: string },
  ) {
    const task = await this.tasks.updateStatus(
      id,
      dto.userId,
      dto.status,
      dto.result,
      dto.branchName,
      dto.prUrl,
    );
    return { task };
  }

  @Post('tasks/:id/rollback')
  @HttpCode(HttpStatus.OK)
  async rollbackTask(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    const task = await this.tasks.rollback(id, body.userId);
    return { task };
  }

  @Post('sync/generate')
  @HttpCode(HttpStatus.OK)
  async generateSyncCode(@Body() body: { userId: string }) {
    const code = await this.syncCodes.generate(body.userId);
    return { code };
  }

  @Post('sync/exchange')
  @HttpCode(HttpStatus.OK)
  async exchangeSyncCode(@Body() body: { code: string }) {
    const result = await this.syncCodes.validateAndExchange(body.code);
    if (!result) {
      return { error: 'Invalid or expired code' };
    }

    const { apiToken, user } = result;

    // Notify user via Telegram bot
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken && user.telegramId) {
      try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: user.telegramId,
          text: `✅ <b>Sync Successful!</b>\n\nYour VS Code extension is now connected to this account. You can start sending tasks from your editor.`,
          parse_mode: 'HTML',
        });
      } catch (err) {
        console.error('Failed to send Telegram notification:', err.response?.data || err.message);
      }
    }

    return { apiToken };
  }
}
