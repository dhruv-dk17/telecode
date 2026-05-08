import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncCode } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class SyncCodesService {
  constructor(private prisma: PrismaService) {}

  async generate(userId: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    await this.prisma.syncCode.create({
      data: {
        code,
        userId,
        expiresAt,
      },
    });

    return code;
  }

  async validateAndExchange(code: string): Promise<{ apiToken: string; user: any } | null> {
    const syncCode = await this.prisma.syncCode.findUnique({
      where: { code },
      include: { user: true },
    });

    if (!syncCode || syncCode.expiresAt < new Date()) {
      return null;
    }

    // Generate apiToken
    const apiToken = crypto.randomBytes(32).toString('hex');

    await this.prisma.user.update({
      where: { id: syncCode.userId },
      data: { apiToken },
    });

    // Delete the sync code after use
    await this.prisma.syncCode.delete({
      where: { id: syncCode.id },
    });

    return { apiToken, user: syncCode.user };
  }
}
