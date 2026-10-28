ALTER TABLE public.sitecue_profiles
ADD COLUMN IF NOT EXISTS polar_customer_id text,
ADD COLUMN IF NOT EXISTS polar_subscription_id text;
