# RCC 架构文档

## 概述

RCC (Remote Claude Code) 采用 **Feature-Based Architecture**，按功能组织代码，而非按类型分层。

## 目录结构

```
src/
├── core/                    # 核心基础设施（可复用）
│   ├── storage/            # 存储抽象层
│   ├── pty/                # PTY 抽象层
│   ├── websocket/          # WebSocket 管理
│   └── router/             # 路由工具
├── features/               # 功能模块
│   ├── session/            # 会话管理
│   ├── project/            # 项目/最近项目
│   ├── file-browser/       # 文件浏览器
│   ├── terminal/           # 终端状态检测
│   └── commands/           # 命令注册表
├── client/                 # 前端代码
└── main.ts                 # 后端入口
```

## Core 层

### Storage
- **接口**: `StorageAdapter<T>` - 通用存储接口
- **实现**: `JSONStorageAdapter` - JSON 文件存储
- **位置**: `src/core/storage/`

### PTY
- **接口**: `PTYAdapter` - PTY 抽象接口
- **实现**: `NodePTYAdapter` - node-pty 实现
- **位置**: `src/core/pty/`

### WebSocket
- **类**: `WebSocketManager` - WebSocket 连接管理
- **功能**: 心跳检测、消息路由、广播
- **位置**: `src/core/websocket/`

### Router
- **接口**: `FeatureRouter` - 功能路由接口
- **工具**: `sendSuccess`, `sendError`, `asyncHandler`
- **位置**: `src/core/router/`

## 功能模块

每个功能模块包含：
- `types.ts` - 类型定义
- `service.ts` 或 `manager.ts` - 业务逻辑
- `api.ts` - API 路由
- `index.ts` - 统一导出

### Session 模块
- **功能**: 会话生命周期管理
- **关键类**: `SessionManager`
- **API**: `/api/sessions/*`

### Project 模块
- **功能**: 最近项目列表管理
- **关键类**: `ProjectService`
- **API**: `/api/recent-projects/*`

### FileBrowser 模块
- **功能**: 目录浏览、文件列表
- **关键类**: `FileBrowserService`
- **API**: `/api/fs/*`

### Commands 模块
- **功能**: 快捷命令管理
- **关键类**: `CommandRegistry`
- **API**: `/api/commands/*`

### Terminal 模块
- **功能**: 状态检测、类型定义
- **关键函数**: `detectState()`

## 扩展新功能

添加新功能的步骤：

1. 在 `src/features/{feature}/` 创建目录
2. 定义类型 (`types.ts`)
3. 实现服务 (`service.ts`)
4. 创建 API (`api.ts`)
5. 导出功能 (`index.ts`)
6. 在 `main.ts` 注册

示例：

```typescript
// src/features/my-feature/index.ts
export function createMyFeature() {
  const service = new MyService();
  const router: FeatureRouter = {
    getBasePath: () => '/api/my-feature',
    getRouter: () => createMyRouter(service)
  };
  return { service, router };
}

// src/main.ts
const myFeature = createMyFeature();
const server = createServer({
  features: [..., myFeature.router]
});
```

## 测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行覆盖率
npm run test:coverage
```

测试结构：
```
tests/
├── unit/               # 单元测试
│   ├── core/          # Core 层测试
│   └── features/      # 功能模块测试
├── integration/        # 集成测试
├── e2e/               # E2E 测试
└── mocks/             # Mock 实现
```

## 编译和运行

```bash
# 编译 TypeScript
npm run build

# 开发模式
npm run dev

# 生产模式
npm start
```
