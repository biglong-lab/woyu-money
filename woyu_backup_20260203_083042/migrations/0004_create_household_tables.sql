-- Create household budgets table
CREATE TABLE IF NOT EXISTS "household_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" varchar(7) NOT NULL,
	"amount" numeric(10,2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create household expenses table
CREATE TABLE IF NOT EXISTS "household_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"amount" numeric(10,2) NOT NULL,
	"category" varchar(50) NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"receipt_photo" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create unique index on budget month
CREATE UNIQUE INDEX IF NOT EXISTS "household_budgets_month_idx" ON "household_budgets" ("month");

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "household_expenses_date_idx" ON "household_expenses" ("date");
CREATE INDEX IF NOT EXISTS "household_expenses_category_idx" ON "household_expenses" ("category");