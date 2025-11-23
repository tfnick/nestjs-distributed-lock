import { DynamicModule, Module, Provider } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DistributedLockService } from './distributed-lock.service';
import { DistributedLockInterceptor } from './interceptors';
import {
  DistributedLockOptions,
  DistributedLockAsyncOptions,
  DistributedLockOptionsFactory,
} from './interfaces';
import { DISTRIBUTED_LOCK_MODULE_OPTIONS } from './distributed-lock.constants';

/**
 * 简化的数据源获取函数
 */
const getDataSourceToken = (name?: string): string | typeof DataSource => 
  name ? `${name}DataSource` : DataSource;

@Module({})
export class DistributedLockModule {
  /**
   * 简单同步配置
   */
  static forRoot(options: DistributedLockOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: DISTRIBUTED_LOCK_MODULE_OPTIONS,
        useValue: options,
      },
      // 如果提供了自定义数据源，使用它；否则使用默认数据源
      ...(options.dataSource ? [{
        provide: DataSource,
        useValue: options.dataSource,
      }] : [{
        provide: DataSource,
        inject: [DataSource],
        useFactory: (dataSource: DataSource) => dataSource,
      }]),
      DistributedLockService,
      DistributedLockInterceptor,
    ];

    return {
      module: DistributedLockModule,
      providers,
      exports: [DistributedLockService, DistributedLockInterceptor],
      global: true,
    };
  }

  /**
   * 异步配置，支持依赖注入
   */
  static forRootAsync(options: DistributedLockAsyncOptions): DynamicModule {
    const asyncOptionsProvider = this.createAsyncOptionsProvider(options);

    const providers: Provider[] = [
      asyncOptionsProvider,
      DistributedLockService,
      DistributedLockInterceptor,
    ];

    return {
      module: DistributedLockModule,
      imports: options.imports || [],
      providers,
      exports: [DistributedLockService, DistributedLockInterceptor],
      global: true,
    };
  }

  /**
   * 创建异步选项提供者
   */
  private static createAsyncOptionsProvider(
    options: DistributedLockAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: DISTRIBUTED_LOCK_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    if (options.useClass) {
      return {
        provide: DISTRIBUTED_LOCK_MODULE_OPTIONS,
        useFactory: async (factory: DistributedLockOptionsFactory) =>
          factory.createDistributedLockOptions(),
        inject: [options.useClass],
      };
    }

    if (options.useExisting) {
      return {
        provide: DISTRIBUTED_LOCK_MODULE_OPTIONS,
        useFactory: async (factory: DistributedLockOptionsFactory) =>
          factory.createDistributedLockOptions(),
        inject: [options.useExisting],
      };
    }

    throw new Error('Invalid async options: one of useFactory, useClass, or useExisting must be provided');
  }
}
