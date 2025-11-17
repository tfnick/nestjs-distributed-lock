# @tfnick/nestjs-distributed-lock

NestJS分布式锁组件，基于PostgreSQL原生pg_advisory_lock

## 安装

```bash
npm install @tfnick/nestjs-distributed-lock
```

## 使用方法

### 导入模块

```typescript
import { DistributedLockModule } from '@tfnick/nestjs-distributed-lock';

@Module({
  imports: [
    DistributedLockModule.forRoot({
      // 配置项
    })
  ]
})
export class AppModule {}
```

### 使用服务

```typescript
import { DistributedLockService } from '@tfnick/nestjs-distributed-lock';

@Injectable()
export class MyService {
  constructor(private readonly lockService: DistributedLockService) {}
  
  async doSomething() {
    // 使用分布式锁
  }
}
```

## 问题排查

如果遇到导入错误，请确保：

1. 包已正确安装
2. TypeScript 配置正确（moduleResolution: "node"）
3. 清除缓存：`npm cache clean --force` 和 `rm -rf node_modules package-lock.json`
4. 重新安装：`npm install`

## 版本
当前版本：1.0.4