import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Task, TaskMode, TaskStatus } from '@prisma/client';

export interface CreateTaskDto {
  userId: string;
  repositoryId?: string;
  mode: TaskMode;
  prompt: string;
}

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTaskDto): Promise<Task> {
    return this.prisma.task.create({
      data: {
        userId: dto.userId,
        repositoryId: dto.repositoryId,
        mode: dto.mode,
        prompt: dto.prompt,
        status: TaskStatus.PENDING,
      },
    });
  }

  async findAllForUser(userId: string, limit = 10): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findOne(id: string, userId: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async updateStatus(
    id: string,
    userId: string,
    status: TaskStatus,
    result?: string,
    branchName?: string,
    prUrl?: string,
  ): Promise<Task> {
    await this.findOne(id, userId); // verify ownership
    return this.prisma.task.update({
      where: { id },
      data: { status, result, branchName, prUrl },
    });
  }

  async rollback(id: string, userId: string): Promise<Task> {
    const task = await this.findOne(id, userId);
    if (task.status !== TaskStatus.COMPLETED) {
      throw new Error('Only completed tasks can be rolled back');
    }
    return this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.ROLLED_BACK },
    });
  }

  async getLastTask(userId: string): Promise<Task | null> {
    return this.prisma.task.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
