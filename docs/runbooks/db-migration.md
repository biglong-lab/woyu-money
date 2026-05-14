# DB Schema 同步 / Migration SOP

> ORM：Drizzle ORM + node-postgres
> 本地 DB：Docker container `woyu-postgres`（port 5439）
> 生產 DB：伺服器 container `woyu-money-db`

---

## 兩種同步方式

| 方式 | 適用場景 | 指令 |
|------|---------|------|
| `drizzle-kit push` | 開發 / 修復 schema 漂移 | 直接比對 `shared/schema.ts` 與 DB、生成 + 套用差異 |
| 手動跑 `.sql` migration | 生產、需要審計紀錄的場景 | `psql -f migrations/0008_xxx.sql` |

> ⚠️ 本專案目前**沒有用 drizzle 的 migration tracking 表**（無 `drizzle.__drizzle_migrations`），所以 `drizzle-kit migrate` 用不了。實務上用 `push`。

---

## 開發機常見場景

### 場景 A：本地 DB schema 落後 origin/main

**症狀**：跑測試 / 啟動 server 時看到 `column "xxx" does not exist`。

**修法**：
```bash
DATABASE_URL=postgresql://woyu:woyu123@localhost:5439/woyu_money \
  npx drizzle-kit push --force
```

`--force` 略過互動式確認，適合本機開發機。

### 場景 B：修改 schema 想試新版

1. 改 `shared/schema.ts`
2. 同樣跑 `drizzle-kit push`
3. 跑測試確認沒打壞

### 場景 C：本地資料想重置

不要 drop database，會破壞 docker-compose 的 volume 設定。改用：

```bash
DATABASE_URL=postgresql://woyu:woyu123@localhost:5439/woyu_money \
  npm run db:import   # 從 database_backup/ 還原
```

---

## 生產部署的 schema 變動

### 紀律

- ✅ **只允許 ADD COLUMN**（向前相容）
- ✅ **NOT NULL 欄位必須有 DEFAULT**（否則舊資料炸）
- ❌ **禁止 DROP COLUMN / DROP TABLE**（生產資料會遺失）
- ❌ **禁止改 column type**（先 ADD 新欄位、寫雙寫、再棄用舊欄位）

### 流程

1. 本地用 `drizzle-kit push` 驗證 schema 可套
2. 把 SQL 寫成 migration file：`migrations/NNNN_topic.sql`
3. PR / commit 含 migration
4. 部署前先在生產跑 migration：
   ```bash
   ssh root@172.233.89.147 'docker exec -i woyu-money-db psql -U woyu -d woyu_money' \
     < migrations/NNNN_topic.sql
   ```
5. 再跑 [部署 SOP](deploy.md)
6. 部署後抽查資料完整性（關鍵表的 count 與部署前比）

---

## 環境變數

| 變數 | 本地值 | 用途 |
|------|--------|------|
| `DATABASE_URL` | `postgresql://woyu:woyu123@localhost:5439/woyu_money` | drizzle-kit 連線 |
| `DOCKER_HOST` | （預設） | docker exec 用 |

---

## 踩過的坑

### 「`column "attribution" does not exist`」(2026-05-14)
- 起因：本地 DB 沒跑 `0008_property_groups_and_budget_attribution.sql`
- 症狀：origin/main 的程式碼用 `budget_items.attribution`，本地測試全部 500
- 修法：`npx drizzle-kit push --force` 一次補齊所有漂移欄位

### Migration tracking 缺失
- 本地 DB 沒有 `drizzle.__drizzle_migrations` 表
- `drizzle-kit migrate` 用不了（會找不到 tracking 表）
- 解：暫時都靠 `push`。未來想要審計時可手動建 tracking 表。

---

## 相關文件

- [部署 SOP](deploy.md)
- Drizzle schema：`shared/schema.ts`
- Migrations 目錄：`migrations/`
