CREATE TABLE "account_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text,
	"kind" text NOT NULL,
	"party" text NOT NULL,
	"concept" text,
	"amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"due_date" timestamp with time zone,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text,
	"category" text NOT NULL,
	"month_key" text NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_entries" ADD CONSTRAINT "account_entries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_entries" ADD CONSTRAINT "account_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_entries_business" ON "account_entries" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_account_entries_kind" ON "account_entries" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "idx_account_entries_due" ON "account_entries" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_budgets_business" ON "budgets" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_budget_scope" ON "budgets" USING btree ("business_id","category","month_key");