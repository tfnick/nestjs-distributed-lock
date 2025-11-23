import { 
  Injectable, 
  NestInterceptor, 
  ExecutionContext, 
  CallHandler,
  Inject,
  Optional,
  Logger
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DistributedLockService } from '../distributed-lock.service';
import { LOCK_METADATA_KEY, LockDecoratorOptions } from '../decorators/lock.decorator';

interface ExtendedLockOptions extends LockDecoratorOptions {
  isDynamic?: boolean;
  dynamicFn?: (...args: any[]) => LockDecoratorOptions;
}

@Injectable()
export class DistributedLockInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DistributedLockInterceptor.name);

  constructor(
    @Inject(DistributedLockService)
    private readonly lockService: DistributedLockService,
    @Optional() private readonly reflector?: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const lockOptions = this.getLockOptions(context);
    
    if (!lockOptions) {
      return next.handle();
    }

    const finalOptions = this.resolveDynamicOptions(context, lockOptions);
    const lockKey = this.generateLockKey(context, finalOptions);
    
    try {
      // 使用锁保护方法执行
      return await this.lockService.withLock(
        lockKey,
        () => {
          return new Promise<Observable<any>>((resolve, reject) => {
            const result$ = next.handle().pipe(
              tap({
                error: (error) => {
                  this.logger.error(`锁保护的方法执行失败: ${lockKey}`, error);
                },
                complete: () => {
                  this.logger.debug(`锁保护的方法执行完成: ${lockKey}`);
                }
              })
            );
            
            resolve(result$);
          });
        },
        finalOptions
      );
    } catch (error) {
      this.logger.error(`获取锁失败: ${lockKey}`, error);
      throw error;
    }
  }

  private getLockOptions(context: ExecutionContext): ExtendedLockOptions | null {
    if (!this.reflector) {
      return null; // 如果没有Reflector，无法获取装饰器信息
    }
    
    return this.reflector.get<ExtendedLockOptions>(
      LOCK_METADATA_KEY,
      context.getHandler(),
    );
  }

  private resolveDynamicOptions(context: ExecutionContext, options: ExtendedLockOptions): LockDecoratorOptions {
    if (options.isDynamic && options.dynamicFn) {
      const args = this.getMethodArguments(context);
      return options.dynamicFn(...args);
    }
    return options;
  }

  private getMethodArguments(context: ExecutionContext): any[] {
    const args = context.getArgs();
    if (args.length > 0) {
      return args;
    }
    return [];
  }

  private generateLockKey(context: ExecutionContext, options: LockDecoratorOptions): string {
    if (options.key) {
      return options.key;
    }

    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;
    
    // 基于类名和方法名生成默认锁键
    return `${className}.${methodName}`;
  }
}