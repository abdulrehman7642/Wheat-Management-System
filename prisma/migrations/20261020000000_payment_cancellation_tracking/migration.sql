-- Draft only. Payment cancellation remains disabled after this migration.
ALTER TABLE "payment_allocations"
  ADD COLUMN "payment_posting_id" BIGINT,
  ADD COLUMN "purchase_id" INTEGER,
  ADD COLUMN "sale_id" INTEGER,
  ADD COLUMN "tracking_version" SMALLINT,
  ADD COLUMN "created_at" TIMESTAMPTZ(6);

CREATE TABLE "payment_postings" (
  "id" BIGSERIAL PRIMARY KEY,
  "payment_id" INTEGER NOT NULL UNIQUE,
  "original_ledger_entry_id" BIGINT NOT NULL UNIQUE,
  "payment_date" DATE NOT NULL,
  "party_type" VARCHAR(20) NOT NULL,
  "party_id" INTEGER NOT NULL,
  "method" VARCHAR(20) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "allocated_amount" DECIMAL(14,2) NOT NULL,
  "advance_amount" DECIMAL(14,2) NOT NULL,
  "source_path" VARCHAR(30) NOT NULL,
  "tracking_version" SMALLINT NOT NULL,
  "bank_reconciliation_status" VARCHAR(20) NOT NULL DEFAULT 'not_applicable',
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_postings_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_postings_original_ledger_entry_id_fkey" FOREIGN KEY ("original_ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_postings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_postings_values_ck" CHECK (
    "party_type" IN ('supplier','customer') AND "method" IN ('cash','bank') AND
    "amount" > 0 AND "allocated_amount" >= 0 AND "advance_amount" >= 0 AND
    "allocated_amount" + "advance_amount" = "amount" AND "tracking_version" = 1 AND
    "source_path" IN ('standalone_fifo','purchase_initial','sale_initial','purchase_add_payment','sale_add_payment','purchase_mark_paid','sale_mark_paid') AND
    (("method"='cash' AND "bank_reconciliation_status"='not_applicable') OR
     ("method"='bank' AND "bank_reconciliation_status" IN ('unknown','unreconciled','reconciled')))
  )
);

CREATE TABLE "accounting_periods" (
  "id" SERIAL PRIMARY KEY, "name" VARCHAR(80) NOT NULL, "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL, "status" VARCHAR(20) NOT NULL DEFAULT 'open',
  "closed_at" TIMESTAMPTZ(6), "closed_by" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_by" INTEGER NOT NULL,
  CONSTRAINT "accounting_periods_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "accounting_periods_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "accounting_periods_values_ck" CHECK ("start_date" <= "end_date" AND "status" IN ('open','closed') AND
    (("status"='open' AND "closed_at" IS NULL AND "closed_by" IS NULL) OR
     ("status"='closed' AND "closed_at" IS NOT NULL AND "closed_by" IS NOT NULL)))
);
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_no_overlap"
  EXCLUDE USING gist (daterange("start_date", "end_date", '[]') WITH &&);

CREATE TABLE "financial_controls" (
  "id" INTEGER PRIMARY KEY, "payment_cancellation_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "accounting_periods_required" BOOLEAN NOT NULL DEFAULT TRUE,
  "locking_protocol_version" SMALLINT NOT NULL DEFAULT 1, "updated_by" INTEGER,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_controls_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "financial_controls_singleton_ck" CHECK ("id"=1 AND "locking_protocol_version" >= 1)
);
INSERT INTO "financial_controls" ("id") VALUES (1);

CREATE TABLE "payment_reversal_counters" (
  "prefix" VARCHAR(10) PRIMARY KEY, "current_number" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_reversal_counters_ck" CHECK ("prefix"='PCR' AND "current_number" >= 0)
);
INSERT INTO "payment_reversal_counters" ("prefix") VALUES ('PCR');

CREATE TABLE "payment_reversals" (
  "id" BIGSERIAL PRIMARY KEY, "payment_posting_id" BIGINT NOT NULL UNIQUE,
  "original_payment_id" INTEGER NOT NULL UNIQUE, "reversal_ledger_entry_id" BIGINT NOT NULL UNIQUE,
  "voucher_sequence" BIGINT NOT NULL UNIQUE, "voucher_no" VARCHAR(30) NOT NULL UNIQUE,
  "idempotency_key" UUID NOT NULL UNIQUE, "effective_date" DATE NOT NULL,
  "original_payment_period_id" INTEGER NOT NULL, "effective_period_id" INTEGER NOT NULL,
  "reason" TEXT NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
  "reversed_allocated_amount" DECIMAL(14,2) NOT NULL, "reversed_advance_amount" DECIMAL(14,2) NOT NULL,
  "created_by" INTEGER NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_reversals_payment_posting_id_fkey" FOREIGN KEY ("payment_posting_id") REFERENCES "payment_postings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_reversals_original_payment_id_fkey" FOREIGN KEY ("original_payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_reversals_reversal_ledger_entry_id_fkey" FOREIGN KEY ("reversal_ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_reversals_original_payment_period_id_fkey" FOREIGN KEY ("original_payment_period_id") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_reversals_effective_period_id_fkey" FOREIGN KEY ("effective_period_id") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_reversals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_reversals_values_ck" CHECK ("amount">0 AND "reversed_allocated_amount">=0 AND "reversed_advance_amount">=0 AND
    "reversed_allocated_amount"+"reversed_advance_amount"="amount" AND length(btrim("reason")) BETWEEN 1 AND 1000 AND
    "voucher_no"='PCR-' || "voucher_sequence"::text)
);

CREATE TABLE "payment_allocation_reversals" (
  "id" BIGSERIAL PRIMARY KEY, "payment_reversal_id" BIGINT NOT NULL,
  "payment_allocation_id" INTEGER NOT NULL UNIQUE, "purchase_id" INTEGER, "sale_id" INTEGER,
  "invoice_period_id" INTEGER NOT NULL, "reversed_amount" DECIMAL(14,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocation_reversals_payment_reversal_id_fkey" FOREIGN KEY ("payment_reversal_id") REFERENCES "payment_reversals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_allocation_reversals_payment_allocation_id_fkey" FOREIGN KEY ("payment_allocation_id") REFERENCES "payment_allocations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_allocation_reversals_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_allocation_reversals_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_allocation_reversals_invoice_period_id_fkey" FOREIGN KEY ("invoice_period_id") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "payment_allocation_reversals_values_ck" CHECK ("reversed_amount">0 AND (("purchase_id" IS NOT NULL)::int + ("sale_id" IS NOT NULL)::int)=1),
  CONSTRAINT "uq_payment_allocation_reversal_pair" UNIQUE ("payment_reversal_id","payment_allocation_id")
);

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_payment_posting_id_fkey" FOREIGN KEY ("payment_posting_id") REFERENCES "payment_postings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "payment_allocations_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "payment_allocations_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "payment_allocations_tracking_ck" CHECK (
    ("payment_posting_id" IS NULL AND "purchase_id" IS NULL AND "sale_id" IS NULL AND "tracking_version" IS NULL AND "created_at" IS NULL) OR
    ("payment_posting_id" IS NOT NULL AND "tracking_version"=1 AND "created_at" IS NOT NULL AND
     (("purchase_id" IS NOT NULL)::int + ("sale_id" IS NOT NULL)::int)=1)
  );

CREATE INDEX "idx_payment_postings_party_date" ON "payment_postings"("party_type","party_id","payment_date");
CREATE INDEX "idx_payment_allocations_payment" ON "payment_allocations"("payment_id");
CREATE INDEX "idx_payment_allocations_posting" ON "payment_allocations"("payment_posting_id");
CREATE INDEX "idx_payment_allocations_purchase" ON "payment_allocations"("purchase_id");
CREATE INDEX "idx_payment_allocations_sale" ON "payment_allocations"("sale_id");
CREATE UNIQUE INDEX "uq_payment_allocations_posting_purchase" ON "payment_allocations"("payment_posting_id","purchase_id") WHERE "payment_posting_id" IS NOT NULL AND "purchase_id" IS NOT NULL;
CREATE UNIQUE INDEX "uq_payment_allocations_posting_sale" ON "payment_allocations"("payment_posting_id","sale_id") WHERE "payment_posting_id" IS NOT NULL AND "sale_id" IS NOT NULL;
CREATE INDEX "idx_accounting_period_dates" ON "accounting_periods"("start_date","end_date");
CREATE INDEX "idx_accounting_period_status" ON "accounting_periods"("status","start_date");
CREATE INDEX "idx_payment_reversals_date" ON "payment_reversals"("effective_date");
CREATE INDEX "idx_payment_allocation_reversals_reversal" ON "payment_allocation_reversals"("payment_reversal_id");

CREATE FUNCTION prevent_financial_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable financial history: %', TG_TABLE_NAME USING ERRCODE='55000'; END $$;
CREATE TRIGGER payment_postings_immutable BEFORE UPDATE OR DELETE ON "payment_postings" FOR EACH ROW EXECUTE FUNCTION prevent_financial_history_mutation();
CREATE TRIGGER payment_reversals_immutable BEFORE UPDATE OR DELETE ON "payment_reversals" FOR EACH ROW EXECUTE FUNCTION prevent_financial_history_mutation();
CREATE TRIGGER payment_allocation_reversals_immutable BEFORE UPDATE OR DELETE ON "payment_allocation_reversals" FOR EACH ROW EXECUTE FUNCTION prevent_financial_history_mutation();

CREATE FUNCTION protect_tracked_payment_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.payment_posting_id IS NOT NULL THEN RAISE EXCEPTION 'tracked payment allocation is immutable' USING ERRCODE='55000'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER tracked_payment_allocations_immutable BEFORE UPDATE OR DELETE ON "payment_allocations" FOR EACH ROW EXECUTE FUNCTION protect_tracked_payment_allocation();

CREATE FUNCTION validate_tracked_payment_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE posting payment_postings; invoice_party integer; invoice_status text; invoice_settled numeric(14,2);
BEGIN
  IF NEW.payment_posting_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO posting FROM payment_postings WHERE id=NEW.payment_posting_id;
  IF posting.id IS NULL OR posting.payment_id<>NEW.payment_id OR NEW.allocated_amount<=0 THEN
    RAISE EXCEPTION 'invalid tracked payment allocation' USING ERRCODE='23514';
  END IF;
  IF NEW.purchase_id IS NOT NULL THEN
    SELECT supplier_id,status,paid_amount INTO invoice_party,invoice_status,invoice_settled FROM purchases WHERE id=NEW.purchase_id;
    IF posting.party_type<>'supplier' OR NEW.ref_type<>'purchase' OR NEW.ref_id<>NEW.purchase_id THEN RAISE EXCEPTION 'purchase allocation mismatch' USING ERRCODE='23514'; END IF;
  ELSE
    SELECT customer_id,status,received_amount INTO invoice_party,invoice_status,invoice_settled FROM sales WHERE id=NEW.sale_id;
    IF posting.party_type<>'customer' OR NEW.ref_type<>'sale' OR NEW.ref_id<>NEW.sale_id THEN RAISE EXCEPTION 'sale allocation mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  IF invoice_party IS DISTINCT FROM posting.party_id OR invoice_status<>'confirmed' OR NEW.allocated_amount>invoice_settled THEN RAISE EXCEPTION 'allocation party, amount or invoice state mismatch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tracked_payment_allocations_validate BEFORE INSERT OR UPDATE ON "payment_allocations" FOR EACH ROW EXECUTE FUNCTION validate_tracked_payment_allocation();

CREATE FUNCTION protect_closed_accounting_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='closed' THEN RAISE EXCEPTION 'closed accounting period is immutable' USING ERRCODE='55000'; END IF;
  IF TG_OP='DELETE' THEN
    IF EXISTS (SELECT 1 FROM payment_reversals r WHERE r.original_payment_period_id=OLD.id OR r.effective_period_id=OLD.id)
       OR EXISTS (SELECT 1 FROM payment_allocation_reversals ar WHERE ar.invoice_period_id=OLD.id)
    THEN RAISE EXCEPTION 'referenced accounting period dates are immutable' USING ERRCODE='55000'; END IF;
    RETURN OLD;
  END IF;
  IF (EXISTS (SELECT 1 FROM payment_reversals r WHERE r.original_payment_period_id=OLD.id OR r.effective_period_id=OLD.id)
      OR EXISTS (SELECT 1 FROM payment_allocation_reversals ar WHERE ar.invoice_period_id=OLD.id))
     AND (NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date OR NEW.name IS DISTINCT FROM OLD.name)
  THEN RAISE EXCEPTION 'referenced accounting period dates are immutable' USING ERRCODE='55000'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER accounting_periods_protect BEFORE UPDATE OR DELETE ON "accounting_periods" FOR EACH ROW EXECUTE FUNCTION protect_closed_accounting_period();

CREATE FUNCTION validate_payment_financial_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p payment_postings; pay payments; original_ledger ledger_entries; reversal payment_reversals;
  reversal_ledger ledger_entries; original_period accounting_periods; effective_period accounting_periods;
  allocation_total numeric(14,2); reversed_total numeric(14,2); posting_key bigint;
BEGIN
  IF TG_TABLE_NAME='payment_postings' THEN posting_key := NEW.id;
  ELSIF TG_TABLE_NAME='payment_allocations' AND TG_OP='DELETE' THEN posting_key := OLD.payment_posting_id;
  ELSIF TG_TABLE_NAME='payment_allocations' THEN posting_key := NEW.payment_posting_id;
  ELSIF TG_TABLE_NAME='payment_reversals' THEN posting_key := NEW.payment_posting_id;
  ELSE SELECT payment_posting_id INTO posting_key FROM payment_reversals WHERE id=NEW.payment_reversal_id;
  END IF;
  SELECT * INTO p FROM payment_postings WHERE id=posting_key;
  IF p.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO pay FROM payments WHERE id=p.payment_id;
  SELECT * INTO original_ledger FROM ledger_entries WHERE id=p.original_ledger_entry_id;
  SELECT COALESCE(sum(allocated_amount),0) INTO allocation_total FROM payment_allocations WHERE payment_posting_id=p.id;
  IF p.amount<>pay.amount OR p.party_type<>pay.party_type OR p.party_id IS DISTINCT FROM pay.party_id OR p.method<>pay.method OR p.payment_date<>pay.date OR allocation_total<>p.allocated_amount
     OR original_ledger.account_type<>p.party_type OR original_ledger.account_id<>p.party_id OR original_ledger.voucher_no<>pay.voucher_no
     OR original_ledger.ref_type<>'payment' OR original_ledger.ref_id IS DISTINCT FROM pay.id
     OR (p.party_type='supplier' AND (original_ledger.debit<>p.amount OR original_ledger.credit<>0))
     OR (p.party_type='customer' AND (original_ledger.credit<>p.amount OR original_ledger.debit<>0)) THEN
    RAISE EXCEPTION 'payment posting conservation failed' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_reversals r WHERE r.payment_posting_id=p.id) THEN
    SELECT * INTO reversal FROM payment_reversals WHERE payment_posting_id=p.id;
    SELECT * INTO reversal_ledger FROM ledger_entries WHERE id=reversal.reversal_ledger_entry_id;
    SELECT * INTO original_period FROM accounting_periods WHERE id=reversal.original_payment_period_id;
    SELECT * INTO effective_period FROM accounting_periods WHERE id=reversal.effective_period_id;
    SELECT COALESCE(sum(ar.reversed_amount),0) INTO reversed_total FROM payment_allocation_reversals ar JOIN payment_reversals r ON r.id=ar.payment_reversal_id WHERE r.payment_posting_id=p.id;
    IF reversed_total<>p.allocated_amount OR reversal.original_payment_id<>p.payment_id OR reversal.amount<>p.amount
       OR reversal.reversed_allocated_amount<>p.allocated_amount OR reversal.reversed_advance_amount<>p.advance_amount
       OR reversal_ledger.account_type<>p.party_type OR reversal_ledger.account_id<>p.party_id
       OR reversal_ledger.ref_type<>'payment_reversal' OR reversal_ledger.ref_id IS DISTINCT FROM p.payment_id
       OR original_period.status<>'open' OR p.payment_date NOT BETWEEN original_period.start_date AND original_period.end_date
       OR effective_period.status<>'open' OR reversal.effective_date NOT BETWEEN effective_period.start_date AND effective_period.end_date
       OR (p.party_type='supplier' AND (reversal_ledger.credit<>p.amount OR reversal_ledger.debit<>0))
       OR (p.party_type='customer' AND (reversal_ledger.debit<>p.amount OR reversal_ledger.credit<>0))
    THEN RAISE EXCEPTION 'payment reversal conservation failed' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER payment_postings_conservation AFTER INSERT ON "payment_postings" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_payment_financial_history();
CREATE CONSTRAINT TRIGGER payment_allocations_conservation AFTER INSERT OR UPDATE OR DELETE ON "payment_allocations" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_payment_financial_history();
CREATE CONSTRAINT TRIGGER payment_reversals_conservation AFTER INSERT ON "payment_reversals" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_payment_financial_history();
CREATE CONSTRAINT TRIGGER allocation_reversals_conservation AFTER INSERT ON "payment_allocation_reversals" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_payment_financial_history();

CREATE FUNCTION validate_allocation_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allocation payment_allocations; reversal payment_reversals; period accounting_periods; invoice_date date;
BEGIN
  SELECT * INTO allocation FROM payment_allocations WHERE id=NEW.payment_allocation_id;
  SELECT * INTO reversal FROM payment_reversals WHERE id=NEW.payment_reversal_id;
  SELECT * INTO period FROM accounting_periods WHERE id=NEW.invoice_period_id;
  IF NEW.purchase_id IS NOT NULL THEN SELECT date INTO invoice_date FROM purchases WHERE id=NEW.purchase_id;
  ELSE SELECT date INTO invoice_date FROM sales WHERE id=NEW.sale_id; END IF;
  IF allocation.id IS NULL OR reversal.id IS NULL OR allocation.payment_posting_id<>reversal.payment_posting_id
     OR allocation.allocated_amount<>NEW.reversed_amount OR allocation.purchase_id IS DISTINCT FROM NEW.purchase_id
     OR allocation.sale_id IS DISTINCT FROM NEW.sale_id OR period.status<>'open'
     OR invoice_date NOT BETWEEN period.start_date AND period.end_date THEN
    RAISE EXCEPTION 'allocation reversal mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_allocation_reversals_validate BEFORE INSERT ON "payment_allocation_reversals" FOR EACH ROW EXECUTE FUNCTION validate_allocation_reversal();
