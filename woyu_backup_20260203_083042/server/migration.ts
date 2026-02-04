import { db } from "./db";
import { debtCategories, vendors, debts, debtPayments, dailyRecords } from "@shared/schema";
import fs from "fs";
import path from "path";

interface MySQLDebt {
  id: number;
  category_id: number;
  debt_name: string;
  total_amount: string;
  vendor_id: number | null;
  note: string | null;
  expected_payment_date: string | null;
  installments: number;
  payment_type: string;
  first_due_date: string;
  created_at: string;
  updated_at: string;
  paid_amount: string;
  status: string;
  is_deleted: number;
  deleted_at: string | null;
}

interface MySQLCategory {
  id: number;
  category_name: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

interface MySQLVendor {
  id: number;
  vendor_name: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

interface MySQLPayment {
  id: number;
  debt_id: number;
  amount_paid: string;
  payment_date: string;
  created_at: string;
  updated_at: string;
  receipt_file: string | null;
  note: string | null;
}

interface MySQLDailyRecord {
  id: number;
  record_date: string;
  branch_id: number;
  room_number: string | null;
  platform: string | null;
  invoice_last4: string | null;
  source_type: string | null;
  source_id: string | null;
  price: string | null;
  payment_method: string | null;
  record_type: string;
  note: string | null;
  created_at: string;
}

export class DataMigration {
  async migrateFromJSON(dataPath: string): Promise<void> {
    console.log("Starting data migration...");

    try {
      // Read the MySQL export data
      const rawData = fs.readFileSync(dataPath, 'utf-8');
      const mysqlData = JSON.parse(rawData);

      // Migrate categories first
      await this.migrateCategories(mysqlData.debt_categories || []);
      console.log("Categories migrated successfully");

      // Migrate vendors
      await this.migrateVendors(mysqlData.vendors || []);
      console.log("Vendors migrated successfully");

      // Migrate debts
      await this.migrateDebts(mysqlData.debts || []);
      console.log("Debts migrated successfully");

      // Migrate payments
      await this.migratePayments(mysqlData.debt_payments || []);
      console.log("Payments migrated successfully");

      // Migrate daily records
      await this.migrateDailyRecords(mysqlData.daily_records_clean || []);
      console.log("Daily records migrated successfully");

      console.log("Data migration completed successfully!");

    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }

  private async migrateCategories(categories: MySQLCategory[]): Promise<void> {
    for (const category of categories) {
      await db.insert(debtCategories).values({
        categoryName: category.category_name,
        isDeleted: category.is_deleted === 1,
        createdAt: new Date(category.created_at),
        updatedAt: new Date(category.updated_at),
      }).onConflictDoNothing();
    }
  }

  private async migrateVendors(vendors_data: MySQLVendor[]): Promise<void> {
    for (const vendor of vendors_data) {
      await db.insert(vendors).values({
        vendorName: vendor.vendor_name,
        isDeleted: vendor.is_deleted === 1,
        createdAt: new Date(vendor.created_at),
        updatedAt: new Date(vendor.updated_at),
      }).onConflictDoNothing();
    }
  }

  private async migrateDebts(debts_data: MySQLDebt[]): Promise<void> {
    for (const debt of debts_data) {
      await db.insert(debts).values({
        categoryId: debt.category_id,
        debtName: debt.debt_name,
        totalAmount: debt.total_amount,
        vendorId: debt.vendor_id,
        note: debt.note,
        expectedPaymentDate: debt.expected_payment_date,
        installments: debt.installments,
        paymentType: debt.payment_type,
        firstDueDate: debt.first_due_date,
        paidAmount: debt.paid_amount,
        status: debt.status,
        isDeleted: debt.is_deleted === 1,
        deletedAt: debt.deleted_at ? new Date(debt.deleted_at) : null,
        createdAt: new Date(debt.created_at),
        updatedAt: new Date(debt.updated_at),
      }).onConflictDoNothing();
    }
  }

  private async migratePayments(payments_data: MySQLPayment[]): Promise<void> {
    for (const payment of payments_data) {
      await db.insert(debtPayments).values({
        debtId: payment.debt_id,
        amountPaid: payment.amount_paid,
        paymentDate: payment.payment_date,
        receiptFile: payment.receipt_file,
        note: payment.note,
        createdAt: new Date(payment.created_at),
        updatedAt: new Date(payment.updated_at),
      }).onConflictDoNothing();
    }
  }

  private async migrateDailyRecords(records_data: MySQLDailyRecord[]): Promise<void> {
    for (const record of records_data) {
      await db.insert(dailyRecords).values({
        recordDate: record.record_date,
        branchId: record.branch_id,
        roomNumber: record.room_number,
        platform: record.platform,
        invoiceLast4: record.invoice_last4,
        sourceType: record.source_type,
        sourceId: record.source_id,
        price: record.price,
        paymentMethod: record.payment_method,
        recordType: record.record_type as "income" | "expense",
        note: record.note,
        createdAt: new Date(record.created_at),
      }).onConflictDoNothing();
    }
  }

  async validateMigration(): Promise<{
    isValid: boolean;
    errors: string[];
    counts: {
      categories: number;
      vendors: number;
      debts: number;
      payments: number;
      dailyRecords: number;
    };
  }> {
    const errors: string[] = [];
    
    try {
      // Count records in each table
      const categoriesCount = await db.$count(debtCategories);
      const vendorsCount = await db.$count(vendors);
      const debtsCount = await db.$count(debts);
      const paymentsCount = await db.$count(debtPayments);
      const dailyRecordsCount = await db.$count(dailyRecords);

      // Basic validation checks
      if (categoriesCount === 0) {
        errors.push("No categories found after migration");
      }

      if (vendorsCount === 0) {
        errors.push("No vendors found after migration");
      }

      if (debtsCount === 0) {
        errors.push("No debts found after migration");
      }

      return {
        isValid: errors.length === 0,
        errors,
        counts: {
          categories: categoriesCount,
          vendors: vendorsCount,
          debts: debtsCount,
          payments: paymentsCount,
          dailyRecords: dailyRecordsCount,
        },
      };
    } catch (error) {
      errors.push(`Validation failed: ${error}`);
      return {
        isValid: false,
        errors,
        counts: {
          categories: 0,
          vendors: 0,
          debts: 0,
          payments: 0,
          dailyRecords: 0,
        },
      };
    }
  }
}

// CLI script for running migration
if (import.meta.main) {
  const migration = new DataMigration();
  const dataPath = process.argv[2];
  
  if (!dataPath) {
    console.error("Please provide the path to the MySQL export JSON file");
    process.exit(1);
  }

  migration.migrateFromJSON(dataPath)
    .then(() => {
      console.log("Migration completed successfully!");
      return migration.validateMigration();
    })
    .then((validation) => {
      console.log("Validation results:", validation);
      if (!validation.isValid) {
        console.error("Migration validation failed:", validation.errors);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
