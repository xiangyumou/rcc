# Claude Code Web Manager 实施计划

## 项目背景与目标

创建一个本地 Web 应用程序，让用户可以通过浏览器管理 Claude Code 会话，提供项目选择、会话持久化、快捷命令等增强功能。

## 技术架构

### 技术栈
- **后端**: Node.js + Express + WebSocket (ws)
- **终端PTY**: node-pty (与底层 shell/Claude Code 通信)
- **前端**: 原生 JavaScript + xterm.js (终端渲染)
- **存储**: 本地 JSON 文件 (无需数据库)

### 核心组件

```
┌─────────────────────────────────────────────────────────────────┐
│                         浏览器 (Frontend)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ 项目选择器  │  │ 快捷按钮栏   │  │    xterm.js 终端        │  │
│  │ (文件输入)  │  │(/clear等)   │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────┘
                     │ WebSocket
┌────────────────────▼────────────────────────────────────────────┐
│                      服务端 (Backend)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ HTTP API    │  │ WebSocket   │  │    Session Manager      │  │
│  │ (项目/配置)  │  │   Server    │  │  (进程管理/状态追踪)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                    │                            │
│                           ┌────────▼────────┐                   │
│                           │   node-pty      │                   │
│                           │ (PTY 伪终端)    │                   │
│                           └────────┬────────┘                   │
│                                    │ spawn                      │
│                           ┌────────▼────────┐                   │
│                           │  claude Code    │                   │
│                           │    CLI 进程      │                   │
│                           └─────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## 文件结构

```
/Users/xiangyu/Projects/rcc/
├── src/
│   ├── server/
│   │   ├── index.ts          # 服务入口
│   │   ├── session.ts        # Session 管理器
│   │   ├── pty.ts            # PTY 进程管理
│   │   ├── state-detector.ts # Claude 状态检测
│   │   └── storage.ts        # 本地存储操作
│   ├── client/
│   │   ├── index.html        # 主页面
│   │   ├── app.js            # 前端逻辑
│   │   ├── terminal.js       # xterm.js 封装
│   │   └── style.css         # 样式
│   └── shared/
│       └── types.ts          # 共享类型定义
├── data/
│   ├── recent-projects.json  # 最近项目列表
│   └── sessions/             # 会话状态存储
├── package.json
└── tsconfig.json
```

## 核心功能实现

### 1. Session 持久化

会话数据结构:
```typescript
interface Session {
  id: string;                    // 唯一标识
  projectPath: string;           // 项目路径
  claudeOptions: string[];       // 启动参数 (-r, --verbose 等)
  status: 'running' | 'paused' | 'stopped';
  createdAt: number;
  lastActiveAt: number;
}
```

- Session 元数据保存到 `data/sessions/{id}.json`
- PTY 进程在服务端保持运行，即使用户关闭浏览器
- 用户重新打开页面时，通过 session ID 重新连接到现有 PTY

### 2. Claude Code 状态检测 (正则方案)

通过监听 PTY 输出流，使用正则匹配关键状态:

```typescript
const STATE_PATTERNS = {
  // 权限请求 (y/n)
  PERMISSION_PROMPT: /\(y\/n\)|\[y\/N\]|allow\?|permit\?/i,

  // 多选提示
  CHOICE_PROMPT: /\(\d+(-\d+)?\)|select.*option|choose.*number/i,

  // 工具调用等待
  TOOL_EXECUTION: /Executing.*\.\.\.|Running.*command/i,

  // 会话结束
  SESSION_END: /Goodbye!|Session ended|Exiting\.\.\./i,

  // 需要用户输入
  USER_INPUT: />\s*$|:\s*$|\$\s*$/,

  // Plan mode 激活
  PLAN_MODE: /Plan mode is active|Entering plan mode/i
};
```

检测逻辑:
```typescript
function detectState(output: string): DetectedState {
  for (const [type, pattern] of Object.entries(STATE_PATTERNS)) {
    if (pattern.test(output)) {
      return { type, match: output.match(pattern) };
    }
  }
  return { type: 'normal' };
}
```

### 3. 最近项目存储

`data/recent-projects.json`:
```json
{
  "projects": [
    {
      "path": "/Users/xiangyu/project-a",
      "name": "project-a",
      "lastOpened": 1709700000000,
      "openCount": 5
    }
  ]
}
```

- 最多保留 10 个
- LRU 淘汰策略

### 4. API 设计

#### HTTP API
```
GET    /api/recent-projects          # 获取最近项目列表
POST   /api/recent-projects          # 添加/更新最近项目
DELETE /api/recent-projects/:path    # 删除指定项目

GET    /api/sessions                 # 列出所有活动会话
POST   /api/sessions                 # 创建新会话
DELETE /api/sessions/:id             # 终止会话
```

#### WebSocket 协议
```typescript
// Client -> Server
interface WSMessage {
  type: 'input' | 'resize' | 'ping';
  data?: string;           // 输入字符
  cols?: number;           // 终端列数
  rows?: number;           // 终端行数
}

// Server -> Client
interface WSMessage {
  type: 'output' | 'state' | 'error';
  data?: string;           // 终端输出
  state?: DetectedState;   // 检测到的状态
}
```

### 5. 前端界面

主界面布局:
```
┌─────────────────────────────────────────────────────────┐
│  Claude Code Web Manager                    [设置 ▼]   │
├─────────────────────────────────────────────────────────┤
│  最近项目          │                                     │
│  ┌──────────────┐  │                                     │
│  │ 📁 project-a │  │    [终端区域 - xterm.js]             │
│  │ 📁 project-b │  │                                     │
│  │ 📁 project-c │  │    $ claude                         │
│  └──────────────┘  │    > Hello! How can I help?         │
│                    │                                     │
│  [+ 打开新文件夹]   │                                     │
├────────────────────┘                                     │
│  快捷命令: [ /clear ] [ /help ] [ /compact ] [ 自定义+ ]  │
├─────────────────────────────────────────────────────────┤
│  状态: ● 运行中  |  Shift+Tab: 切换项目  |  Ctrl+D: 退出  │
└─────────────────────────────────────────────────────────┘
```

## 实现阶段

### Phase 1: 基础架构 (Day 1)
1. 初始化项目 (package.json, tsconfig.json)
2. 搭建 Express + WebSocket 服务
3. 集成 node-pty，实现基本 PTY 通信
4. 创建基础前端页面，集成 xterm.js
5. 验证：能在浏览器中打开终端并输入命令

### Phase 2: Session 管理 (Day 2)
1. 实现 Session 数据结构和管理器
2. 实现 Session 持久化存储
3. 实现断开重连机制 (session ID -> PTY 映射)
4. 验证：关闭浏览器后重新打开能恢复会话

### Phase 3: 项目选择器 (Day 3)
1. 实现最近项目存储和管理
2. 前端项目列表 UI
3. 文件选择器 (HTML input type="file" webkitdirectory)
4. 创建新会话流程整合
5. 验证：能选择项目并启动对应会话

### Phase 4: 状态检测与增强 (Day 4)
1. 实现状态检测正则逻辑
2. 状态通知机制 (WebSocket 推送到前端)
3. 快捷命令按钮栏
4. 键盘快捷键绑定
5. 验证：状态检测准确，快捷按钮工作

### Phase 5: 启动选项与完善 (Day 5)
1. Claude Code 启动选项配置 UI (-r, --verbose 等)
2. 设置面板 (自定义快捷键、命令按钮)
3. 错误处理和边界情况
4. 代码整理和文档
5. 端到端测试

## 关键依赖

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "ws": "^8.16.0",
    "node-pty": "^1.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/ws": "^8.5.0"
  }
}
```

前端 CDN:
- xterm.js: `https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js`
- xterm-addon-fit: `https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js`

## 验证方案

每个 Phase 完成后的验证步骤:

1. **基础功能**: `npm run dev` 后，浏览器访问 `http://localhost:3000`，能看到终端并输入命令
2. **Session 持久化**: 启动会话后关闭浏览器标签，重新打开，能自动重连并看到之前的输出
3. **项目选择**: 能选择本地文件夹，看到最近项目列表，点击能快速启动
4. **状态检测**: 在 Claude Code 中触发权限请求，界面能显示相应的状态指示器
5. **完整流程**: 从选择项目 -> 配置参数 -> 启动会话 -> 使用快捷命令 -> 关闭重连的全流程

## 后续扩展 (可选)

- 多会话标签页支持
- 会话录制与回放
- 与 Claude API 直接集成 (非 CLI 模式)
- 主题定制
- 多用户支持 (团队协作)
