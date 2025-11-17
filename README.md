# NestJS Distributed Lock

基于PostgreSQL原生pg_advisory_lock的分布式锁组件，专为NestJS框架设计。

## 特性

- 🚀 基于PostgreSQL原生咨询锁，性能优异
- 🔒 支持多种锁模式（等待锁、非阻塞锁）
- ⚡ 自动重试机制
- 📦 开箱即用的NestJS模块
- 🎯 装饰器支持，使用简单
- 🛡️ 完善的异常处理

## 安装

```bash
npm install nestjs-distributed-lock
```

## 快速开始

### 1. 配置模块

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributedLockModule } from 'nestjs-distributed-lock';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'test',
      synchronize: true,
    }),
    DistributedLockModule.forRoot({
      defaultTimeout: 30000, // 默认超时时间30秒
      maxRetries: 3,        // 最大重试次数
      retryDelay: 1000,     // 重试间隔1秒
    }),
  ],
})
export class AppModule {}
```

### 2. 在服务中使用

```typescript
// order.service.ts
import { Injectable } from '@nestjs/common';
import { DistributedLockService } from 'nestjs-distributed-lock';

@Injectable()
export class OrderService {
  constructor(private readonly lockService: DistributedLockService) {}

  async processOrder(orderId: string) {
    // 使用锁保护订单处理过程
    return await this.lockService.withLock(
      `order:${orderId}`,
      async () => {
        // 这里执行需要加锁的业务逻辑
        console.log(`Processing order: ${orderId}`);
        await this.doBusinessLogic(orderId);
      },
      {
        timeout: 5000, // 5秒超时
        wait: true,    // 等待获取锁
      }
    );
  }

  private async doBusinessLogic(orderId: string) {
    // 业务逻辑实现
  }
}
```

### 3. 使用装饰器（推荐）

```typescript
// order.controller.ts
import { Controller, Post, Param } from '@nestjs/common';
import { Lock } from 'nestjs-distributed-lock';

@Controller('orders')
export class OrderController {
  
  @Post(':id/process')
  async processOrder(@Param('id') orderId: string, @Lock('order:${orderId}') lock: any) {
    try {
      // 执行业务逻辑
      console.log(`Processing order: ${orderId}`);
      
      // 方法执行完成后会自动释放锁
      return { success: true };
    } finally {
      // 确保锁被释放
      await lock.release();
    }
  }
}
```

## API文档

### DistributedLockService

#### acquire(key: string, options?: LockAcquireOptions): Promise<LockHandle>

获取分布式锁。

- `key`: 锁的唯一标识符
- `options`: 锁选项

```typescript
const lock = await lockService.acquire('my-lock', {
  timeout: 5000,    // 超时时间
  wait: true,       // 是否等待
  maxRetries: 3,    // 最大重试次数
  retryDelay: 1000, // 重试间隔
});

try {
  // 执行受保护的代码
} finally {
  await lock.release();
}
```

#### withLock<T>(key: string, fn: () => Promise<T>, options?: LockAcquireOptions): Promise<T>

自动获取和释放锁执行函数。

```typescript
await lockService.withLock('resource-key', async () => {
  // 受保护的代码
}, { timeout: 5000 });
```

#### release(key: string): Promise<void>

释放锁。

#### isLocked(key: string): Promise<boolean>

检查锁是否被持有。

### 装饰器

#### @Lock(options: LockDecoratorOptions | string)

方法级锁装饰器。

```typescript
@Lock('resource-key')
async myMethod() {
  // 受保护的代码
}

@Lock({ key: 'resource-key', timeout: 5000 })
async myMethod() {
  // 受保护的代码
}
```

## 配置选项

### DistributedLockOptions

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| connectionName | string | undefined | PostgreSQL连接名称 |
| defaultTimeout | number | 30000 | 默认锁超时时间（毫秒） |
| maxRetries | number | 3 | 自动重试次数 |
| retryDelay | number | 1000 | 重试间隔（毫秒） |

### LockAcquireOptions

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| timeout | number | 30000 | 锁超时时间（毫秒） |
| wait | boolean | true | 是否等待获取锁 |
| maxRetries | number | 3 | 自动重试次数 |
| retryDelay | number | 1000 | 重试间隔（毫秒） |

## 异常处理

组件提供了完善的异常处理机制：

- `LockAcquireTimeoutException`: 获取锁超时
- `LockAlreadyHeldException`: 锁已被占用
- `LockNotHeldException`: 未持有锁

```typescript
import { 
  LockAcquireTimeoutException,
  LockAlreadyHeldException 
} from 'nestjs-distributed-lock';

try {
  await lockService.acquire('key');
} catch (error) {
  if (error instanceof LockAlreadyHeldException) {
    // 处理锁已被占用的情况
  }
}
```

## 性能考虑

- 使用PostgreSQL原生咨询锁，性能优异
- 支持连接复用，避免频繁创建数据库连接
- 可配置的重试机制，提高并发场景下的成功率

## 注意事项

1. **数据库连接**: 确保PostgreSQL连接配置正确
2. **锁粒度**: 合理设计锁键，避免锁竞争和死锁
3. **超时设置**: 根据业务场景合理设置超时时间
4. **异常处理**: 确保在finally块中释放锁

## 许可证

MIT