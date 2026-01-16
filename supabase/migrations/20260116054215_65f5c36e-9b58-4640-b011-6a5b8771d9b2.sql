-- Drop existing restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage categories" ON public.material_categories;
DROP POLICY IF EXISTS "Admins can manage units" ON public.units;

-- Create permissive policies for material_categories
CREATE POLICY "Admins can manage categories"
ON public.material_categories
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create permissive policies for units
CREATE POLICY "Admins can manage units"
ON public.units
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));