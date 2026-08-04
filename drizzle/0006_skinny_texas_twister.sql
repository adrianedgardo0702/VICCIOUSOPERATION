CREATE TABLE "commission_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "seller_commission" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "commission_type" text DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "commission_value" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_commission_payments_seller" ON "commission_payments" USING btree ("seller_id");