# Claude Code Web Manager

一个基于 Web 的 Claude Code 会话管理器，让用户可以通过浏览器管理 Claude Code 会话，提供项目选择、会话持久化、快捷命令等增强功能。

## 功能特性

- **服务器端文件浏览器** - 浏览服务器/Docker 容器内的文件夹，选择项目路径（不是浏览器本地文件夹）
- **会话持久化** - 即使关闭浏览器，会话仍在后台运行，可随时重连
- **状态检测** - 实时检测 Claude Code 状态（权限请求、选项选择、计划模式等）
- **快捷命令** - 常用命令一键发送（/clear, /help, /compact 等）
- **启动选项** - 支持配置 Claude Code 启动参数（-r, --verbose, --debug 等）
- **自定义命令** - 支持添加自定义快捷命令
- **多会话管理** - 侧边栏显示活动会话，可快速切换

## 技术栈

- **后端**: Node.js + Express + WebSocket (ws)
- **终端 PTY**: node-pty
- **前端**: 原生 JavaScript + xterm.js
- **存储**: 本地 JSON 文件

## 安装

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build
```

## 使用

```bash
# 开发模式（使用 ts-node）
npm run dev

# 生产模式
npm start
```

然后打开浏览器访问 `http://localhost:3000`

## 快捷键

- `Shift + Tab` - 切换项目
- `Ctrl + D` - 退出当前会话
- `Ctrl + L` - 清屏
- `Esc` - 关闭弹窗

## 文件结构

```
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

## API 接口

### HTTP API

- `GET /api/recent-projects` - 获取最近项目列表
- `POST /api/recent-projects` - 添加/更新最近项目
- `DELETE /api/recent-projects/:path` - 删除指定项目
- `GET /api/sessions` - 列出所有会话
- `POST /api/sessions` - 创建新会话
- `POST /api/sessions/:id/reconnect` - 重新连接会话
- `DELETE /api/sessions/:id` - 终止会话

### WebSocket 协议

连接地址: `ws://localhost:3000/ws?sessionId={sessionId}`

**Client -> Server**
```typescript
{
  type: 'input' | 'resize' | 'ping';
  data?: string;     // 输入字符
  cols?: number;     // 终端列数
  rows?: number;     // 终端行数
}
```

**Server -> Client**
```typescript
{
  type: 'output' | 'state' | 'error' | 'connected';
  data?: string;           // 终端输出
  state?: DetectedState;   // 检测到的状态
}
```

## 状态检测

系统通过正则表达式检测 Claude Code 的各种状态：

- `PERMISSION_PROMPT` - 权限请求 (y/n)
- `CHOICE_PROMPT` - 多选提示
- `PLAN_MODE` - 计划模式激活
- `TOOL_EXECUTION` - 工具执行中
- `SESSION_END` - 会话结束
- `USER_INPUT` - 等待用户输入

## 开发计划

- [x] Phase 1: 基础架构
- [x] Phase 2: Session 管理
- [x] Phase 3: 项目选择器
- [x] Phase 4: 状态检测与增强功能
- [x] Phase 5: 启动选项与完善

## 后续扩展

- [ ] 多会话标签页支持
- [ ] 会话录制与回放
- [ ] 主题定制
- [ ] 多用户支持 (团队协作)

## License

MIT
