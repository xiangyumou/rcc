# Feature-Based 架构重构计划

## Context

当前项目采用**按类型分层**的架构（server/client/shared），随着功能增加，代码耦合度变高，扩展困难。需要重构为**按功能组织**的架构（Feature-Based），提高模块化、可维护性和可扩展性。

### 当前问题
1. **index.ts 臃肿** - 所有 API 路由混在一起（~400行）
2. **app.js 臃肿** - 前端逻辑混合文件浏览器、会话管理、自定义命令等（~650行）
3. **类型定义分散** - 共享类型在单独文件，但功能相关逻辑分散
4. **复用困难** - 添加新功能需要修改多个地方
5. **测试困难** - 功能边界不清晰

### 目标架构
采用 **Feature-Based Architecture**，每个功能模块自包含：
```
features/
├── {feature}/
│   ├── index.ts      # 统一导出，功能门面
│   ├── types.ts      # 功能相关类型
│   ├── api.ts        # 后端 API 路由
│   ├── service.ts    # 后端业务逻辑
│   ├── client/       # 前端代码
│   │   ├── index.ts
│   │   ├── store.ts  # 状态管理
│   │   └── ui.ts     # UI 组件/逻辑
│   └── README.md     # 功能说明
```

---

## Phase 1: 核心基础设施抽象

### 1.1 创建 Core 模块

**目标**：抽象通用基础设施，供各功能使用

**文件变更**：
- `src/core/index.ts` - 核心模块统一导出
- `src/core/storage/` - 存储抽象层
  - `index.ts` - 统一导出
  - `types.ts` - 存储接口定义
  - `json-storage.ts` - JSON 文件存储实现（从原 storage.ts 提取）
- `src/core/pty/` - PTY 抽象层
  - `index.ts` - 统一导出
  - `types.ts` - PTY 接口定义
  - `node-pty.ts` - node-pty 实现（从原 pty.ts 提取）
- `src/core/websocket/` - WebSocket 管理
  - `index.ts` - WebSocket 服务器管理
  - `types.ts` - WebSocket 类型
- `src/core/router/` - 路由工具
  - `index.ts` - 路由注册工具

**关键抽象**：
```typescript
// core/storage/types.ts
export interface StorageAdapter<T> {
  read(key: string): Promise<T | null>;
  write(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

// core/pty/types.ts
export interface PTYAdapter {
  onData(callback: (data: string) => void): void;
  onExit(callback: (code: number) => void): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}
```

---

## Phase 2: 功能模块提取

### 2.1 Session 功能模块

**当前文件**：`src/server/session.ts`, `src/shared/types.ts` (Session 类型)

**新结构**：
```
src/features/session/
├── index.ts          # 导出: sessionManager, sessionRouter, Session
├── types.ts          # Session, SessionStatus, SessionOptions
├── manager.ts        # SessionManager 类（从原 session.ts 迁移）
├── api.ts            # /api/sessions/* 路由（从原 index.ts 提取）
├── websocket.ts      # WebSocket 会话处理
└── client/
    ├── index.ts      # 导出 SessionClient
    ├── store.ts      # 会话状态管理（从原 app.js 提取）
    └── ui.ts         # 会话列表 UI（从原 app.js 提取）
```

**迁移内容**：
- `SessionManager` 类从 `session.ts`
- Session 相关类型从 `types.ts`
- Session API 路由从 `index.ts` ( lines 65-148 )
- 前端会话管理逻辑从 `app.js` (lines 8-9, 240-260, 296-360)

### 2.2 Project 功能模块

**当前文件**：`src/server/storage.ts` (recent-projects 相关), `src/shared/types.ts`

**新结构**：
```
src/features/project/
├── index.ts          # 导出: projectService, projectRouter
├── types.ts          # Project, RecentProject
├── service.ts        # ProjectService 类
├── api.ts            # /api/recent-projects/* 路由
└── client/
    ├── index.ts
    ├── store.ts      # 项目列表状态管理
    └── ui.ts         # 项目列表 UI（sidebar）
```

**迁移内容**：
- `RecentProject` 类型
- `addRecentProject`, `removeRecentProject`, `loadRecentProjects` 从 `storage.ts`
- 前端项目列表逻辑从 `app.js`

### 2.3 FileBrowser 功能模块

**当前文件**：`src/server/file-browser.ts`

**新结构**：
```
src/features/file-browser/
├── index.ts          # 导出: fileBrowserService, fileBrowserRouter
├── types.ts          # FileItem, DirectoryListing
├── service.ts        # FileBrowserService 类
├── api.ts            # /api/fs/* 路由
└── client/
    ├── index.ts
    ├── store.ts      # 文件浏览器状态
    ├── ui.ts         # 文件浏览器弹窗 UI
    └── file-list.ts  # 文件列表渲染
```

**迁移内容**：
- `listDirectory`, `getHomeDirectory` 等从 `file-browser.ts`
- 前端文件浏览器逻辑从 `app.js` (lines 117-210)

### 2.4 Terminal 功能模块

**当前文件**：`src/server/pty.ts`, `src/client/terminal.js`, `src/server/state-detector.ts`

**新结构**：
```
src/features/terminal/
├── index.ts          # 导出: createTerminal, terminalRouter
├── types.ts          # Terminal, TerminalOptions
├── pty.ts            # PTY 创建（从原 pty.ts 提取）
├── state-detector.ts # 状态检测（从原 state-detector.ts 迁移）
├── websocket.ts      # 终端 WebSocket 处理
└── client/
    ├── index.ts      # TerminalManager
    ├── xterm.ts      # xterm.js 封装（从原 terminal.js 迁移）
    └── state.ts      # 终端状态显示
```

**迁移内容**：
- `createClaudePTY` 从 `pty.ts`
- `TerminalManager` 从 `terminal.js`
- 状态检测逻辑
- 前端终端状态指示器从 `app.js`

### 2.5 Commands 功能模块

**当前文件**：无独立文件，逻辑分散在 `app.js` 和 `types.ts`

**新结构**：
```
src/features/commands/
├── index.ts          # 导出: commandRegistry, quickCommands
├── types.ts          # Command, CommandCategory
├── registry.ts       # 命令注册表
├── builtin.ts        # 内置命令 (/clear, /help 等)
└── client/
    ├── index.ts
    ├── store.ts      # 自定义命令存储
    └── ui.ts         # 快捷按钮栏
```

**迁移内容**：
- 快捷命令定义从 `types.ts` STATE_PATTERNS 相关
- 自定义命令逻辑从 `app.js` (lines 444-521)
- 快捷按钮 UI 从 `app.js`

---

## Phase 3: 应用入口重构

### 3.1 后端入口

**文件**：`src/main.ts`（原 `src/server/index.ts` 简化）

```typescript
import { createServer } from './core';
import { sessionRouter } from './features/session';
import { projectRouter } from './features/project';
import { fileBrowserRouter } from './features/file-browser';
import { terminalRouter } from './features/terminal';

const app = createServer({
  features: [
    sessionRouter,
    projectRouter,
    fileBrowserRouter,
    terminalRouter
  ]
});

app.start(3000);
```

### 3.2 前端入口

**文件**：`src/client/main.ts`（原 `src/client/app.js` 简化）

```typescript
import { createApp } from './core/client';
import { sessionStore } from './features/session/client';
import { projectStore } from './features/project/client';
import { fileBrowserStore } from './features/file-browser/client';
import { terminalStore } from './features/terminal/client';
import { commandsStore } from './features/commands/client';

const app = createApp({
  features: [
    sessionStore,
    projectStore,
    fileBrowserStore,
    terminalStore,
    commandsStore
  ]
});

app.mount('#app');
```

---

## Phase 4: 扩展性设计

### 4.1 插件系统

**目标**：新功能可以通过插件方式添加

**设计**：
```typescript
// core/plugin/types.ts
export interface Plugin {
  name: string;
  version: string;
  register(server: Server): void;
  registerClient(app: ClientApp): void;
}

// 使用示例
import { loggingPlugin } from './plugins/logging';
import { metricsPlugin } from './plugins/metrics';

app.use(loggingPlugin);
app.use(metricsPlugin);
```

### 4.2 主题系统

**目标**：支持自定义主题

**设计**：
```
src/features/theme/
├── index.ts
├── types.ts
├── registry.ts
├── builtin/
│   ├── dark.ts
│   └── light.ts
└── client/
    └── theme-manager.ts
```

### 4.3 多会话支持（未来扩展）

**目标**：支持多标签页同时管理多个会话

**设计**：
```typescript
// features/workspace/
export interface Workspace {
  id: string;
  name: string;
  sessions: SessionTab[];
}

export interface SessionTab {
  id: string;
  sessionId: string;
  label: string;
  isActive: boolean;
}
```

---

## 文件映射表

| 原文件 | 新位置 | 说明 |
|--------|--------|------|
| `src/server/index.ts` | `src/main.ts` | 简化为入口 |
| `src/server/session.ts` | `src/features/session/manager.ts` | SessionManager |
| `src/server/storage.ts` | `src/core/storage/json-storage.ts` + `src/features/project/service.ts` | 拆分存储 |
| `src/server/file-browser.ts` | `src/features/file-browser/service.ts` | 文件浏览器服务 |
| `src/server/pty.ts` | `src/core/pty/node-pty.ts` + `src/features/terminal/pty.ts` | 拆分 PTY |
| `src/server/state-detector.ts` | `src/features/terminal/state-detector.ts` | 状态检测 |
| `src/shared/types.ts` | 各 `features/{name}/types.ts` | 类型分散到功能 |
| `src/client/app.js` | 各 `features/{name}/client/` | 前端逻辑拆分 |
| `src/client/terminal.js` | `src/features/terminal/client/xterm.ts` | 终端封装 |

---

## 实施步骤

### Phase 1: 测试基础设施 + Core 层

**目标**: 建立测试框架，实现核心抽象

**步骤**:
1. 安装测试依赖：`vitest`, `@vitest/coverage-v8`, `supertest`, `msw`
2. 创建 `tests/mocks/` - Mock 实现（storage, pty）
3. 创建 `src/core/` 目录结构
4. 实现 `core/storage/` 抽象 + JSON 实现 + **单元测试**
5. 实现 `core/pty/` 抽象 + **单元测试**
6. 实现 `core/router/` 路由工具 + **单元测试**

**验证**:
```bash
npm run test:unit -- core/  # 全部通过
npm run test:coverage        # core/ 覆盖率 > 90%
```

### Phase 2: Session 功能 + 测试

**目标**: 完成第一个功能模块，建立功能模板

**步骤**:
1. 创建 `src/features/session/` 结构
2. 迁移 `SessionManager` + **单元测试**
3. 迁移 Session API + **集成测试**
4. 迁移前端 Session Store + **单元测试**
5. 创建 `SessionFeature` 整合层

**验证**:
```bash
npm run test:unit -- session/
npm run test:integration -- session-api
```

### Phase 3: Project + FileBrowser + 测试

**目标**: 迁移独立功能模块

**步骤**:
1. **Project** 功能迁移 + 测试
2. **FileBrowser** 功能迁移 + 测试
3. **集成测试**: Project 与 Session 的交互

**验证**:
```bash
npm run test:unit -- project/ file-browser/
npm run test:integration
```

### Phase 4: Terminal + Commands + 测试

**目标**: 迁移复杂依赖功能

**步骤**:
1. **Terminal** 功能迁移（依赖 PTY）+ **单元测试**
2. **Commands** 功能迁移 + **单元测试**
3. **WebSocket 集成测试**
4. **E2E 测试**（Playwright 初始化）

**验证**:
```bash
npm run test:integration -- websocket
npm run test:e2e -- session-lifecycle
```

### Phase 5: 入口重构 + E2E 测试

**目标**: 整合所有功能，完整测试

**步骤**:
1. 重写 `src/main.ts` 后端入口
2. 重写 `src/client/main.ts` 前端入口
3. 编写完整 **E2E 测试套件**
4. 性能测试（可选）

**验证**:
```bash
npm run build
npm run test               # 全部测试
npm run test:coverage      # 整体覆盖率 > 80%
npm run test:e2e           # E2E 全部通过
```

### Phase 6: 清理与文档

**目标**: 移除旧代码，完善文档

**步骤**:
1. 删除 `src/server/`, `src/client/app.js`, `src/shared/`
2. 更新 `tsconfig.json`
3. 更新 README（新架构说明）
4. 编写 `docs/architecture.md`
5. 编写 `docs/adding-new-feature.md`（扩展指南）

**验证**:
```bash
npm run build
npm run test               # 确认无回归
# 手动验证完整流程
```

---

## 测试策略

### 测试架构

采用 **分层测试策略**，与 feature-based 架构对应：

```
tests/
├── unit/                    # 单元测试（函数/类级别）
│   ├── core/
│   │   ├── storage.test.ts
│   │   ├── pty.test.ts
│   │   └── router.test.ts
│   └── features/
│       ├── session/
│       │   ├── manager.test.ts
│       │   └── service.test.ts
│       ├── project/
│       ├── file-browser/
│       ├── terminal/
│       └── commands/
├── integration/             # 集成测试（功能模块级别）
│   ├── session-api.test.ts
│   ├── project-api.test.ts
│   ├── file-browser-api.test.ts
│   └── websocket.test.ts
└── e2e/                     # E2E 测试（完整流程）
    ├── session-lifecycle.test.ts
    ├── file-browser-flow.test.ts
    └── quick-commands.test.ts
```

### 测试工具

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^6.0.0",
    "playwright": "^1.40.0",
    "@playwright/test": "^1.40.0",
    "msw": "^2.0.0"
  }
}
```

### 各层测试内容

#### 1. Core 层单元测试

**目标**: 验证基础设施抽象正确性

```typescript
// tests/unit/core/storage.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSONStorageAdapter } from '../../../src/core/storage/json-storage';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('JSONStorageAdapter', () => {
  let tempDir: string;
  let storage: JSONStorageAdapter;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'storage-test-'));
    storage = new JSONStorageAdapter(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true });
  });

  it('should write and read data', async () => {
    const data = { name: 'test', value: 123 };
    await storage.write('test-key', data);
    const result = await storage.read('test-key');
    expect(result).toEqual(data);
  });

  it('should return null for non-existent key', async () => {
    const result = await storage.read('non-existent');
    expect(result).toBeNull();
  });

  it('should delete data', async () => {
    await storage.write('key', { data: true });
    await storage.delete('key');
    const result = await storage.read('key');
    expect(result).toBeNull();
  });

  it('should list all keys', async () => {
    await storage.write('key1', {});
    await storage.write('key2', {});
    const keys = await storage.list();
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
  });
});
```

#### 2. Feature 层单元测试

**目标**: 验证业务逻辑正确性

```typescript
// tests/unit/features/session/manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../../../../src/features/session/manager';
import { mockStorage } from '../../../mocks/storage';
import { mockPTY } from '../../../mocks/pty';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({
      storage: mockStorage,
      ptyFactory: mockPTY
    });
  });

  it('should create session with correct structure', async () => {
    const session = await manager.createSession('/test/project', ['-r']);

    expect(session).toMatchObject({
      projectPath: '/test/project',
      projectName: 'project',
      claudeOptions: ['-r'],
      status: 'running'
    });
    expect(session.id).toBeDefined();
    expect(session.createdAt).toBeDefined();
  });

  it('should store session in memory', async () => {
    const { session } = await manager.createSession('/test/project');
    const retrieved = await manager.getSession(session.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.session.id).toBe(session.id);
  });

  it('should terminate session', async () => {
    const { session } = await manager.createSession('/test/project');
    const terminated = await manager.terminateSession(session.id);

    expect(terminated).toBe(true);
    const retrieved = await manager.getSession(session.id);
    expect(retrieved?.session.status).toBe('stopped');
  });

  it('should reconnect to stopped session', async () => {
    const { session } = await manager.createSession('/test/project');
    await manager.terminateSession(session.id);

    const reconnected = await manager.reconnectSession(session.id);
    expect(reconnected).not.toBeNull();
    expect(reconnected?.session.status).toBe('running');
  });

  it('should update lastActiveAt on activity', async () => {
    const { session } = await manager.createSession('/test/project');
    const before = session.lastActiveAt;

    await new Promise(r => setTimeout(r, 10));
    manager.updateActivity(session.id);

    const retrieved = await manager.getSession(session.id);
    expect(retrieved?.session.lastActiveAt).toBeGreaterThan(before);
  });
});
```

#### 3. API 集成测试

**目标**: 验证 HTTP API 和 WebSocket 正确性

```typescript
// tests/integration/session-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestServer } from '../test-server';

describe('Session API', () => {
  let app: ReturnType<typeof createTestServer>;

  beforeAll(() => {
    app = createTestServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/sessions', () => {
    it('should create new session', async () => {
      const response = await request(app.server)
        .post('/api/sessions')
        .send({
          projectPath: '/test/project',
          claudeOptions: ['-r']
        })
        .expect(201);

      expect(response.body).toHaveProperty('session');
      expect(response.body.session).toMatchObject({
        projectPath: '/test/project',
        projectName: 'project',
        status: 'running'
      });
      expect(response.body).toHaveProperty('wsUrl');
    });

    it('should reject missing projectPath', async () => {
      await request(app.server)
        .post('/api/sessions')
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/sessions', () => {
    it('should list all sessions', async () => {
      await request(app.server)
        .post('/api/sessions')
        .send({ projectPath: '/test/project1' });

      await request(app.server)
        .post('/api/sessions')
        .send({ projectPath: '/test/project2' });

      const response = await request(app.server)
        .get('/api/sessions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should terminate session', async () => {
      const createRes = await request(app.server)
        .post('/api/sessions')
        .send({ projectPath: '/test/project' });

      const sessionId = createRes.body.session.id;

      await request(app.server)
        .delete(`/api/sessions/${sessionId}`)
        .expect(200);

      const getRes = await request(app.server)
        .get('/api/sessions');

      const session = getRes.body.find((s: any) => s.id === sessionId);
      expect(session?.status).toBe('stopped');
    });
  });
});
```

#### 4. WebSocket 集成测试

```typescript
// tests/integration/websocket.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createTestServer } from '../test-server';

describe('WebSocket Terminal', () => {
  let server: ReturnType<typeof createTestServer>;
  let sessionId: string;

  beforeAll(async () => {
    server = createTestServer();
    // Create a session first
    const response = await fetch(`${server.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: '/test' })
    });
    const data = await response.json();
    sessionId = data.session.id;
  });

  afterAll(async () => {
    await server.close();
  });

  it('should connect to session', (done) => {
    const ws = new WebSocket(`${server.wsUrl}/ws?sessionId=${sessionId}`);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('connected');
      ws.close();
      done();
    });
  });

  it('should receive output from terminal', (done) => {
    const ws = new WebSocket(`${server.wsUrl}/ws?sessionId=${sessionId}`);
    let receivedOutput = false;

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'output') {
        receivedOutput = true;
        expect(typeof msg.data).toBe('string');
        ws.close();
        done();
      }
    });
  });

  it('should send input to terminal', (done) => {
    const ws = new WebSocket(`${server.wsUrl}/ws?sessionId=${sessionId}`);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'input', data: 'echo test\r' }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'output' && msg.data.includes('test')) {
        ws.close();
        done();
      }
    });
  });
});
```

#### 5. E2E 测试（Playwright）

```typescript
// tests/e2e/session-lifecycle.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Session Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should create new session from file browser', async ({ page }) => {
    // Click "Open New Folder" button
    await page.click('text=打开新文件夹');

    // Wait for file browser modal
    await page.waitForSelector('#file-browser-modal');

    // Select first directory
    await page.click('.file-item.directory');
    await page.click('text=选择此文件夹');

    // Wait for settings modal
    await page.waitForSelector('#settings-modal');

    // Click start
    await page.click('text=启动');

    // Verify terminal appears
    await page.waitForSelector('#terminal-container');
    await expect(page.locator('#current-project')).not.toHaveText('-');
  });

  test('should reconnect to existing session', async ({ page }) => {
    // Create session first
    await page.click('text=打开新文件夹');
    await page.waitForSelector('#file-browser-modal');
    await page.click('.file-item.directory');
    await page.click('text=选择此文件夹');
    await page.waitForSelector('#settings-modal');
    await page.click('text=启动');
    await page.waitForSelector('#terminal-container');

    const projectName = await page.locator('#current-project').textContent();

    // Reload page
    await page.reload();

    // Click on active session
    await page.click('.active-sessions li');

    // Verify reconnected to same session
    await expect(page.locator('#current-project')).toHaveText(projectName!);
  });

  test('should send quick commands', async ({ page }) => {
    // Create session
    await page.click('text=打开新文件夹');
    await page.waitForSelector('#file-browser-modal');
    await page.click('.file-item.directory');
    await page.click('text=选择此文件夹');
    await page.waitForSelector('#settings-modal');
    await page.click('text=启动');
    await page.waitForSelector('#terminal-container');

    // Click /clear command
    await page.click('text=/clear');

    // Verify terminal cleared (output should be minimal)
    // This is a simplified check, actual implementation may vary
    await expect(page.locator('.xterm-rows')).toBeVisible();
  });
});
```

### Mock 实现

```typescript
// tests/mocks/storage.ts
import { StorageAdapter } from '../../src/core/storage/types';

export class MockStorage implements StorageAdapter<any> {
  private data = new Map<string, any>();

  async read(key: string) {
    return this.data.get(key) ?? null;
  }

  async write(key: string, value: any) {
    this.data.set(key, value);
  }

  async delete(key: string) {
    this.data.delete(key);
  }

  async list() {
    return Array.from(this.data.keys());
  }

  clear() {
    this.data.clear();
  }
}

export const mockStorage = new MockStorage();
```

```typescript
// tests/mocks/pty.ts
import { PTYAdapter } from '../../src/core/pty/types';
import { EventEmitter } from 'events';

export class MockPTY extends EventEmitter implements PTYAdapter {
  private _isRunning = true;
  private buffer = '';

  write(data: string) {
    this.buffer += data;
    // Echo back for testing
    if (data.includes('\r')) {
      this.emit('data', this.buffer + '\r\n');
      this.buffer = '';
    }
  }

  resize() {}

  kill() {
    this._isRunning = false;
    this.emit('exit', 0);
  }

  isRunning() {
    return this._isRunning;
  }

  simulateOutput(data: string) {
    this.emit('data', data);
  }
}

export const mockPTY = {
  create() {
    return new MockPTY();
  }
};
```

### 测试脚本

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest --config vitest.unit.config.ts",
    "test:integration": "vitest --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  }
}
```

---

## 验证计划

每个 Phase 完成后验证：

1. **编译检查**: `npm run build` 无错误
2. **单元测试**: `npm run test:unit` 通过率 > 95%
3. **集成测试**: `npm run test:integration` 全部通过
4. **E2E 测试**: `npm run test:e2e` 关键流程通过
5. **覆盖率**: `npm run test:coverage` 行覆盖率 > 80%
6. **代码审查**: 检查模块边界是否清晰
7. **扩展测试**: 尝试添加一个示例新功能，验证扩展性

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 重构破坏现有功能 | 分步实施，每步充分测试 |
| 代码量膨胀 | 保持模块精简，每个功能 <500 行 |
| 循环依赖 | 严格分层，core → features → app |
| TypeScript 类型错误 | 逐步迁移，确保类型定义完整 |

---

## 预期结果

重构后代码结构：
```
src/
├── core/               # ~300行，基础设施
│   ├── storage/
│   ├── pty/
│   ├── websocket/
│   └── router/
├── features/           # 各功能模块
│   ├── session/        # ~400行
│   ├── project/        # ~200行
│   ├── file-browser/   # ~300行
│   ├── terminal/       # ~500行
│   └── commands/       # ~200行
├── main.ts             # ~50行，后端入口
└── client/
    ├── main.ts         # ~50行，前端入口
    └── index.html
```

总代码量不变，但：
- 每个功能独立，边界清晰
- 添加新功能只需在 `features/` 下新建目录
- 测试可以针对单个功能进行
- 便于团队协作，减少冲突
