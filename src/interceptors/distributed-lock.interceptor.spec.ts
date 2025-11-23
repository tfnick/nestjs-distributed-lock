import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { DistributedLockInterceptor } from './distributed-lock.interceptor';
import { DistributedLockService } from '../distributed-lock.service';
import { DistributedLockModule } from '../distributed-lock.module';

describe('DistributedLockInterceptor', () => {
  let interceptor: DistributedLockInterceptor;
  let reflector: Reflector;
  let lockService: DistributedLockService;
  let module: TestingModule;

  beforeEach(async () => {
    const dataSourceMock = {
      query: jest.fn().mockResolvedValue([]),
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      }),
    } as any;

    module = await Test.createTestingModule({
      imports: [
        DistributedLockModule.forRoot({
          dataSource: dataSourceMock,
        }),
      ],
    }).compile();

    interceptor = module.get<DistributedLockInterceptor>(DistributedLockInterceptor);
    reflector = module.get<Reflector>(Reflector);
    lockService = module.get<DistributedLockService>(DistributedLockService);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
    expect(reflector).toBeDefined();
    expect(lockService).toBeDefined();
  });

  it('should have correct dependencies injected', () => {
    expect(interceptor['lockService']).toBe(lockService);
    expect(interceptor['reflector']).toBeDefined();
  });

  // 简化测试，主要验证模块和依赖注入
  it('should be able to create interceptor with correct dependencies', async () => {
    const testModule = await Test.createTestingModule({
      controllers: [],
      providers: [
        DistributedLockInterceptor,
        {
          provide: DistributedLockService,
          useFactory: () => ({
            withLock: jest.fn(),
          }),
        },
      ],
    })
    .compile();

    const testInterceptor = testModule.get<DistributedLockInterceptor>(DistributedLockInterceptor);
    expect(testInterceptor).toBeDefined();
    await testModule.close();
  });
});