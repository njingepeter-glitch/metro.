-- Ensure company registration insert policy reliably allows signed-in users only
DROP POLICY IF EXISTS "Users can insert their own company" ON public.companies;

CREATE POLICY "Users can insert their own company"
ON public.companies
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
);