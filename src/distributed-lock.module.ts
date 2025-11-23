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
      DistributedLockService,
      DistributedLockInterceptor,
    ];

    // 如果没有提供自定义数据源，尝试注入默认数据源
    if (!options.dataSource) {
      providers.push({
        provide: DataSource,
        inject: [DataSource],
        useFactory: (dataSource: DataSource) => dataSource,
      });
    } else {
      // 使用提供的自定义数据源
      providers.push({
        provide: DataSource,
        useValue: options.dataSource,
      });
    }

    return {
      module: DistributedLockModule,
      providers,
      exports: [DistributedLockService, DistributedLockInterceptor],
      global: true,
    };
  }

  static forRootAsync(options: DistributedLockAsyncOptions): DynamicModule {
    const asyncOptionsProvider = this.createAsyncOptionsProvider(options);
    
    const providers: Provider[] = [
      asyncOptionsProvider,
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