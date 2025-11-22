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

// 方法二：使用数据源名称
DistributedLockModule.forRootAsync({
  imports: [ConfigModule, TypeOrmModule.forRootAsync({...})],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return {
      connectionName: 'default', // 使用默认连接名称
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
    };
  },
})
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

## 注意事项

1. **依赖关系**：本模块依赖 `TypeOrmModule`，必须先配置好 TypeORM
2. **事务性数据源**：如果使用了 `addTransactionalDataSource`，建议通过 `dataSource` 选项传入
3. **数据库权限**：确保数据库用户有执行 `pg_advisory_lock` 等函数的权限

## 版本
当前版本：1.0.8