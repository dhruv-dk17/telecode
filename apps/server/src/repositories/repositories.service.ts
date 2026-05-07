import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Repository } from '@prisma/client';

@Injectable()
export class RepositoriesService {
  async findById(id: string): Promise<Repository | null> {
    return this.prisma.repository.findUnique({ where: { id } });
  }

  constructor(private prisma: PrismaService) {}

  async findAllForUser(userId: string): Promise<Repository[]> {
    return this.prisma.repository.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveForUser(userId: string): Promise<Repository | null> {
    return this.prisma.repository.findFirst({
      where: { userId, isActive: true },
    });
  }

  async connect(userId: string, fullName: string, defaultBranch = 'main'): Promise<Repository> {
    // Upsert: create if not exists, update defaultBranch if it does
    const repo = await this.prisma.repository.upsert({
      where: { userId_fullName: { userId, fullName } },
      create: { userId, fullName, defaultBranch },
      update: { defaultBranch },
    });

    // Set this repo as active, deactivate others
    await this.prisma.repository.updateMany({
      where: { userId, id: { not: repo.id } },
      data: { isActive: false },
    });
    return this.prisma.repository.update({
      where: { id: repo.id },
      data: { isActive: true },
    });
  }

  async setActive(userId: string, repoId: string): Promise<Repository> {
    const repo = await this.prisma.repository.findFirst({
      where: { id: repoId, userId },
    });
    if (!repo) throw new NotFoundException('Repository not found');

    await this.prisma.repository.updateMany({
      where: { userId },
      data: { isActive: false },
    });
    return this.prisma.repository.update({
      where: { id: repoId },
      data: { isActive: true },
    });
  }

  async disconnect(userId: string, repoId: string): Promise<Repository> {
    const repo = await this.prisma.repository.findFirst({
      where: { id: repoId, userId },
    });
    if (!repo) throw new NotFoundException('Repository not found');
    return this.prisma.repository.delete({ where: { id: repoId } });
  }
}
