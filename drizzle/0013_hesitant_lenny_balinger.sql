CREATE TABLE "inventory_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"supplier" text,
	"note" text,
	"finance_tx_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_finance_tx_id_finance_transactions_id_fk" FOREIGN KEY ("finance_tx_id") REFERENCES "public"."finance_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inventory_purchases_business" ON "inventory_purchases" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_purchases_product" ON "inventory_purchases" USING btree ("product_id");