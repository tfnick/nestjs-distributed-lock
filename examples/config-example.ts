import { Injectable, Module } from '@nestjs/common';
import { DistributedLockOptionsFactory, DistributedLockOptions } from '../src/interfaces';
import { DistributedLockModule } from '../src/distributed-lock.module';

// 模拟配置服务（在实际项目中，用户会使用自己的配置服务）
@Injectable()
export class MockConfigService {
  get<T>(key: string, defaultValue: T): T {
    // 模拟从配置文件中获取值
    const mockConfig = {
      'distributedLock.defaultTimeout': 30000,
      'distributedLock.maxRetries': 5,
      'distributedLock.retryDelay': 500,
    };
    
    return (mockConfig[key] as T) || defaultValue;
  }
}

/**
 * 使用配置服务配置分布式锁的示例
 * 用户可以在自己的项目中实现类似的配置工厂
 */
@Injectable()
export class DistributedLockConfigService implements DistributedLockOptionsFactory {
  constructor(private readonly configService: MockConfigService) {}

  createDistributedLockOptions(): DistributedLockOptions {
    // 从配置中获取参数，提供默认值
    const defaultTimeout = this.configService.get<number>('distributedLock.defaultTimeout', 30000);
    const maxRetries = this.configService.get<number>('distributedLock.maxRetries', 5);
    const retryDelay = this.configService.get<number>('distributedLock.retryDelay', 500);
    
    return {
      defaultTimeout,
      maxRetries,
      retryDelay,
    };
  }
}

// 使用示例模块配置
@Module({
  imports: [
    DistributedLockModule.forRootAsync({
      useClass: DistributedLockConfigService,
    }),
  ],
  providers: [MockConfigService],
})
export class ExampleWithConfigModule {}

// 另一种使用方式：直接使用 useFactory
@Module({
  imports: [
    DistributedLockModule.forRootAsync({
      useFactory: (configService: MockConfigService) => {
        const defaultTimeout = configService.get<number>('distributedLock.defaultTimeout', 30000);
        const maxRetries = configService.get<number>('distributedLock.maxRetries', 5);
        const retryDelay = configService.get<number>('distributedLock.retryDelay', 500);
        
        return {
          defaultTimeout,
          maxRetries,
          retryDelay,
        };
      },
      inject: [MockConfigService],
    }),
  ],
  providers: [MockConfigService],
})
export class ExampleWithFactoryModule {}

// 实际使用示例：演示如何在真实项目中集成
/**
 * 在真实项目中，你的配置可能这样实现：
 * 
 * 1. 安装 @nestjs/config
 * 2. 在 app.module.ts 中导入 ConfigModule
 * 3. 实现配置工厂
 */

/*
// 真实项目中的示例
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RealWorldDistributedLockConfig implements DistributedLockOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createDistributedLockOptions(): DistributedLockOptions {
    return {
      defaultTimeout: this.configService.get<number>('DISTRIBUTED_LOCK_DEFAULT_TIMEOUT', 30000),
      maxRetries: this.configService.get<number>('DISTRIBUTED_LOCK_MAX_RETRIES', 5),
      retryDelay: this.configService.get<number>('DISTRIBUTED_LOCK_RETRY_DELAY', 500),
    };
  }
}
*/

// 真实项目中的模块配置示例
/*
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DistributedLockModule.forRootAsync({
      useClass: RealWorldDistributedLockConfig,
    }),
  ],
})
export class AppModule {}
*/