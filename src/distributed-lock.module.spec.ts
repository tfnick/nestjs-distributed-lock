import { Test, TestingModule } from '@nestjs/testing';
import { DistributedLockModule } from './distributed-lock.module';
import { DistributedLockService } from './distributed-lock.service';
import { DataSource } from 'typeorm';

describe('DistributedLockModule', () => {
  describe('forRoot', () => {
    it('should compile module with custom dataSource', async () => {
      const mockDataSource = {
        query: jest.fn(),
        createQueryRunner: jest.fn(),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        imports: [DistributedLockModule.forRoot({
          dataSource: mockDataSource,
          defaultTimeout: 5000,
          maxRetries: 3,
          retryDelay: 200,
        })],
      }).compile();

      expect(module).toBeDefined();
      expect(module.get(DistributedLockService)).toBeDefined();
      await module.close();
    });
  });
});