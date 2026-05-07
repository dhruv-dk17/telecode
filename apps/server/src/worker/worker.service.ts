import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Task } from '@prisma/client';

export interface DispatchOptions {
  task: Task;
  repoFullName?: string;
  repoDefaultBranch?: string;
  botToken: string;
  chatId: string;
}

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);
  private readonly workerUrl = process.env.WORKER_URL ?? 'http://localhost:8000';
  private readonly workerSecret = process.env.WORKER_SECRET ?? 'telecode-worker-secret-change-in-prod';

  constructor(private readonly http: HttpService) {}

  async dispatch(opts: DispatchOptions): Promise<boolean> {
    const { task, repoFullName, repoDefaultBranch, botToken, chatId } = opts;

    const payload = {
      task_id: task.id,
      user_id: task.userId,
      mode: task.mode,
      prompt: task.prompt,
      repo_full_name: repoFullName ?? null,
      repo_default_branch: repoDefaultBranch ?? null,
    };

    let retries = 3;
    while (retries > 0) {
      try {
        await firstValueFrom(
          this.http.post(`${this.workerUrl}/process`, payload, {
            headers: {
              'X-Worker-Secret': this.workerSecret,
              'X-Bot-Token': botToken,
              'X-Chat-Id': chatId,
            },
            timeout: 10_000,
          }),
        );
        this.logger.log(`Dispatched task ${task.id} (${task.mode}) to worker`);
        return true;
      } catch (err: any) {
        retries--;
        this.logger.warn(
          `Failed to dispatch task ${task.id} to worker (retries left: ${retries}): ${err?.message}`,
        );
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * (3 - retries)));
        }
      }
    }
    return false;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.get(`${this.workerUrl}/health`, { timeout: 5_000 }),
      );
      return res.data?.status === 'ok';
    } catch {
      return false;
    }
  }
}
