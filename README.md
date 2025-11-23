# @tfnick/nestjs-distributed-lock

NestJS分布式锁组件，基于PostgreSQL原生pg_advisory_lock

## 安装

```bash
npm install @tfnick/nestjs-distributed-lock
```

## 🚀 快速开始

### 方式一：自动使用TypeORM连接（推荐）

```typescript
import { DistributedLockModule } from '@tfnick/nestjs-distributed-lock';

@Module({
  imports: [
    // 你的 TypeORM 配置
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      // ...
    }),
    
    // 分布式锁配置（自动使用TypeORM数据源）
    DistributedLockModule.forRoot({
      defaultTimeout: 30000,  // 30秒超时
      maxRetries: 3,          // 最多重试3次
      retryDelay: 1000,        // 重试间隔1秒
    }),
  ],
})
export class AppModule {}
```

### 方式二：自定义数据源

如果需要使用事务性数据源：

```typescript
import { DistributedLockModule } from '@tfnick/nestjs-distributed-lock';
import { addTransactionalDataSource } from 'typeorm-transactional';

@Module({
  imports: [
    DistributedLockModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dataSource = addTransactionalDataSource(new DataSource(config.get('database')));
        
        return {
          dataSource,              // 传入自定义数据源
          defaultTimeout: 30000,
          maxRetries: 3,
          retryDelay: 1000,
        };
      },
    }),
  ],
})
export class AppModule {}
```

或者直接注入TypeORM的DataSource：

```typescript
import { DistributedLockModule } from '@tfnick/nestjs-distributed-lock';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    DistributedLockModule.forRootAsync({
      imports: [TypeOrmModule],
      inject: [DataSource],
      useFactory: async (dataSource: DataSource) => ({
        dataSource,              // 使用 TypeORM 最终提供的 DataSource（已代理）
        defaultTimeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
      }),
    }),
  ],
})
export class AppModule {}
```

## 📖 API 使用

### 在服务中注入

```typescript
import { Injectable } from '@nestjs/common';
import { DistributedLockService } from '@tfnick/nestjs-distributed-lock';

@Injectable()
export class UserService {
  constructor(private readonly lockService: DistributedLockService) {}

  async updateUser(id: string, data: any) {
    // 方式一：自动管理锁（推荐）
    await this.lockService.withLock(`user:${id}`, async () => {
      // 临界区代码 - 自动获取和释放锁
      console.log('正在更新用户数据...');
      // ... 更新逻辑
    });
  }

  async deleteUser(id: string) {
    // 方式二：手动控制锁
    const lock = await this.lockService.acquire(`user:${id}`);
    
    try {
      // 关键操作
      await this.performDeletion(id);
    } finally {
      await lock.release(); // 确保锁被释放
    }
  }
}
```

### 在控制器中使用装饰器

```typescript
import { Controller, Post } from '@nestjs/common';
import { Lock } from '@tfnick/nestjs-distributed-lock';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post(':id/lock')
  @Lock('user-lock-{id}') // 自动锁获取和释放
  async lockUser(id: string) {
    return this.userService.updateUser(id, { locked: true });
  }
}
```

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `dataSource` | `DataSource` | - | 自定义数据源（支持事务性数据源） |
| `connectionName` | `string` | - | TypeORM连接名称 |
| `defaultTimeout` | `number` | `30000` | 锁超时时间（毫秒） |
| `maxRetries` | `number` | `3` | 最大重试次数 |
| `retryDelay` | `number` | `1000` | 重试间隔（毫秒） |

### 配置选项

```typescript
interface DistributedLockOptions {
  /** PostgreSQL连接名称（用于连接多个数据库的情况） */
  connectionName?: string;
  
  /** 自定义数据源（用于支持代理数据源） */
  dataSource?: DataSource;
  
  /** 默认锁超时时间（毫秒） */
  defaultTimeout?: number;
  
  /** 自动重试次数 */
  maxRetries?: number;
  
  /** 重试间隔（毫秒） */
  retryDelay?: number;
}
```

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率
npm run test:cov

# 监视模式（开发时使用）
npm run test:watch
```

### 测试覆盖

✅ **核心功能测试**
- 锁获取和释放
- 非阻塞锁模式
- 重试机制
- 超时处理

✅ **集成测试**
- 模块配置
- 数据源注入
- 异步配置

✅ **边界测试**
- 异常处理
- 锁状态查询
- 键生成算法

## 🔧 高级用法

### 检查锁状态

```typescript
async checkLockStatus(key: string) {
  const isLocked = await this.lockService.isLocked(key);
  if (isLocked) {
    console.log(`锁 ${key} 正被持有`);
    return false;
  }
  return true;
}
```

### 自定义重试策略

```typescript
DistributedLockModule.forRoot({
  defaultTimeout: 60000,  // 1分钟超时
  maxRetries: 10,          // 最多重试10次
  retryDelay: 500,         // 重试间隔500ms
})
```

### 组合使用装饰器和服务

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly lockService: DistributedLockService) {}

  @Lock('order-processing') // 方法级锁
  async processOrder(orderId: string) {
    // 装饰器自动处理锁，但也可以使用服务
    const orderLock = await this.lockService.acquire(`order-detail:${orderId}`);
    try {
      await this.processOrderItems(orderId);
    } finally {
      await orderLock.release();
    }
  }
}
```

## 🔑 键值映射与唯一性保证

### 哈希算法设计

本库使用**FNV-1a 32位哈希算法**确保字符串到数字的唯一性映射：

```typescript
private generateLockKey(key: string): number {
  // PostgreSQL advisory lock支持64位有符号整数
  const hash = this.fnv1a32(key);
  
  // 确保是正数且在合理范围内
  return Math.abs(hash) % 2147483647; // PostgreSQL最大正整数
}

/**
 * FNV-1a 32位哈希算法
 * 具有良好的分布性和较低的冲突率
 */
private fnv1a32(str: string): number {
  let hash = 0x811c9dc5; // FNV偏移基础值
  
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV质数
  }
  
  // 确保结果在32位范围内
  return hash >>> 0;
}
```

### 唯一性保证机制

#### 1. **算法选择**
- **FNV-1a哈希**：工业标准的字符串哈希算法
- **良好分布**：均匀分布在数值空间中
- **低冲突率**：不同字符串产生相同数值的概率极低

#### 2. **数值范围控制**
- **PostgreSQL限制**：`pg_advisory_lock`接受64位有符号整数
- **安全边界**：限制在2,147,483,647（最大32位正整数）
- **符号处理**：确保始终为正数

#### 3. **碰撞检测**
```typescript
// 相似键值的哈希分布测试
const keys = ['order:123', 'order:124', 'order:125'];
const hashes = keys.map(key => lockService.generateLockKey(key));

// 检查唯一性
const uniqueHashes = new Set(hashes);
console.log(`唯一性: ${uniqueHashes.size}/${keys.length} keys`);
```

### 最佳实践建议

#### 1. **键值命名规范**
```typescript
// ✅ 推荐：有层次结构的命名
await lockService.withLock('order:123:payment', async () => {});
await lockService.withLock('user:456:profile', async () => {});
await lockService.withLock('inventory:789:stock', async () => {});

// ❌ 避免：过于简单或冲突风险高的命名
await lockService.withLock('lock1', async () => {});
await lockService.withLock('abc', async () => {});
```

#### 2. **避免哈希冲突**
```typescript
// ✅ 使用业务唯一标识符
const lockKey = `order:${orderId}:payment:${paymentId}`;

// ❌ 避免仅使用数字或简单字符
const lockKey = `${orderId}`;
```

#### 3. **测试验证**
```typescript
// 开发阶段验证哈希唯一性
function testHashUniqueness(keys: string[]) {
  const hashes = keys.map(key => service.generateLockKey(key));
  const unique = new Set(hashes);
  
  console.log(`测试${keys.length}个键值，${unique.size}个唯一哈希`);
  return unique.size === keys.length;
}
```

## ⚡ 性能优化

### 最佳实践

1. **锁粒度**: 使用细粒度锁，避免死锁
   ```typescript
   // ❌ 粗粒度锁 - 可能造成死锁
   await this.lockService.withLock('orders', async () => { ... });
   
   // ✅ 细粒度锁 - 更好的并发性
   await this.lockService.withLock(`order:${orderId}`, async () => { ... });
   ```

2. **锁超时**: 根据业务逻辑设置合理的超时时间
   ```typescript
   // 短时操作
   await this.lockService.withLock('cache-update', updateCache, { timeout: 5000 });
   
   // 长时操作
   await this.lockService.withLock('report-generation', generateReport, { timeout: 300000 });
   ```

3. **重试策略**: 避免过度重试
   ```typescript
   DistributedLockModule.forRoot({
     maxRetries: 3,      // 适度的重试次数
     retryDelay: 1000,    // 合理的重试间隔
   });
   ```

## ⚠️ 注意事项

### 依赖关系
- 🔗 **TypeORM依赖**: 必须先配置 `TypeOrmModule`
- 📦 **PostgreSQL**: 仅支持PostgreSQL数据库（使用advisory locks）
- 🔐 **数据库权限**: 确保用户有执行 `pg_advisory_*` 函数的权限
- 🔄 **版本兼容**: 支持不同TypeORM版本，避免类型冲突

### 最佳实践
- 🎯 **锁命名**: 使用有意义的命名空间，如 `user:{id}`, `order:{id}`
- ⏱️ **超时设置**: 根据业务复杂度设置合理超时时间
- 🔄 **重试策略**: 避免过度重试，保护数据库性能

## 🚨 故障排除

### 常见问题

#### 1. DataSource provider not found
```typescript
// ❌ 错误配置
DistributedLockModule.forRoot(); // 没有TypeORM连接

// ✅ 正确配置
DistributedLockModule.forRoot({
  defaultTimeout: 30000,
}); // 会自动使用TypeORM的DataSource
```

#### 2. 自定义数据源问题
```typescript
// ❌ 直接使用原始数据源
const dataSource = new DataSource(options);
DistributedLockModule.forRoot({ dataSource });

// ✅ 使用事务性数据源
const dataSource = addTransactionalDataSource(new DataSource(options));
DistributedLockModule.forRoot({ dataSource });
```

#### 3. TypeORM版本冲突
```typescript
// ❌ 类型不兼容错误（多个TypeORM版本）
// 'DataSourceOptions' 类型不兼容

// ✅ 解决方案1：使用any类型
DistributedLockModule.forRootAsync({
  inject: [DataSource],
  useFactory: async (dataSource: any) => ({
    dataSource,
    defaultTimeout: 30000,
  }),
});

// ✅ 解决方案2：使用类型断言
DistributedLockModule.forRootAsync({
  inject: [DataSource],
  useFactory: async (dataSource: DataSource) => ({
    dataSource: dataSource as any,
    defaultTimeout: 30000,
  }),
});
```

#### 4. Reflector依赖问题
```typescript
// ❌ 错误：Nest can't resolve dependencies of DistributedLockInterceptor
// Error: Reflector at index [0] is available in the DistributedLockModule context

// ✅ 解决方案1：Reflector现在是可选依赖
// 拦截器会优雅地处理Reflector不存在的情况
DistributedLockModule.forRootAsync({
  imports: [TypeOrmModule],
  inject: [DataSource],
  useFactory: async (dataSource: DataSource) => ({
    dataSource,
    defaultTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
  }),
});

// ✅ 解决方案2：如果你的应用需要装饰器功能
// 确保在应用的主模块中导入了Reflector
import { Reflector } from '@nestjs/core';

@Module({
  providers: [Reflector], // 在根模块中提供Reflector
})
export class AppModule {}
```

#### 5. 锁释放问题
```typescript
// ❌ 问题：release ignored, lock not held
// 原因：锁在queryRunner中获取，但在不同连接中释放

// ✅ 解决方案1：使用withLock（推荐）
await lockService.withLock('resource-key', async () => {
  // 自动管理锁的获取和释放，使用相同连接
  await criticalOperation();
});

// ✅ 解决方案2：正确的手动方式
const lock = await lockService.acquire('resource-key', { wait: true });
try {
  await criticalOperation();
} finally {
  await lock.release(); // 现在使用相同连接释放
}

// ✅ 解决方案3：验证修复
const lock = await lockService.acquire('resource-key', { wait: true });
try {
  console.log('business logic');
} finally {
  await lock.release(); // 日志：release lock success，不再有 lock not held
}
```

#### 6. 锁冲突
```typescript
// ❌ 可能造成死锁
await lock1.acquire('resource'); // 进程A
await lock2.acquire('resource'); // 进程B - 可能死锁

// ✅ 使用有序锁获取
await lock1.acquire('resource:step1');
await lock2.acquire('resource:step2'); // 明确顺序
```

### 调试技巧

1. **启用日志**:
   ```typescript
   DistributedLockModule.forRoot({
     defaultTimeout: 30000,
   });
   // 查看日志输出中的锁操作信息
   ```

2. **测试连接**:
   ```bash
   # 测试PostgreSQL连接
   psql -h localhost -U username -d database -c "SELECT pg_advisory_lock(1);"
   ```

3. **监控锁状态**:
   ```sql
   -- 查看当前持有的advisory locks
   SELECT * FROM pg_locks WHERE locktype = 'advisory';
   ```

## 版本
当前版本：1.2.0

## 更新日志

### v1.2.0
- ✅ 添加完整的测试套件
- ✅ 支持锁获取、释放、重试等核心功能测试
- ✅ 模块集成测试
- ✅ 配置接口测试
- ✅ 异常处理测试

### v1.1.0
- ✅ 修复 connectionName 支持问题
- ✅ 完善依赖注入机制
- ✅ 支持事务性数据源

### v1.0.8
- ✅ 修复包发布配置
- ✅ 添加 files 字段
- ✅ 正确的导出路径

### v1.0.5
- ✅ 添加作者邮箱
- ✅ 支持 ConfigService 异步配置