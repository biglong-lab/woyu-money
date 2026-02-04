import * as XLSX from 'xlsx';
import { db } from './db';
import { dailyPmsRecords, paymentProjects } from '@shared/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

export interface ImportedRecord {
  date: string;
  currentMonthRevenue: number;
  nextMonthRevenue: number;
  futureMonthRevenue: number;
  projectName: string;
}

export class DataImporter {
  /**
   * 處理 Excel 文件並提取業績數據
   */
  async importExcelFile(filePath: string): Promise<{
    success: boolean;
    records: ImportedRecord[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const records: ImportedRecord[] = [];

    try {
      // 檢查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 讀取 Excel 文件
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 將工作表轉換為 JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false
      });

      if (jsonData.length === 0) {
        errors.push('Excel 文件為空');
        return { success: false, records: [], errors };
      }

      // 分析表頭以識別欄位
      const headers = jsonData[0] as string[];
      const columnMap = this.identifyColumns(headers);

      if (!columnMap.dateColumn) {
        errors.push('無法識別日期欄位');
      }

      // 處理數據行
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        
        try {
          const record = this.parseRow(row, columnMap, i + 1);
          if (record) {
            records.push(record);
          }
        } catch (error) {
          errors.push(`第 ${i + 1} 行錯誤: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        records,
        errors
      };

    } catch (error) {
      errors.push(`讀取文件失敗: ${error.message}`);
      return { success: false, records: [], errors };
    }
  }

  /**
   * 識別 Excel 欄位對應
   */
  private identifyColumns(headers: string[]): {
    dateColumn?: number;
    revenueColumns: number[];
    projectColumn?: number;
  } {
    const columnMap = {
      dateColumn: undefined as number | undefined,
      revenueColumns: [] as number[],
      projectColumn: undefined as number | undefined
    };

    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase().trim();
      
      // 識別日期欄位
      if (headerLower.includes('日期') || 
          headerLower.includes('date') || 
          headerLower.includes('時間')) {
        columnMap.dateColumn = index;
      }
      
      // 識別營收欄位
      if (headerLower.includes('營收') || 
          headerLower.includes('業績') || 
          headerLower.includes('收入') ||
          headerLower.includes('revenue') ||
          headerLower.includes('amount') ||
          headerLower.includes('金額')) {
        columnMap.revenueColumns.push(index);
      }
      
      // 識別專案欄位
      if (headerLower.includes('專案') || 
          headerLower.includes('項目') || 
          headerLower.includes('project') ||
          headerLower.includes('文旅') ||
          headerLower.includes('輕旅')) {
        columnMap.projectColumn = index;
      }
    });

    return columnMap;
  }

  /**
   * 解析單行數據
   */
  private parseRow(row: any[], columnMap: any, rowNumber: number): ImportedRecord | null {
    if (!columnMap.dateColumn) {
      throw new Error('缺少日期欄位');
    }

    // 解析日期
    const dateValue = row[columnMap.dateColumn];
    if (!dateValue) {
      return null; // 跳過空白行
    }

    const date = this.parseDate(dateValue);
    if (!date) {
      throw new Error(`無效的日期格式: ${dateValue}`);
    }

    // 解析營收數據
    const revenueValues = columnMap.revenueColumns.map(col => {
      const value = row[col];
      return this.parseNumber(value);
    }).filter(v => v !== null);

    if (revenueValues.length === 0) {
      throw new Error('缺少營收數據');
    }

    // 根據可用數據分配到三個月份
    const currentMonthRevenue = revenueValues[0] || 0;
    const nextMonthRevenue = revenueValues[1] || revenueValues[0] || 0;
    const futureMonthRevenue = revenueValues[2] || revenueValues[1] || revenueValues[0] || 0;

    // 解析專案名稱
    const projectName = columnMap.projectColumn ? 
      (row[columnMap.projectColumn] || '浯島文旅').toString() : 
      '浯島文旅';

    return {
      date,
      currentMonthRevenue,
      nextMonthRevenue,
      futureMonthRevenue,
      projectName
    };
  }

  /**
   * 解析日期格式
   */
  private parseDate(dateValue: any): string | null {
    if (!dateValue) return null;

    try {
      // 如果是數字（Excel 日期序列）
      if (typeof dateValue === 'number') {
        const date = XLSX.SSF.parse_date_code(dateValue);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }

      // 如果是字符串
      const dateStr = dateValue.toString().trim();
      
      // 嘗試各種日期格式
      const dateFormats = [
        /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/,  // YYYY-MM-DD 或 YYYY/MM/DD
        /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/,  // MM/DD/YYYY 或 DD/MM/YYYY
        /^(\d{4})(\d{2})(\d{2})$/,              // YYYYMMDD
      ];

      for (const format of dateFormats) {
        const match = dateStr.match(format);
        if (match) {
          let year, month, day;
          
          if (format === dateFormats[0]) {
            [, year, month, day] = match;
          } else if (format === dateFormats[1]) {
            [, month, day, year] = match;
          } else {
            [, year, month, day] = match;
          }
          
          const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          if (!isNaN(parsedDate.getTime())) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
      }

      // 嘗試直接解析
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 解析數字格式
   */
  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // 如果已經是數字
    if (typeof value === 'number') {
      return value;
    }

    // 字符串處理
    const numStr = value.toString()
      .replace(/[,\s]/g, '')  // 移除逗號和空格
      .replace(/[^\d.-]/g, ''); // 移除非數字字符（保留小數點和負號）

    const num = parseFloat(numStr);
    return isNaN(num) ? null : num;
  }

  /**
   * 將解析的數據存入資料庫
   */
  async saveToDatabase(records: ImportedRecord[]): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      for (const record of records) {
        try {
          // 檢查或創建專案
          let project = await db
            .select()
            .from(paymentProjects)
            .where(eq(paymentProjects.projectName, record.projectName))
            .limit(1);

          let projectId: number;
          if (project.length === 0) {
            // 創建新專案
            const [newProject] = await db
              .insert(paymentProjects)
              .values({
                projectName: record.projectName,
                projectType: 'revenue',
                description: `從Excel導入的專案: ${record.projectName}`
              })
              .returning();
            projectId = newProject.id;
          } else {
            projectId = project[0].id;
          }

          // 檢查是否已存在相同日期的記錄
          const existingRecord = await db
            .select()
            .from(dailyPmsRecords)
            .where(eq(dailyPmsRecords.date, record.date))
            .limit(1);

          if (existingRecord.length === 0) {
            // 新增記錄
            await db
              .insert(dailyPmsRecords)
              .values({
                projectId,
                date: record.date,
                currentMonthRevenue: record.currentMonthRevenue.toString(),
                nextMonthRevenue: record.nextMonthRevenue.toString(),
                futureMonthRevenue: record.futureMonthRevenue.toString(),
                notes: `從Excel導入 - ${record.projectName}`
              });
            imported++;
          } else {
            errors.push(`日期 ${record.date} 的記錄已存在，跳過`);
          }

        } catch (error) {
          errors.push(`儲存記錄失敗 (${record.date}): ${error.message}`);
        }
      }

      return {
        success: true,
        imported,
        errors
      };

    } catch (error) {
      return {
        success: false,
        imported: 0,
        errors: [`資料庫操作失敗: ${error.message}`]
      };
    }
  }

  /**
   * 完整的導入流程
   */
  async processImport(filePath: string): Promise<{
    success: boolean;
    totalRecords: number;
    imported: number;
    errors: string[];
    summary: string;
  }> {
    // 解析 Excel 文件
    const parseResult = await this.importExcelFile(filePath);
    
    if (!parseResult.success) {
      return {
        success: false,
        totalRecords: 0,
        imported: 0,
        errors: parseResult.errors,
        summary: '文件解析失敗'
      };
    }

    // 存入資料庫
    const saveResult = await this.saveToDatabase(parseResult.records);
    
    const allErrors = [...parseResult.errors, ...saveResult.errors];
    
    return {
      success: saveResult.success && allErrors.length === 0,
      totalRecords: parseResult.records.length,
      imported: saveResult.imported,
      errors: allErrors,
      summary: `共解析 ${parseResult.records.length} 筆記錄，成功導入 ${saveResult.imported} 筆`
    };
  }
}

export const dataImporter = new DataImporter();