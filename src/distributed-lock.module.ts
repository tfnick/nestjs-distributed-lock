import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
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

    return {
      module: DistributedLockModule,
      providers,
      exports: [DistributedLockService, DistributedLockInterceptor],
      global: true,
    };
  }

  static forRootAsync(options: DistributedLockAsyncOptions): DynamicModule {
    const asyncOptionsProvider = this.createAsyncOptionsProvider(options);

    return {
      module: DistributedLockModule,
      imports: options.imports || [],          // 可以为空
      providers: [
        asyncOptionsProvider,                 // 只创建 options，不依赖 service
        DistributedLockService,
        DistributedLockInterceptor,
      ],
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
}
