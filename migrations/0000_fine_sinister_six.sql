CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(100),
	"type" varchar(100) NOT NULL,
	"criteria" jsonb NOT NULL,
	"points" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "allowance_management" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"parent_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"frequency" varchar(50) NOT NULL,
	"next_payment_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"conditions" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "allowance_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"allowance_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"parent_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_date" timestamp DEFAULT now(),
	"status" varchar(50) DEFAULT 'completed',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "amortizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"project_type" varchar(50) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"amortization_months" integer NOT NULL,
	"monthly_amount" numeric(10, 2) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"category_id" integer,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budget_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_plan_id" integer NOT NULL,
	"category_id" integer,
	"item_name" varchar(255) NOT NULL,
	"planned_amount" numeric(10, 2) NOT NULL,
	"actual_amount" numeric(10, 2) DEFAULT '0.00',
	"priority" integer DEFAULT 1,
	"tags" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budget_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_name" varchar(255) NOT NULL,
	"plan_type" varchar(20) NOT NULL,
	"project_id" integer,
	"budget_period" varchar(20) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_budget" numeric(12, 2) NOT NULL,
	"actual_spent" numeric(12, 2) DEFAULT '0.00',
	"status" varchar(20) DEFAULT 'active',
	"tags" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "child_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"username" varchar(50) NOT NULL,
	"pin_code" varchar(6) NOT NULL,
	"login_attempts" integer DEFAULT 0,
	"is_locked" boolean DEFAULT false,
	"last_login_at" timestamp,
	"session_token" varchar(255),
	"session_expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "child_accounts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "daily_records_clean" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_date" date NOT NULL,
	"branch_id" integer NOT NULL,
	"room_number" varchar(50),
	"platform" varchar(255),
	"invoice_last4" varchar(4),
	"source_type" varchar(50),
	"source_id" varchar(50),
	"price" numeric(10, 2),
	"payment_method" varchar(50),
	"record_type" varchar(20) DEFAULT 'income',
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debt_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_name" varchar(255) NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"debt_id" integer NOT NULL,
	"amount_paid" numeric(10, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"receipt_file" varchar(255),
	"note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"debt_name" varchar(255) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"vendor_id" integer,
	"note" text,
	"expected_payment_date" date,
	"installments" integer DEFAULT 1,
	"payment_type" varchar(20) DEFAULT 'single' NOT NULL,
	"first_due_date" date NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0.00',
	"status" varchar(20) DEFAULT 'pending',
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debts_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"debt_id" integer NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"is_paid" boolean DEFAULT false,
	"paid_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "education_games" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_type" varchar(50) NOT NULL,
	"game_name" varchar(100) NOT NULL,
	"difficulty" varchar(20) DEFAULT 'beginner' NOT NULL,
	"skills_required" jsonb,
	"points_reward" integer DEFAULT 10,
	"description" text,
	"game_config" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"name" varchar(255) NOT NULL,
	"budget_type" varchar(50) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"spent_amount" numeric(12, 2) DEFAULT '0.00',
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"description" text,
	"alert_threshold" integer DEFAULT 80,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" text,
	"color" varchar(20) DEFAULT '#3B82F6',
	"icon" varchar(50) DEFAULT 'Receipt',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"expense_date" date NOT NULL,
	"location" varchar(255),
	"vendor" varchar(255),
	"payment_method" varchar(50),
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" varchar(50),
	"next_recurring_date" date,
	"tags" jsonb,
	"receipt_image_url" varchar(500),
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"target_amount" numeric(12, 2) NOT NULL,
	"current_amount" numeric(12, 2) DEFAULT '0.00',
	"category" varchar(100) NOT NULL,
	"priority" varchar(20) DEFAULT 'medium',
	"target_date" date,
	"status" varchar(50) DEFAULT 'active',
	"monthly_contribution" numeric(10, 2),
	"auto_save" boolean DEFAULT false,
	"image_url" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_income" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"source" varchar(255) NOT NULL,
	"income_date" date NOT NULL,
	"description" text,
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" varchar(50),
	"next_recurring_date" date,
	"tax_amount" numeric(10, 2) DEFAULT '0.00',
	"net_amount" numeric(12, 2) NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"member_type" varchar(20) NOT NULL,
	"age" integer,
	"avatar" varchar(255),
	"voice_password" varchar(255),
	"preferences" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "game_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	"level" integer DEFAULT 1,
	"score" integer DEFAULT 0,
	"best_score" integer DEFAULT 0,
	"times_played" integer DEFAULT 0,
	"total_time_spent" integer DEFAULT 0,
	"last_played_at" timestamp,
	"completed_challenges" jsonb,
	"unlocked_features" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	"session_data" jsonb,
	"score" integer DEFAULT 0,
	"duration" integer DEFAULT 0,
	"skills_earned" jsonb,
	"mistakes" jsonb,
	"hints_used" integer DEFAULT 0,
	"completed" boolean DEFAULT false,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "household_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"budget_amount" numeric(12, 2) NOT NULL,
	"month" varchar(7) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "household_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"description" varchar(255) NOT NULL,
	"receipt_image" varchar(500),
	"receipt_text" text,
	"tags" jsonb,
	"payment_method" varchar(50) DEFAULT 'cash',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kids_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"achievement_id" integer NOT NULL,
	"unlocked_at" timestamp DEFAULT now(),
	"progress" jsonb
);
--> statement-breakpoint
CREATE TABLE "kids_loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"purpose" varchar(255) NOT NULL,
	"loan_date" date NOT NULL,
	"repayment_plan" text,
	"paid_amount" numeric(10, 2) DEFAULT '0',
	"status" varchar(20) DEFAULT 'active',
	"interest_rate" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kids_savings" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"source" varchar(100) NOT NULL,
	"description" varchar(255),
	"saving_date" date NOT NULL,
	"goal_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kids_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer,
	"activity_name" varchar(100) NOT NULL,
	"activity_type" varchar(50) NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"completed" boolean DEFAULT false,
	"notes" text,
	"reward" numeric(5, 2),
	"difficulty" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kids_wishlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer,
	"item_name" varchar(255) NOT NULL,
	"item_price" numeric(10, 2) NOT NULL,
	"priority" integer DEFAULT 1,
	"target_date" date,
	"saved_amount" numeric(10, 2) DEFAULT '0',
	"status" varchar(20) DEFAULT 'planning',
	"image" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"parent_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"purpose" text NOT NULL,
	"request_date" timestamp DEFAULT now(),
	"approved_date" timestamp,
	"due_date" timestamp,
	"status" varchar(50) DEFAULT 'pending',
	"approval_notes" text,
	"interest_rate" numeric(5, 2) DEFAULT '0',
	"repayment_plan" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "parent_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"request_type" varchar(100) NOT NULL,
	"request_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"notes" text,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_item_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_item_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"project_id" integer,
	"item_name" varchar(255) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"item_type" varchar(20) DEFAULT 'home' NOT NULL,
	"payment_type" varchar(20) DEFAULT 'single' NOT NULL,
	"recurring_interval" varchar(20),
	"installment_count" integer,
	"installment_amount" numeric(10, 2),
	"start_date" date NOT NULL,
	"end_date" date,
	"paid_amount" numeric(10, 2) DEFAULT '0.00',
	"status" varchar(20) DEFAULT 'pending',
	"priority" integer DEFAULT 1,
	"notes" text,
	"tags" jsonb,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"project_type" varchar(50) DEFAULT 'general' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_item_id" integer NOT NULL,
	"amount_paid" numeric(10, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"payment_method" varchar(50),
	"receipt_image_url" varchar(500),
	"receipt_text" text,
	"is_partial_payment" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(20) DEFAULT '#3B82F6',
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_budget_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"category" varchar(100) NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"estimated_cost" numeric(10, 2) NOT NULL,
	"actual_cost" numeric(10, 2) DEFAULT '0',
	"vendor" varchar(255),
	"status" varchar(50) DEFAULT 'planned',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"content" text NOT NULL,
	"type" varchar(50) DEFAULT 'comment',
	"parent_comment_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(100) DEFAULT 'general',
	"tags" text,
	"is_public" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"assigned_to" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'todo',
	"priority" varchar(20) DEFAULT 'medium',
	"due_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'planning',
	"priority" varchar(20) DEFAULT 'medium',
	"start_date" timestamp,
	"end_date" timestamp,
	"estimated_budget" numeric(12, 2),
	"actual_budget" numeric(12, 2) DEFAULT '0',
	"created_by" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skills_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"skill_type" varchar(50) NOT NULL,
	"current_level" integer DEFAULT 1,
	"experience_points" integer DEFAULT 0,
	"total_practice_time" integer DEFAULT 0,
	"strength_areas" jsonb,
	"improvement_areas" jsonb,
	"milestones" jsonb,
	"last_practice_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_name" varchar(255) NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "allowance_management" ADD CONSTRAINT "allowance_management_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowance_management" ADD CONSTRAINT "allowance_management_parent_id_family_members_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowance_payments" ADD CONSTRAINT "allowance_payments_allowance_id_allowance_management_id_fk" FOREIGN KEY ("allowance_id") REFERENCES "public"."allowance_management"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowance_payments" ADD CONSTRAINT "allowance_payments_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowance_payments" ADD CONSTRAINT "allowance_payments_parent_id_family_members_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortizations" ADD CONSTRAINT "amortizations_category_id_debt_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."debt_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_plan_id_budget_plans_id_fk" FOREIGN KEY ("budget_plan_id") REFERENCES "public"."budget_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_category_id_debt_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."debt_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_project_id_payment_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."payment_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_accounts" ADD CONSTRAINT "child_accounts_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_category_id_debt_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."debt_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts_schedule" ADD CONSTRAINT "debts_schedule_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_budgets" ADD CONSTRAINT "family_budgets_category_id_family_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."family_expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_expenses" ADD CONSTRAINT "family_expenses_category_id_family_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."family_expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_progress" ADD CONSTRAINT "game_progress_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_progress" ADD CONSTRAINT "game_progress_game_id_education_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."education_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_game_id_education_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."education_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_budgets" ADD CONSTRAINT "household_budgets_category_id_debt_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."debt_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_expenses" ADD CONSTRAINT "household_expenses_category_id_debt_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."debt_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_achievements" ADD CONSTRAINT "kids_achievements_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_achievements" ADD CONSTRAINT "kids_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_loans" ADD CONSTRAINT "kids_loans_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_savings" ADD CONSTRAINT "kids_savings_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_savings" ADD CONSTRAINT "kids_savings_goal_id_kids_wishlist_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."kids_wishlist"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_schedule" ADD CONSTRAINT "kids_schedule_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_wishlist" ADD CONSTRAINT "kids_wishlist_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_parent_id_family_members_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_approvals" ADD CONSTRAINT "parent_approvals_parent_id_family_members_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_approvals" ADD CONSTRAINT "parent_approvals_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_item_tags" ADD CONSTRAINT "payment_item_tags_payment_item_id_payment_items_id_fk" FOREIGN KEY ("payment_item_id") REFERENCES "public"."payment_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_item_tags" ADD CONSTRAINT "payment_item_tags_tag_id_payment_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."payment_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_category_id_debt_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."debt_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_project_id_payment_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."payment_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_payment_item_id_payment_items_id_fk" FOREIGN KEY ("payment_item_id") REFERENCES "public"."payment_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_items" ADD CONSTRAINT "project_budget_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_author_id_family_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_author_id_family_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assigned_to_family_members_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_family_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_progress" ADD CONSTRAINT "skills_progress_child_id_family_members_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;