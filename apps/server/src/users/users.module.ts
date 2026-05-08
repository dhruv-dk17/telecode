import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { SyncCodesService } from './sync-codes.service';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UsersService, SyncCodesService],
  exports: [UsersService, SyncCodesService],
})
export class UsersModule {}
