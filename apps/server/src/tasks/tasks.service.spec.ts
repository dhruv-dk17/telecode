import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaskMode, TaskStatus } from '@prisma/client';

const mockPrismaService = {
  task: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a task', async () => {
    const fakeTask = {
      id: 'task-1',
      userId: 'user-1',
      mode: TaskMode.EXPLAIN,
      status: TaskStatus.PENDING,
      prompt: 'What does this function do?',
    };
    mockPrismaService.task.create.mockResolvedValue(fakeTask);

    const result = await service.create({
      userId: 'user-1',
      mode: TaskMode.EXPLAIN,
      prompt: 'What does this function do?',
    });

    expect(result).toEqual(fakeTask);
    expect(mockPrismaService.task.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        repositoryId: undefined,
        mode: TaskMode.EXPLAIN,
        prompt: 'What does this function do?',
        status: TaskStatus.PENDING,
      },
    });
  });

  it('should return tasks for a user', async () => {
    mockPrismaService.task.findMany.mockResolvedValue([]);
    const result = await service.findAllForUser('user-1');
    expect(result).toEqual([]);
    expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  });

  it('should throw NotFoundException when task not found', async () => {
    mockPrismaService.task.findFirst.mockResolvedValue(null);
    await expect(service.findOne('bad-id', 'user-1')).rejects.toThrow('Task not found');
  });
});
