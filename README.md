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
- 行程分账：行程账定总预算和交通/住宿/餐饮/门票四项计划数，成员开垫付单按分项对账，支持挂起、结清、两种结算模式和旧数据升级。
- Socket.IO 支持行程成员即时聊天。
- 旅行日记和用户主页为后续扩展预留清晰模块。

## 行程分账规则

- 行程发起人在行程账里定总预算和四项计划数，并录入各分项实际花费作为对账目标。
- 同行成员各自开垫付单，写清垫的金额、分项和分摊人。
- 两边按分项对账：垫付合计与行程账该分项实际花费对不上的先挂起，不计入已花金额。
- 成员改金额或撤单：已结清的分项不回退，没结清的按新数重算。
- 结算支持两种模式：保留原凭证另开调整单，或覆盖旧单；结算页对两种模式分别展示。
- 成员上报失败只重跑他那几条，行程账其余数据照旧。
- 旧数据没有分摊人和分项，升级时按行程人数和总预算各分项剩余额度补齐，补不出的单列待人工处理。

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
│           └── expense        # 行程分账（行程账/垫付单/对账/结算/旧数据升级）
├── database
├── frontend
│   └── src
│       └── expense            # 行程分账页面
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
