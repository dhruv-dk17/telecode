/** Mirrors TaskMode enum from Prisma schema */
export type TaskMode = 'EXPLAIN' | 'PLAN' | 'EXECUTE';

/** Mirrors TaskStatus enum from Prisma schema */
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';

export interface TeleUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
}
