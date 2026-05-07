import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WorkerService } from './worker.service';

@Module({
  imports: [HttpModule],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
