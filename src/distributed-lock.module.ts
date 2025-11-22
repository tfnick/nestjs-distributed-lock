import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DistributedLockService } from './distributed-lock.service';
import { DistributedLockInterceptor } from './interceptors';
import { DistributedLockOptions, DistributedLockAsyncOptions, DistributedLockOptionsFactory } from './interfaces';
import { DISTRIBUTED_LOCK_MODULE_OPTIONS } from './distributed-lock.constants';

// TypeORM 0.3.0 中 getDataSourceToken 的正确路径
const getDataSourceToken = (name?: string) => name ? `${name}DataSource` : DataSource;

@Module({})
export class DistributedLockModule {
  static forRoot(options: DistributedLockOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: DISTRIBUTED_LOCK_MODULE_OPTIONS,
        useValue: options,
      },
      // 如果指定了数据源，创建对应的 provider
      ...(options.dataSource ? [{
        provide: DataSource,
        useValue: options.dataSource,
      }] : []),
      ...(options.connectionName ? [{
        provide: getDataSourceToken(options.connectionName),
        inject: [DataSource],
        useFactory: (dataSource: DataSource) => dataSource,
      }] : []),
      DistributedLockService,
      DistributedLockInterceptor,
    ];

    return {
      module: DistributedLockModule,
      providers,
      exports: [DistributedLockService, DistributedLockInterceptor],
      global: true, // 设置为全局模块，方便使用
    };
  }

  static forRootAsync(options: DistributedLockAsyncOptions): DynamicModule {
    const asyncOptionsProvider = this.createAsyncOptionsProvider(options);
    
    const providers: Provider[] = [
      asyncOptionsProvider,
      // 动态创建数据源 provider
      {
        provide: DataSource,
        inject: [DISTRIBUTED_LOCK_MODULE_OPTIONS],
        useFactory: (moduleOptions: DistributedLockOptions) => {
          // 这里需要等待异步配置完成后处理
          return moduleOptions.dataSource || null;
        },
      },
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

    const inject = [
      (options.useClass || options.useExisting) as Type<DistributedLockOptionsFactory>,
    ];

    return {
      provide: DISTRIBUTED_LOCK_MODULE_OPTIONS,
      useFactory: async (optionsFactory: DistributedLockOptionsFactory) =>
        await optionsFactory.createDistributedLockOptions(),
      inject,
    };
  }

  private static createDataSourceProvider(options: DistributedLockOptions): Provider {
    if (options.dataSource) {
      // 使用自定义数据源
      return {
        provide: DataSource,
        useValue: options.dataSource,
      };
    } else if (options.connectionName) {
      // 使用命名数据源
      return {
        provide: getDataSourceToken(options.connectionName),
        inject: [getDataSourceToken(options.connectionName)],
        useFactory: (dataSource: DataSource) => dataSource,
      };
    } else {
      // 使用默认数据源
      return {
        provide: DataSource,
        inject: [DataSource],
        useFactory: (dataSource: DataSource) => dataSource,
      };
    }
  }
}