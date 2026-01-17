-- Expand allowed transaction types to include 'in' and 'out' for ledger consistency
ALTER TABLE public.stock_transactions DROP CONSTRAINT IF EXISTS stock_transactions_transaction_type_check;

ALTER TABLE public.stock_transactions
ADD CONSTRAINT stock_transactions_transaction_type_check
CHECK (transaction_type = ANY (ARRAY['add'::text, 'reduce'::text, 'order_deduction'::text, 'in'::text, 'out'::text]));