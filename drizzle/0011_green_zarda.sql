CREATE TABLE "commission_settings" (
	"month_key" text PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'auto' NOT NULL,
	"manual_pool" numeric(12, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
