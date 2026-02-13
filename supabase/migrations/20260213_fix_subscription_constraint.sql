-- Remove the conflicting unique constraint on subscription/subscription_key if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'push_subscriptions' AND constraint_name = 'push_subscriptions_subscription_key'
  ) THEN
    ALTER TABLE public.push_subscriptions DROP CONSTRAINT push_subscriptions_subscription_key;
  END IF;
END $$;
