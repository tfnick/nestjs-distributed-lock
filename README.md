# @tfnick/nestjs-distributed-lock

NestJS分布式锁组件，基于PostgreSQL原生pg_advisory_lock

## 安装

```bash
npm install @tfnick/nestjs-distributed-lock
```

## 使用方法

### 基础配置

```typescript
import { DistributedLockModule } from '@tfnick/nestjs-distributed-lock';

@Module({
  imports: [
    DistributedLockModule.forRoot({
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
    })
  ]
})
export class AppModule {}
```

### 支持事务性数据源（推荐）

如果业务侧使用了 `addTransactionalDataSource` 创建代理数据源：

```typescript
import { DistributedLockModule } from '@tfnick/nestjs-distributed-lock';

// 方法一：直接传入代理数据源
const dataSource = addTransactionalDataSource(new DataSource(options));

DistributedLockModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const dbConfig = config.get('db.postgres');
    const dataSource = new DataSource(dbConfig);
    const transactionalDataSource = addTransactionalDataSource(dataSource);
    
    return {
      dataSource: transactionalDataSource, // 传入代理数据源
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
    };
  },
})
```

### 使用连接名称

```typescript
// 方法二：使用连接名称
DistributedLockModule.forRoot({
  connectionName: 'default', // 使用默认 TypeORM 连接
  defaultTimeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
})
```

### 与 TypeORM 事务性数据源配合使用

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DistributedLockModule } from '@tfnick/nestjs-distributed-lock';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      // ... 配置
    }),
    
    // 1. TypeORM 配置（使用事务性数据源）
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      async dataSourceFactory(options) {
        if (!options) {
          throw new Error('Invalid options passed');
        }
        return addTransactionalDataSource(new DataSource(options));
      },
      useFactory: (config: ConfigService) => {
        const dbConfig = config.get('db.postgres');
        return {
          logging: ['query', 'error', 'schema', 'warn', 'info'],
          logger: true,
          type: dbConfig.type || 'postgres',
          entities: [`${__dirname}/**/*.entity{.ts,.js}`, `${__dirname}/**/*.event{.ts,.js}`],
          autoLoadEntities: true,
          keepConnectionAlive: true,
          timezone: '+08:00',
          ...dbConfig,
          migrationsRun: false,
        } as TypeOrmModuleOptions;
      },
    }),
    
    // 2. 分布式锁配置（使用连接名称）
    DistributedLockModule.forRoot({
      connectionName: 'default', // 使用同一个 TypeORM 连接
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
    }),
  ],
})
export class AppModule {}
```

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

### 使用服务

```typescript
import { DistributedLockService } from '@tfnick/nestjs-distributed-lock';

@Injectable()
export class MyService {
  constructor(private readonly lockService: DistributedLockService) {}
  
  async doSomething() {
    // 使用锁执行代码
    await this.lockService.withLock('my-lock-key', async () => {
      // 临界区代码
      console.log('正在执行关键操作...');
    });
  }
  
  // 手动控制锁
  async criticalOperation() {
    const lock = await this.lockService.acquire('critical-section');
    
    try {
      // 执行关键操作
    } finally {
      await lock.release();
    }
  }
}
```

## 配置方式对比

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| `dataSource` 选项 | ✅ 直接支持代理数据源<br>✅ 配置简单 | ❌ 需要手动创建数据源 | 推荐方式，支持事务 |
| `connectionName` | ✅ 配置简单<br>✅ 与 TypeORM 集成 | ❌ 不支持代理数据源 | 简单场景 |
| 默认注入 | ✅ 最简单 | ❌ 不支持复杂场景 | 基础使用 |

## 注意事项

1. **依赖关系**：本模块依赖 `TypeOrmModule`，必须先配置好 TypeORM
2. **事务性数据源**：如果使用了 `addTransactionalDataSource`，建议通过 `dataSource` 选项传入
3. **连接名称**：使用 `connectionName` 时，确保 TypeORM 中有对应的命名连接
4. **数据库权限**：确保数据库用户有执行 `pg_advisory_lock` 等函数的权限

## 故障排除

### 错误：DataSource provider not found
```
Potential solutions:
- Is DistributedLockModule a valid NestJS module?
- If DataSource is a provider, is it part of the current DistributedLockModule?
- If DataSource is exported from a separate @Module, is that module imported within DistributedLockModule?
```

**解决方案：**
1. 确保使用正确的配置方式（推荐 `dataSource` 选项）
2. 如果使用 `connectionName`，确保 TypeORM 配置正确
3. 确保模块导入顺序正确

### 错误：Cannot find module
**解决方案：**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 版本
当前版本：1.0.9