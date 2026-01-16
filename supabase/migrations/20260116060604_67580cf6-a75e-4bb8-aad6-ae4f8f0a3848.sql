-- Add opening_stock to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS opening_stock numeric NOT NULL DEFAULT 0;

-- Add source/reason type enum for stock transactions
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_in_source') THEN
    CREATE TYPE stock_in_source AS ENUM ('market_purchase', 'party_supply', 'other_supplier', 'return', 'adjustment', 'opening_stock');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_out_reason') THEN
    CREATE TYPE stock_out_reason AS ENUM ('used_in_order', 'wastage', 'sample', 'damage', 'returned', 'adjustment');
  END IF;
END $$;

-- Expand stock_transactions table with new columns
ALTER TABLE public.stock_transactions
ADD COLUMN IF NOT EXISTS transaction_date date NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS source_type text,
ADD COLUMN IF NOT EXISTS reason_type text,
ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.parties(id),
ADD COLUMN IF NOT EXISTS rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_after numeric DEFAULT 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_transactions_material_date 
ON public.stock_transactions(material_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_party 
ON public.stock_transactions(party_id);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_order 
ON public.stock_transactions(order_id);

-- Update existing transactions to have transaction_date from created_at
UPDATE public.stock_transactions 
SET transaction_date = DATE(created_at)
WHERE transaction_date IS NULL OR transaction_date = CURRENT_DATE;