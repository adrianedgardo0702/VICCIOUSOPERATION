CREATE TABLE "price_levels" (
	"type" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "type" text DEFAULT 'final' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "price_discount" numeric(5, 2);--> statement-breakpoint
CREATE INDEX "idx_customers_type" ON "customers" USING btree ("type");--> statement-breakpoint
INSERT INTO "price_levels" ("type", "label", "discount_pct") VALUES
	('final', 'Cliente final', '0'),
	('revendedor', 'Revendedor', '0'),
	('clinica', 'Clínica', '0')
ON CONFLICT ("type") DO NOTHING;