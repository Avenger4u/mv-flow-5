-- Create units table for managing units
CREATE TABLE public.units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on units
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- RLS policy for units (admins only)
CREATE POLICY "Admins can manage units" ON public.units
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default units
INSERT INTO public.units (name) VALUES 
  ('Pcs'), ('Dzn'), ('Meter'), ('Thaan'), ('Kg'), ('Gram'), ('Set'), ('Roll'), ('Sheet'), ('Bundle');

-- Enhance stock_transactions table with order linking and remarks
ALTER TABLE public.stock_transactions 
  ADD COLUMN order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN order_number TEXT,
  ADD COLUMN remarks TEXT;

-- Create index for better query performance on stock_transactions
CREATE INDEX idx_stock_transactions_material_id ON public.stock_transactions(material_id);
CREATE INDEX idx_stock_transactions_created_at ON public.stock_transactions(created_at);
CREATE INDEX idx_stock_transactions_order_id ON public.stock_transactions(order_id);