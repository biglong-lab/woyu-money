# 租金領域

> 房東收房客租金 — 多合約 × 多月、月度矩陣 + 批次標記
> 主要 UI：`/rental-management-enhanced`、`/rental-matrix`

## 主要表

| 表 | 用途 |
|----|------|
| `rental_contracts` | 租賃合約（房客、月租、起訖、押金） |
| 借用 `payment_items` (item_type='rental') | 每月應收一筆 |
| `payment_records` | 實際收款紀錄 |

## 核心概念：月度矩陣

5 種狀態：
- 已收（已建 payment_record）
- 待收（有 payment_item、無 record）
- 預估（自動延伸下個月、未實際建 item）
- 過期（已過月底、仍未收）
- 終止（合約 end_date 之前）

## 主要 endpoint

- `GET /api/rental-matrix?year=Y` — 合約 × 12 月矩陣
- `POST /api/rental-batch/mark-month-paid` — 一鍵本月全部已收
- `GET /api/rental-contracts` — 合約 CRUD

## 純函式 shared 模組

[`shared/rental-matrix.ts`](../../shared/rental-matrix.ts)：5 狀態矩陣組裝邏輯
（前後端共用）

## 相關文件

- ADR：暫無
- changes：2026-04-24 財務助理 5 大功能整合
