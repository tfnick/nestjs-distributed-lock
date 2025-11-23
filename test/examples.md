# 分布式锁测试示例

本文档展示了如何在业务项目中测试分布式锁功能。

## 🧪 测试环境设置

### 测试配置文件

```typescript
// test/setup.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DistributedLockModule } from '@tfnick/nestjs-distributed-lock';

// 测试数据源配置
const testDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'test_db',
  username: 'test_user',
  password: 'test_password',
  synchronize: false,
  logging: false,
});

export const createTestingModule = async () => {
  return Test.createTestingModule({
    imports: [
      DistributedLockModule.forRoot({
        dataSource: testDataSource,
        defaultTimeout: 5000,
        maxRetries: 2,
        retryDelay: 100,
      }),
    ],
  }).compile();
};
```

## 📋 业务测试用例示例

### 1. 用户服务并发测试

```typescript
// test/user.service.spec.ts
import { Test } from '@nestjs/testing';
import { UserService } from '../src/user.service';
import { createTestingModule } from './setup';

describe('UserService - 并发操作', () => {
  let userService: UserService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await createTestingModule();
    userService = module.get<UserService>(UserService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('应该防止用户余额被重复扣减', async () => {
    const userId = 'user-123';
    const initialBalance = 1000;
    
    // 设置初始余额
    await userService.setBalance(userId, initialBalance);

    // 并发扣款操作
    const deductPromises = Array(10).fill(0).map((_, index) =>
      userService.deductBalance(userId, 10, `order-${index}`)
    );

    // 等待所有操作完成
    const results = await Promise.all(deductPromises);

    // 验证最终余额
    const finalBalance = await userService.getBalance(userId);
    
    // 余额应该只被扣减一次（最多扣减100元）
    expect(finalBalance).toBeGreaterThanOrEqual(initialBalance - 100);
    
    // 验证只有一个订单成功
    const successCount = results.filter(Boolean).length;
    expect(successCount).toBe(1);
  });
});
```

### 2. 订单处理测试

```typescript
// test/order.service.spec.ts
import { Test } from '@nestjs/testing';
import { OrderService } from '../src/order.service';
import { createTestingModule } from './setup';

describe('OrderService - 订单处理', () => {
  let orderService: OrderService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await createTestingModule();
    orderService = module.get<OrderService>(OrderService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('应该防止重复创建订单', async () => {
    const orderId = 'order-abc-123';
    
    // 并发创建相同订单
    const createPromises = Array(5).fill(0).map(() =>
      orderService.createOrder({
        id: orderId,
        amount: 100,
        items: [{ id: 'item-1', quantity: 1 }],
      })
    );

    const results = await Promise.allSettled(createPromises);
    
    // 只应该有一个成功
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    expect(successCount).toBe(1);
    
    // 获取成功的订单
    const order = await orderService.getOrder(orderId);
    expect(order).toBeDefined();
    expect(order.status).toBe('created');
  });

  it('应该按顺序处理订单状态', async () => {
    const orderId = 'order-seq-456';
    
    // 创建订单
    await orderService.createOrder({ id: orderId, amount: 200 });
    
    // 按顺序更新状态
    const statusUpdates = ['paid', 'processing', 'shipped', 'delivered'];
    const updatePromises = statusUpdates.map((status, index) => 
      new Promise(resolve => 
        setTimeout(() => 
          orderService.updateStatus(orderId, status).then(resolve), 
          index * 100
        )
      )
    );

    await Promise.all(updatePromises);
    
    // 验证最终状态
    const finalOrder = await orderService.getOrder(orderId);
    expect(finalOrder.status).toBe('delivered');
  });
});
```

### 3. 缓存更新测试

```typescript
// test/cache.service.spec.ts
import { Test } from '@nestjs/testing';
import { CacheService } from '../src/cache.service';
import { createTestingModule } from './setup';

describe('CacheService - 缓存更新', () => {
  let cacheService: CacheService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await createTestingModule();
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('应该防止缓存不一致', async () => {
    const cacheKey = 'user-stats:123';
    
    // 设置初始缓存
    await cacheService.set(cacheKey, { count: 0 });
    
    // 并发更新计数器
    const updatePromises = Array(20).fill(0).map((_, index) =>
      cacheService.incrementCounter(cacheKey, 1, `update-${index}`)
    );

    await Promise.all(updatePromises);
    
    // 验证最终计数
    const finalCache = await cacheService.get(cacheKey);
    expect(finalCache.count).toBe(20);
  });

  it('应该处理缓存过期', async () => {
    const cacheKey = 'temp-data:456';
    
    // 设置带过期时间的缓存
    await cacheService.set(cacheKey, { data: 'test' }, { ttl: 1000 });
    
    // 等待过期
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // 验证缓存已过期
    const cachedData = await cacheService.get(cacheKey);
    expect(cachedData).toBeNull();
  });
});
```

## 🔄 集成测试

### 端到端测试

```typescript
// test/integration.spec.ts
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { createTestingModule } from './setup';

describe('分布式锁集成测试', () => {
  let app: INestApplication;
  let userService: UserService;
  let orderService: OrderService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    userService = module.get<UserService>(UserService);
    orderService = module.get<OrderService>(OrderService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('应该在高并发下保持数据一致性', async () => {
    const userId = 'integration-user-789';
    const orderId = 'integration-order-789';
    
    // 初始化用户数据
    await userService.createUser(userId, { balance: 500 });
    
    // 并发创建订单和扣款
    const operations = [
      orderService.createOrder({ id: orderId, userId, amount: 100 }),
      userService.deductBalance(userId, 100),
      orderService.createOrder({ id: orderId + '-alt', userId, amount: 100 }),
    ];

    const results = await Promise.allSettled(operations);
    
    // 验证数据一致性
    const finalUser = await userService.getUser(userId);
    const orders = await orderService.getOrdersByUser(userId);
    
    // 用户余额应该只被扣减一次
    expect(finalUser.balance).toBe(400);
    
    // 只应该有一个订单成功
    const successOrders = orders.filter(o => o.status === 'created');
    expect(successOrders).toHaveLength(1);
  });
});
```

## 🛠️ 性能测试

### 负载测试

```typescript
// test/performance.spec.ts
import { Test } from '@nestjs/testing';
import { DistributedLockService } from '@tfnick/nestjs-distributed-lock';
import { createTestingModule } from './setup';

describe('性能测试', () => {
  let lockService: DistributedLockService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await createTestingModule();
    lockService = module.get<DistributedLockService>(DistributedLockService);
  });

  it('应该处理大量并发锁请求', async () => {
    const lockCount = 1000;
    const startTime = Date.now();
    
    // 创建大量并发锁请求
    const lockPromises = Array(lockCount).fill(0).map((_, index) =>
      lockService.withLock(`perf-test-${index}`, async () => {
        // 模拟短暂操作
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      })
    );

    await Promise.all(lockPromises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 性能断言
    expect(duration).toBeLessThan(10000); // 10秒内完成
    console.log(`处理 ${lockCount} 个锁请求耗时: ${duration}ms`);
  });
});
```

## 📊 测试报告

### 覆盖率目标

- 🎯 **代码覆盖率**: 目标 90%+
- 🔧 **功能覆盖**: 100%核心功能
- 📈 **边界测试**: 覆盖异常和边界情况

### 测试分类

| 类型 | 说明 | 用例数量 |
|------|------|----------|
| 单元测试 | 测试单一功能 | 15+ |
| 集成测试 | 测试模块协作 | 5+ |
| 性能测试 | 验证性能指标 | 3+ |
| 边界测试 | 异常和错误情况 | 10+ |

## 🚀 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:cov

# 运行性能测试
npm test test/performance.spec.ts

# 按模式运行测试
npm test -- --testNamePattern="integration"

# 监视模式（开发时）
npm run test:watch
```

这些测试示例展示了如何在真实业务场景中验证分布式锁的正确性、性能和可靠性。