CREATE INDEX "idx_tx_type_date" ON "finance_transactions" USING btree ("type","date");--> statement-breakpoint
CREATE INDEX "idx_tx_business_type_date" ON "finance_transactions" USING btree ("business_id","type","date");--> statement-breakpoint
CREATE INDEX "idx_orders_status_created" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_business_status_created" ON "orders" USING btree ("business_id","status","created_at");