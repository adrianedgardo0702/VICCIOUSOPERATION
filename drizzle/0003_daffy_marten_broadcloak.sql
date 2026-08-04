CREATE TABLE "referrers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"commission_type" text DEFAULT 'percent' NOT NULL,
	"commission_value" numeric(12, 2) DEFAULT '5' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "referrer_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "referral_commission" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_referrer_id_referrers_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."referrers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_orders_referrer" ON "orders" USING btree ("referrer_id");