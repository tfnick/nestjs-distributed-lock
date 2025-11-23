import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DistributedLockService } from './distributed-lock.service';
import { DistributedLockInterceptor } from './interceptors';
import {
  DistributedLockOptions,
  DistributedLockAsyncOptions,
  DistributedLockOptionsFactory,
} from './interfaces';
import { DISTRIBUTED_LOCK_MODULE_OPTIONS } from './distributed-lock.constants';

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

    // ⬅ 重要：若提供 dataSource，则覆盖 DataSource provider
    if (options.dataSource) {
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
      // ⬅ 新增一个 "动态 DataSource provider"
      this.createAsyncDataSourceProvider(),
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

  // ⬅ 新增：根据 async options 生成 DataSource provider
  private static createAsyncDataSourceProvider(): Provider {
    return {
      provide: DataSource,
      inject: [DISTRIBUTED_LOCK_MODULE_OPTIONS],
      useFactory: (options: DistributedLockOptions) => {
        // 如果 useFactory 返回了 dataSource，则提供它
        if (options?.dataSource) {
          return options.dataSource;
        }
        // 否则由 Nest 去注入默认 DataSource（TypeORM Module）
        // 返回 undefined 让 Nest 注入默认 DataSource
        return undefined;
      },
    };
  }
}
