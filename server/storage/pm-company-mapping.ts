import { db } from "../db"
import { sql } from "drizzle-orm"

// 5 分鐘 cache：mapping 幾乎不變、避免每次 query DB
const TTL_MS = 5 * 60 * 1000

interface Caches {
  companyToProject: Map<number, number>
  projectToCompany: Map<number, number>
  expiresAt: number
}

let cache: Caches | null = null

async function load(): Promise<Caches> {
  const rows = await db.execute<{ project_id: number; company_id: number }>(sql`
    SELECT project_id, company_id
    FROM pm_company_mapping
    WHERE is_active = TRUE
  `)
  const companyToProject = new Map<number, number>()
  const projectToCompany = new Map<number, number>()
  for (const r of rows.rows) {
    companyToProject.set(Number(r.company_id), Number(r.project_id))
    projectToCompany.set(Number(r.project_id), Number(r.company_id))
  }
  return {
    companyToProject,
    projectToCompany,
    expiresAt: Date.now() + TTL_MS,
  }
}

async function get(): Promise<Caches> {
  if (cache && cache.expiresAt > Date.now()) return cache
  cache = await load()
  return cache
}

export async function getCompanyToProjectMap(): Promise<Map<number, number>> {
  return (await get()).companyToProject
}

export async function getProjectToCompanyMap(): Promise<Map<number, number>> {
  return (await get()).projectToCompany
}

// 測試或 mapping 變動時手動清除
export function invalidatePmCompanyMappingCache(): void {
  cache = null
}
