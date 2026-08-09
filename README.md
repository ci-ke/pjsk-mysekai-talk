# My SEKAI 蓝图与对话查看器

追踪你在「世界计划」My SEKAI 中的家具蓝图收集和角色家具对话观看进度的网页工具。

## 功能

- **全量家具目录** — 涵盖所有家具（含门 Gate），每个家具都有对应的蓝图条目（真实蓝图或无蓝图家具）
- **多语言支持** — 简体中文 / 日本語 / 繁體中文 / English / 한국어，独立数据文件
- **蓝图收集追踪** — 上传 My SEKAI 抓包 JSON，自动解析已持有的蓝图列表
- **角色家具对话进度** — 以对话组为单位统计已读/未读状态（组内任一对话已读即算整组已读），含隐藏对话标记；未读对话组可手动标记为已读（浏览器缓存）
- **多维度筛选** — 持有状态（全部家具 / 全部蓝图 / 已持有 / 未持有 / 无需蓝图）、角色（多选，Miku 按团体拆分）、对话状态（仅未读 / 仅已读 / 全部已读）、主副分类、关键词搜索
- **对话脚本查看** — 展开对话组，加载并查看具体对话台本

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 运行测试
npm test

# 生产构建
npm run build

# 拉取最新数据（从 Haruki 仓库生成 catalog 文件）
npm run data:sync
```

## 使用方式

1. 打开页面，选择语言（默认简体中文）
2. 上传 My SEKAI 接口抓包 JSON 或 Suite 响应 JSON（自动识别格式）
3. 页面自动计算蓝图持有状态和对话已读进度
4. 使用筛选器定位目标家具和对话

支持的输入格式：
- **My SEKAI 抓包** — 含 `updatedResources.userMysekaiBlueprints` 和 `userMysekaiCharacterTalks`
- **Suite 响应** — 仅含 `userMysekaiCharacterTalks`（仅对话进度，无蓝图数据）

## 项目结构

```
├── .github/workflows/     # CI/CD
│   ├── deploy-pages.yml   # 页面部署（push 触发或手动）
│   └── update-data.yml    # 每日定时拉取最新数据并提交到 main，间接触发部署
├── public/data/           # 编译时 COPY 到 dist，运行时 fetch 加载
├── scripts/
│   └── generate-catalog.mjs  # 从 Haruki master 生成多语言 catalog JSON
├── src/
│   ├── components/        # React UI 组件
│   │   ├── BlueprintCard.tsx   # 蓝图卡片（含对话组展开）
│   │   ├── FilterBar.tsx       # 筛选栏
│   │   ├── NoticeBanner.tsx    # 提示横幅
│   │   ├── ProgressSummary.tsx # 统计概览
│   │   ├── TalkViewer.tsx      # 对话脚本查看器
│   │   └── UploadPanel.tsx     # 数据上传面板
│   ├── domain/            # 纯逻辑（无 React 依赖）
│   │   ├── assets.ts      # 资源 URL 构建
│   │   ├── cache.ts       # localStorage 缓存
│   │   ├── catalog.ts     # 蓝图条目构建与统计
│   │   ├── filters.ts     # 筛选与排序
│   │   ├── format.ts      # 格式化工具
│   │   ├── userData.ts    # 用户 JSON 解析（双格式自动识别）
│   │   └── domain.test.ts # 单元测试
│   ├── types.ts           # 类型定义
│   ├── styles.css         # 全局样式
│   ├── App.tsx            # 根组件
│   └── main.tsx           # 入口
├── vite.config.ts
└── tsconfig.json
```

## 数据生成

`scripts/generate-catalog.mjs` 从 Team Haruki 的 GitHub 仓库拉取 master 数据，生成本地 catalog JSON。

```bash
# 生成全部五种语言
node scripts/generate-catalog.mjs

# 仅生成简体中文
node scripts/generate-catalog.mjs --lang=cn

# 从本地目录读取
node scripts/generate-catalog.mjs --lang=cn --source=../local-data/master

# 支持的语言: cn jp tw en kr
```

输出到 `public/data/catalog-{lang}.json` 和 `.min.json`。

## 部署

项目通过 GitHub Actions 部署到 GitHub Pages：

- **`deploy-pages.yml`** — 代码 push 到 main 时自动构建并部署完整网站，也可手动触发
- **`update-data.yml`** — 每日 UTC 00:00 自动从 Haruki 仓库拉取最新 master 数据，提交到 main 分支；该提交会间接触发 `deploy-pages.yml` 完成重新部署

需要在仓库 Settings → Pages 中设置 Source 为 **GitHub Actions**。

## 技术栈

- React 18 + TypeScript
- Vite 5
- Vitest（单元测试）
- 纯 CSS（无 UI 框架）
