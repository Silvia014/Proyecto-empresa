-- Persist customer special instructions for online ERP orders.
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "customerNotes" text;
