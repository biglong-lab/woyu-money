import * as XLSX from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { storage } from './storage';

export interface ImportRecord {
  itemName: string;
  amount: number;
  date: string;
  projectName: string;
  categoryName: string;
  vendor?: string;
  notes?: string;
  priority?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentDate?: string;
  paymentNotes?: string;
  isValid: boolean;
  errors: string[];
}

export interface ImportResult {
  success: number;
  failed: number;
  details: Array<{
    record: ImportRecord;
    success: boolean;
    error?: string;
    itemId?: number;
    paymentId?: number;
  }>;
}

export class BatchImportProcessor {
  /**
   * 解析上傳的檔案並返回結構化數據
   */
  async parseFile(fileBuffer: Buffer, fileName: string): Promise<{ records: ImportRecord[] }> {
    const fileExtension = fileName.toLowerCase().split('.').pop();
    
    let records: ImportRecord[] = [];
    
    if (fileExtension === 'csv') {
      records = await this.parseCSV(fileBuffer);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      records = await this.parseExcel(fileBuffer);
    } else {
      throw new Error('不支援的檔案格式。請使用 CSV 或 Excel 檔案。');
    }
    
    // 驗證每筆記錄
    const validatedRecords = await Promise.all(
      records.map(record => this.validateRecord(record))
    );
    
    return { records: validatedRecords };
  }
  
  /**
   * 解析 CSV 檔案
   */
  private async parseCSV(fileBuffer: Buffer): Promise<ImportRecord[]> {
    return new Promise((resolve, reject) => {
      const records: ImportRecord[] = [];
      const stream = new Readable();
      stream.push(fileBuffer);
      stream.push(null);
      
      stream
        .pipe(csv())
        .on('data', (row) => {
          const record = this.mapRowToRecord(row);
          if (record) {
            records.push(record);
          }
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', (error) => {
          reject(new Error(`CSV 解析錯誤: ${error.message}`));
        });
    });
  }
  
  /**
   * 解析 Excel 檔案
   */
  private async parseExcel(fileBuffer: Buffer): Promise<ImportRecord[]> {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const records: ImportRecord[] = [];
      for (const row of jsonData) {
        const record = this.mapRowToRecord(row);
        if (record) {
          records.push(record);
        }
      }
      
      return records;
    } catch (error: any) {
      throw new Error(`Excel 解析錯誤: ${error.message}`);
    }
  }
  
  /**
   * 將行數據映射為記錄格式
   */
  private mapRowToRecord(row: any): ImportRecord | null {
    // 支援中文和英文欄位名稱
    const itemName = row['項目名稱'] || row['itemName'] || row['Item Name'] || '';
    const amount = this.parseAmount(row['金額'] || row['amount'] || row['Amount'] || row['總金額'] || row['totalAmount']);
    const date = this.parseDate(row['日期'] || row['date'] || row['Date'] || row['付款日期'] || row['paymentDate']);
    const projectName = row['專案'] || row['project'] || row['Project'] || row['專案名稱'] || row['projectName'] || '';
    const categoryName = row['分類'] || row['category'] || row['Category'] || row['分類名稱'] || row['categoryName'] || '';
    
    // 選填欄位
    const vendor = row['廠商'] || row['vendor'] || row['Vendor'] || '';
    const notes = row['備註'] || row['notes'] || row['Notes'] || '';
    const priority = parseInt(row['優先級'] || row['priority'] || row['Priority'] || '2');
    const paymentMethod = row['付款方式'] || row['paymentMethod'] || row['Payment Method'] || '';
    const paymentStatus = row['付款狀態'] || row['paymentStatus'] || row['Payment Status'] || '未付款';
    const paymentDate = this.parseDate(row['付款日期'] || row['paymentDate'] || row['Payment Date']);
    const paymentNotes = row['付款備註'] || row['paymentNotes'] || row['Payment Notes'] || '';
    
    // 基本驗證
    if (!itemName || !amount || !date || !projectName) {
      return null;
    }
    
    return {
      itemName: String(itemName).trim(),
      amount: amount,
      date: date,
      projectName: String(projectName).trim(),
      categoryName: String(categoryName).trim(),
      vendor: vendor ? String(vendor).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
      priority: isNaN(priority) ? 2 : Math.max(1, Math.min(3, priority)),
      paymentMethod: paymentMethod ? String(paymentMethod).trim() : undefined,
      paymentStatus: String(paymentStatus).trim(),
      paymentDate: paymentDate,
      paymentNotes: paymentNotes ? String(paymentNotes).trim() : undefined,
      isValid: false, // 將在 validateRecord 中設定
      errors: []
    };
  }
  
  /**
   * 解析金額格式
   */
  private parseAmount(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // 移除逗號和貨幣符號
      const cleaned = value.replace(/[,\$NT\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }
  
  /**
   * 解析日期格式
   */
  private parseDate(value: any): string {
    if (!value) return '';
    
    let date: Date;
    
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      // 嘗試解析各種日期格式
      date = new Date(value);
      if (isNaN(date.getTime())) {
        // 嘗試其他格式
        const formats = [
          /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
          /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
          /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
        ];
        
        for (const format of formats) {
          const match = value.match(format);
          if (match) {
            if (format === formats[1]) {
              // MM/DD/YYYY 格式
              date = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
            } else {
              // YYYY-MM-DD 或 YYYY/MM/DD 格式
              date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            }
            break;
          }
        }
      }
    } else if (typeof value === 'number') {
      // Excel 日期序列號
      date = new Date((value - 25569) * 86400 * 1000);
    } else {
      return '';
    }
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toISOString().split('T')[0];
  }
  
  /**
   * 驗證單筆記錄
   */
  private async validateRecord(record: ImportRecord): Promise<ImportRecord> {
    const errors: string[] = [];
    
    // 驗證必填欄位
    if (!record.itemName) {
      errors.push('項目名稱不能為空');
    }
    
    if (!record.amount || record.amount <= 0) {
      errors.push('金額必須大於 0');
    }
    
    if (!record.date) {
      errors.push('日期格式錯誤');
    }
    
    if (!record.projectName) {
      errors.push('專案名稱不能為空');
    }
    
    // 驗證專案是否存在，如果不存在就自動創建
    try {
      const projects = await storage.getPaymentProjects();
      const existingProject = projects.find(p => 
        p.projectName.toLowerCase() === record.projectName.toLowerCase()
      );
      
      if (!existingProject) {
        // 自動創建專案
        await storage.createPaymentProject({
          projectName: record.projectName,
          projectType: 'general',
          description: `自動創建於批量導入 - ${new Date().toLocaleDateString()}`
        });
      }
    } catch (error) {
      errors.push(`專案驗證失敗: ${error}`);
    }
    
    // 驗證分類是否存在，如果不存在就使用預設分類
    if (record.categoryName) {
      try {
        const categories = await storage.getProjectCategories();
        const existingCategory = categories.find(c => 
          c.categoryName.toLowerCase() === record.categoryName.toLowerCase()
        );
        
        if (!existingCategory) {
          // 自動創建分類
          await storage.createDebtCategory({
            categoryName: record.categoryName,
            categoryType: 'project'
          });
        }
      } catch (error) {
        errors.push(`分類驗證失敗: ${error}`);
      }
    }
    
    return {
      ...record,
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * 執行批量導入
   */
  async executeImport(records: ImportRecord[]): Promise<ImportResult> {
    const results: ImportResult = {
      success: 0,
      failed: 0,
      details: []
    };
    
    for (const record of records) {
      if (!record.isValid) {
        results.failed++;
        results.details.push({
          record,
          success: false,
          error: record.errors.join(', ')
        });
        continue;
      }
      
      try {
        // 獲取專案和分類 ID
        const projects = await storage.getPaymentProjects();
        const categories = await storage.getProjectCategories();
        
        const project = projects.find(p => 
          p.projectName.toLowerCase() === record.projectName.toLowerCase()
        );
        const category = categories.find(c => 
          c.categoryName.toLowerCase() === record.categoryName.toLowerCase()
        );
        
        if (!project) {
          throw new Error(`找不到專案: ${record.projectName}`);
        }
        
        // 創建付款項目
        const paymentItem = await storage.createPaymentItem({
          itemName: record.itemName,
          totalAmount: record.amount.toString(),
          categoryId: category?.id,
          projectId: project.id,
          paymentType: 'single',
          startDate: record.date,
          status: record.paymentStatus === '已付款' ? 'paid' : 'pending',
          priority: record.priority || 2,
          notes: record.notes,
          itemType: 'project'
        });
        
        let paymentId: number | undefined;
        
        // 如果是已付款狀態，創建付款記錄
        if (record.paymentStatus === '已付款' && record.paymentDate) {
          const paymentRecord = await storage.createPaymentRecord({
            itemId: paymentItem.id,
            amountPaid: record.amount.toString(),
            paymentDate: record.paymentDate,
            paymentMethod: record.paymentMethod || '其他',
            notes: record.paymentNotes
          });
          paymentId = paymentRecord.id;
          
          // 重要：創建付款記錄後更新付款項目的已付金額
          await storage.updatePaymentItemAmounts(paymentItem.id);
        }
        
        results.success++;
        results.details.push({
          record,
          success: true,
          itemId: paymentItem.id,
          paymentId
        });
        
      } catch (error: any) {
        results.failed++;
        results.details.push({
          record,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

export const batchImportProcessor = new BatchImportProcessor();