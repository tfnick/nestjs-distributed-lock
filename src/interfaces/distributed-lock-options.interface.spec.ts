import { DataSource } from 'typeorm';
import { DistributedLockOptions, DistributedLockOptionsFactory } from './distributed-lock-options.interface';

describe('DistributedLockOptions', () => {
  it('should accept empty options', () => {
    const options: DistributedLockOptions = {};
    expect(options).toBeDefined();
  });

  it('should accept connectionName', () => {
    const options: DistributedLockOptions = {
      connectionName: 'default',
    };
    expect(options.connectionName).toBe('default');
  });

  it('should accept dataSource', () => {
    const dataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
    });
    
    const options: DistributedLockOptions = {
      dataSource,
    };
    expect(options.dataSource).toBe(dataSource);
  });

  it('should accept timeout configuration', () => {
    const options: DistributedLockOptions = {
      defaultTimeout: 30000,
      maxRetries: 5,
      retryDelay: 1000,
    };
    
    expect(options.defaultTimeout).toBe(30000);
    expect(options.maxRetries).toBe(5);
    expect(options.retryDelay).toBe(1000);
  });

  it('should accept all options together', () => {
    const dataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
    });
    
    const options: DistributedLockOptions = {
      connectionName: 'default',
      dataSource,
      defaultTimeout: 60000,
      maxRetries: 10,
      retryDelay: 2000,
    };
    
    expect(options.connectionName).toBe('default');
    expect(options.dataSource).toBe(dataSource);
    expect(options.defaultTimeout).toBe(60000);
    expect(options.maxRetries).toBe(10);
    expect(options.retryDelay).toBe(2000);
  });
});

describe('DistributedLockOptionsFactory', () => {
  it('should be implemented as a class', () => {
    class TestOptionsFactory implements DistributedLockOptionsFactory {
      createDistributedLockOptions(): DistributedLockOptions {
        return {
          defaultTimeout: 5000,
          maxRetries: 3,
          retryDelay: 1000,
        };
      }
    }

    const factory = new TestOptionsFactory();
    const options = factory.createDistributedLockOptions();
    
    expect(options.defaultTimeout).toBe(5000);
    expect(options.maxRetries).toBe(3);
    expect(options.retryDelay).toBe(1000);
  });

  it('should support async factories', async () => {
    class AsyncOptionsFactory implements DistributedLockOptionsFactory {
      async createDistributedLockOptions(): Promise<DistributedLockOptions> {
        // 模拟异步配置加载
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          defaultTimeout: 10000,
          maxRetries: 2,
          retryDelay: 500,
        };
      }
    }

    const factory = new AsyncOptionsFactory();
    const options = await factory.createDistributedLockOptions();
    
    expect(options.defaultTimeout).toBe(10000);
    expect(options.maxRetries).toBe(2);
    expect(options.retryDelay).toBe(500);
  });
});