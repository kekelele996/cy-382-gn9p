# 旅伴匹配与行程共享平台

帮助用户发布旅行计划、匹配旅伴、协作规划行程并在旅途中实时沟通。

## 快速启动

```bash
cp .env.example .env
docker compose up -d --build
```

访问地址：前端 http://localhost:18402 ，后端 http://localhost:19402/health 。

## 项目主要功能

- 发布包含目的地、时间、预算、交通方式和旅伴偏好的行程。
- 根据目的地、时间和预算做旅伴匹配评分。
- 行程协作看板维护每日安排、住宿和交通方案。
- 行程分账：发起人在行程账里定总预算和交通/住宿/餐饮/门票四项计划数，成员各自开垫付单（金额、分项、分摊人），按分项对账，对不上自动挂起、不计入已花；结清后冻结，改单撤单不回退；支持「保留凭证开调整单」与「覆盖旧单」两种结算方式；成员上报失败只重放本人条目（幂等）；旧数据按人数和计划数比例补齐，补不出的单列。
- 预算管理展示计划费用和实际花费。
- Socket.IO 支持行程成员即时聊天。
- 旅行日记和用户主页为后续扩展预留清晰模块。

## 行程分账规则

| 概念 | 规则 |
| --- | --- |
| 行程账 | 发起人定总预算与四项计划数（四项之和=总预算），并按分项登记实际花费 |
| 垫付单 | 同行成员各自上报，必须写清金额、分项（四项之一）和分摊人（同行成员） |
| 按分项对账 | 垫付合计与行程账实际花费逐项比对：相符 MATCHED、不符 SUSPENDED 挂起 |
| 已花金额 | 只统计「相符」和「已结清」分项；挂起与待对账一律不计入 |
| 改单/撤单 | 已结清分项冻结不回退；未结清分项按新数整项重算 |
| 结算方式 | ADJUST 保留全部原凭证、另开一张差额调整单（多退为负数）；OVERWRITE 新开合计单覆盖旧单，旧单标记已覆盖；两种方式在结算页分区展示 |
| 失败重跑 | 上报带 `clientKey` 幂等键；批量上报逐条独立事务，成员失败只重跑他那几条，行程账不回滚 |
| 旧数据升级 | 缺分摊人/分项的旧单：分摊人补成全部同行成员，分项按四项计划数比例拆分（尾差归计划数最大项，总额守恒）；无成员或无计划数时标记 UNRESOLVED 单列 |

金额约定：数据库按元（DECIMAL(12,2)）存储，应用层与 API 一律使用「分」整数，前端展示时换算，避免浮点误差。

### 分账接口

- `POST /api/trips/:tripId/expense/account` 设定总预算与四项计划数
- `PUT  /api/trips/:tripId/expense/categories/:category/actual` 登记分项实际花费
- `GET  /api/trips/:tripId/expense/overview` 分项对账概览（已花/剩余/挂起项）
- `POST/GET /api/trips/:tripId/expense/members` 同行成员
- `POST/GET/PUT /api/trips/:tripId/expense/slips`、`POST /slips/batch`、`POST /slips/:id/withdraw` 垫付单
- `POST/GET /api/trips/:tripId/expense/settlements`、`GET /settlements/:id` 结算（ADJUST/OVERWRITE）
- `POST/GET /api/trips/:tripId/expense/legacy`、`POST /legacy/:id/upgrade` 旧数据登记与升级补齐

### 分账逻辑自校验（无需数据库）

```bash
cd backend
npm install
npm run build
npm run verify:expense              # 纯对账/补齐逻辑断言
npm run verify:expense:integration  # 内存 SQLite + TypeORM 跑完整业务链路
```


## 本地开发方式

```bash
cd backend
npm install
npm run start:dev
```

```bash
cd frontend
npm install
npm run dev
```

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Ant Design、Vite、高德地图 JS API |
| 后端 | NestJS、TypeScript、TypeORM、JWT、Socket.IO |
| 数据库 | MySQL 8.0 |
| 部署 | Docker Compose、Nginx |

## 项目目录结构

```text
.
├── backend
│   └── src
│       ├── common
│       ├── constants
│       ├── config
│       └── modules
├── database
├── frontend
│   └── src
└── docker-compose.yml
```

## 环境变量说明

| 变量 | 说明 |
| --- | --- |
| COMPOSE_PROJECT_NAME | Compose 项目名，默认 tripmatch |
| DATABASE_HOST | MySQL 服务主机名 |
| DATABASE_NAME | 数据库名称 |
| DATABASE_USER | 数据库用户 |
| JWT_SECRET | JWT 签名密钥 |
| AMAP_KEY | 高德地图 JS API Key |

## Docker 部署说明

- 前端端口：`18402:80`
- 后端端口：`19402:3000`
- MySQL 数据通过命名卷 `tripmatch-db-data` 持久化。
- Nginx 同时代理 `/api` 与 `/socket.io`，支持 WebSocket Upgrade。

## License

MIT
