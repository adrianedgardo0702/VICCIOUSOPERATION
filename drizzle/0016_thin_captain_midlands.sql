CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text,
	"name" text NOT NULL,
	"type" text DEFAULT 'banco' NOT NULL,
	"bank" text,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"color" text,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_card_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"balance_after" numeric(12, 2),
	"finance_tx_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text,
	"bank" text NOT NULL,
	"name" text NOT NULL,
	"brand" text DEFAULT 'visa' NOT NULL,
	"last4" text,
	"credit_limit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"annual_rate" numeric(6, 2) DEFAULT '0' NOT NULL,
	"minimum_payment" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cut_day" integer,
	"payment_day" integer,
	"status" text DEFAULT 'activa' NOT NULL,
	"color" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text,
	"name" text NOT NULL,
	"target_amount" numeric(12, 2) NOT NULL,
	"current_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"due_date" timestamp with time zone,
	"status" text DEFAULT 'activa' NOT NULL,
	"color" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text,
	"month_key" text NOT NULL,
	"income" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cogs" numeric(12, 2) DEFAULT '0' NOT NULL,
	"opex" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_profit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"closed_by" uuid,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"frequency" text DEFAULT 'mensual' NOT NULL,
	"day_of_month" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_movements" ADD CONSTRAINT "credit_card_movements_card_id_credit_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."credit_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_movements" ADD CONSTRAINT "credit_card_movements_finance_tx_id_finance_transactions_id_fk" FOREIGN KEY ("finance_tx_id") REFERENCES "public"."finance_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_movements" ADD CONSTRAINT "credit_card_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_closures" ADD CONSTRAINT "monthly_closures_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_closures" ADD CONSTRAINT "monthly_closures_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bank_accounts_business" ON "bank_accounts" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_cc_movements_card" ON "credit_card_movements" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "idx_cc_movements_date" ON "credit_card_movements" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_credit_cards_business" ON "credit_cards" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_financial_goals_business" ON "financial_goals" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_monthly_closure" ON "monthly_closures" USING btree ("business_id","month_key");--> statement-breakpoint
CREATE INDEX "idx_recurring_expenses_business" ON "recurring_expenses" USING btree ("business_id");