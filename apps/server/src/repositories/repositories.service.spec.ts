import { Test, TestingModule } from '@nestjs/testing';
import { RepositoriesService } from './repositories.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  repository: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
};

describe('RepositoriesService', () => {
  let service: RepositoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepositoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RepositoriesService>(RepositoriesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all repos for a user', async () => {
    mockPrismaService.repository.findMany.mockResolvedValue([]);
    const result = await service.findAllForUser('user-1');
    expect(result).toEqual([]);
    expect(mockPrismaService.repository.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should return the active repo for a user', async () => {
    const fakeRepo = { id: 'r1', fullName: 'owner/repo', isActive: true };
    mockPrismaService.repository.findFirst.mockResolvedValue(fakeRepo);
    const result = await service.findActiveForUser('user-1');
    expect(result).toEqual(fakeRepo);
  });

  it('should connect a repo and set it active', async () => {
    const fakeRepo = { id: 'r1', fullName: 'owner/repo', defaultBranch: 'main' };
    const activeRepo = { ...fakeRepo, isActive: true };
    mockPrismaService.repository.upsert.mockResolvedValue(fakeRepo);
    mockPrismaService.repository.updateMany.mockResolvedValue({ count: 0 });
    mockPrismaService.repository.update.mockResolvedValue(activeRepo);

    const result = await service.connect('user-1', 'owner/repo');
    expect(result).toEqual(activeRepo);
    expect(mockPrismaService.repository.upsert).toHaveBeenCalled();
    expect(mockPrismaService.repository.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { isActive: true },
    });
  });

  it('should throw NotFoundException when repo not found for setActive', async () => {
    mockPrismaService.repository.findFirst.mockResolvedValue(null);
    await expect(service.setActive('user-1', 'bad-id')).rejects.toThrow('Repository not found');
  });
});
