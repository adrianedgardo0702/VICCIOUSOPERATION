ALTER TABLE "orders" ADD COLUMN "shipping_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_company_cost" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_destination" text;