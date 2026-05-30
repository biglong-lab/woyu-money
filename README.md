# 浯島財務管理系統（Money）

民宿營運 + 家庭理財 + AI 單據辨識 Web 應用。生產站：https://money.homi.cc

## 技術棧

- **Frontend**: React 18 + Vite + TypeScript + wouter + TanStack Query + shadcn/ui + Tailwind
- **Backend**: Express + PostgreSQL + Drizzle ORM
- **AI**: Google Gemini（單據辨識）
- **整合**: PM / PMS 旅館系統 webhook、LINE 登入、Web Push

## 本機開發

```bash
# 1. 設定環境變數
cp .env.example .env  # 填入真實值

# 2. 啟動本地 PostgreSQL（Docker、port 5439）
docker compose -f docker-compose.dev.yml up -d  # 或自行起 woyu-postgres container

# 3. 套用 schema
DATABASE_URL=postgresql://woyu:woyu123@localhost:5439/woyu_money npx drizzle-kit push

# 4. 啟動 dev server（port 5001、macOS AirPlay 佔用 5000）
npm run dev
```

預設帳號：`admin` / `admin123`

## 部署（手動）

```bash
# 1. 確認生產 .env 已設 POSTGRES_PASSWORD + SESSION_SECRET（必填）
# 2. push 到 GitHub
git push origin main

# 3. SSH 部署
ssh root@172.233.89.147 'cd /www/wwwroot/woyu-money && \
  git fetch origin && git reset --hard origin/main && \
  docker compose up -d --build --force-recreate app'

# 4. 套用待處理的 DB migrations（如有）
./scripts/migrate.sh prod
```

詳細部署 SOP：[docs/runbooks/deploy.md](docs/runbooks/deploy.md)

## 重要文件

- [專案規範與紅線](CLAUDE.md)（如有）
- [docs/](docs/) — 完整文件目錄
  - [docs/README.md](docs/README.md) — 文件索引
  - [docs/domains/](docs/domains/) — 業務領域 source of truth
  - [docs/runbooks/](docs/runbooks/) — 維運手冊
  - [docs/changes/](docs/changes/) — 大型變動紀錄
  - [docs/decisions/](docs/decisions/) — ADR

## 維運常用指令

```bash
# DB 備份
./scripts/backup-full.sh prod

# DB 還原演練（到本機）
./scripts/restore-full.sh <dump-file>

# Migrations 套用
./scripts/migrate.sh prod --dry-run    # 看待套用
./scripts/migrate.sh prod              # 套用

# 跑全測試（會清 kids fixture）
docker exec woyu-postgres psql -U woyu -d woyu_money \
  -c "TRUNCATE kids_accounts RESTART IDENTITY CASCADE;"
npm run test
```

## 開發約定

- 程式碼上限：800 行 / 檔、50 行 / 函式
- DB schema **只 ADD COLUMN、禁 DROP**
- Commit 規範：Conventional Commits（`feat:` `fix:` `refactor:` etc）
- 中文 commit 訊息 + 中文程式碼註解

## 授權

私有專案、大哉實業有限公司（biglong-lab）。
