-- Add the missing Cali branch and make Brasapuntos earn/redeem rules part of
-- the order lifecycle. Do not grant browser roles access to the loyalty ledger.

INSERT INTO public."Location" (id, name, city, country, currency, timezone)
SELECT 'CO-CLO-01', 'Brasaland Cali', 'Cali', 'Colombia', 'COP', 'America/Bogota'
WHERE NOT EXISTS (
  SELECT 1 FROM public."Location"
  WHERE lower(city) = 'cali' AND lower(country) IN ('colombia', 'co')
);

ALTER TABLE public."Order"
  ADD COLUMN IF NOT EXISTS "loyaltyUsdRate" double precision,
  ADD COLUMN IF NOT EXISTS "loyaltyUsdTotal" double precision,
  ADD COLUMN IF NOT EXISTS "menuEurRate" double precision,
  ADD COLUMN IF NOT EXISTS "deliveryFee" double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "brasapointsRestoredAt" timestamptz;

ALTER TABLE public."Order"
  ADD CONSTRAINT order_loyalty_usd_rate_nonnegative
    CHECK ("loyaltyUsdRate" IS NULL OR "loyaltyUsdRate" >= 0),
  ADD CONSTRAINT order_loyalty_usd_total_nonnegative
    CHECK ("loyaltyUsdTotal" IS NULL OR "loyaltyUsdTotal" >= 0),
  ADD CONSTRAINT order_menu_eur_rate_nonnegative
    CHECK ("menuEurRate" IS NULL OR "menuEurRate" >= 0),
  ADD CONSTRAINT order_delivery_fee_nonnegative
    CHECK ("deliveryFee" >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS brasapoints_order_reward_once_idx
  ON public."BrasapointsTransaction" ("orderId", "type")
  WHERE "orderId" IS NOT NULL AND "type" = 'ORDER_REWARD';

GRANT SELECT, UPDATE ON TABLE public."BrasapointsAccount" TO service_role;
GRANT SELECT, INSERT ON TABLE public."BrasapointsTransaction" TO service_role;
GRANT SELECT, UPDATE ON TABLE public."Order" TO service_role;

CREATE OR REPLACE FUNCTION public.apply_brasapoints_order_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  account_id text;
  available_points integer;
  points_to_redeem integer;
  points_to_award integer;
  reward_discount numeric(12, 2);
  eligible_usd numeric(14, 2);
  effective_total numeric(14, 2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT account.id, account.balance
      INTO account_id, available_points
      FROM public."BrasapointsAccount" AS account
      WHERE account."customerId" = NEW."customerId"
      FOR UPDATE;

    -- Rewards are applied automatically on the next order. Redeeming clears
    -- the entire active balance, as specified by the Brasaclub rule.
    IF account_id IS NOT NULL AND available_points >= 100 THEN
      points_to_redeem := available_points;
      reward_discount := round(greatest(COALESCE(NEW.subtotal, 0) - COALESCE(NEW.discount, 0), 0) * 0.10, 2);

      UPDATE public."BrasapointsAccount"
        SET balance = 0, "updatedAt" = now()
        WHERE id = account_id;

      INSERT INTO public."BrasapointsTransaction"
        (id, "accountId", type, points, "orderId", description, "createdAt")
      VALUES
        (gen_random_uuid()::text, account_id, 'REDEMPTION', -points_to_redeem, NEW.id,
         'Automatic 10% Brasapuntos discount; active balance reset', now());

      UPDATE public."Order"
        SET "brasapointsDiscount" = reward_discount,
            "brasapointsUsed" = points_to_redeem,
            total = greatest(0, COALESCE(NEW.subtotal, 0) - COALESCE(NEW.discount, 0) - reward_discount)
                    + COALESCE(NEW."deliveryFee", 0),
            "updatedAt" = now()
        WHERE id = NEW.id;
    END IF;
  END IF;

  -- Award only after the payment is confirmed. The rate is captured by the
  -- payment-confirmation endpoint at that time, so COP orders use the current
  -- COP-to-USD rate and the calculation remains auditable on the order.
  IF NEW."paymentStatus" = 'PAID' AND COALESCE(NEW."loyaltyUsdRate", 0) > 0 THEN
    SELECT total INTO effective_total FROM public."Order" WHERE id = NEW.id;
    effective_total := COALESCE(effective_total, NEW.total, 0);
    eligible_usd := round(greatest(effective_total - COALESCE(NEW."deliveryFee", 0), 0) * NEW."loyaltyUsdRate", 2);
    points_to_award := floor(eligible_usd / 100) * 100;

    UPDATE public."Order"
      SET "loyaltyUsdTotal" = eligible_usd,
          "brasapointsEarned" = points_to_award,
          "updatedAt" = now()
      WHERE id = NEW.id;

    IF points_to_award > 0 AND NOT EXISTS (
      SELECT 1 FROM public."BrasapointsTransaction"
      WHERE "orderId" = NEW.id AND type = 'ORDER_REWARD'
    ) THEN
      SELECT id INTO account_id
        FROM public."BrasapointsAccount"
        WHERE "customerId" = NEW."customerId"
        FOR UPDATE;

      IF account_id IS NOT NULL THEN
        UPDATE public."BrasapointsAccount"
          SET balance = balance + points_to_award, "updatedAt" = now()
          WHERE id = account_id;
        INSERT INTO public."BrasapointsTransaction"
          (id, "accountId", type, points, "orderId", description, "createdAt")
        VALUES
          (gen_random_uuid()::text, account_id, 'ORDER_REWARD', points_to_award, NEW.id,
           format('Earned for $%s of eligible paid spend', eligible_usd), now());
      END IF;
    END IF;
  END IF;

  -- If a restaurant cancels or refunds a pending/paid order, return points
  -- consumed by the automatic reward exactly once.
  IF TG_OP = 'UPDATE'
     AND NEW."brasapointsUsed" > 0
     AND NEW."brasapointsRestoredAt" IS NULL
     AND (NEW.status = 'CANCELLED' OR NEW."paymentStatus" IN ('FAILED', 'REFUNDED')) THEN
    SELECT id INTO account_id
      FROM public."BrasapointsAccount"
      WHERE "customerId" = NEW."customerId"
      FOR UPDATE;
    IF account_id IS NOT NULL THEN
      points_to_redeem := NEW."brasapointsUsed";
      UPDATE public."BrasapointsAccount"
        SET balance = balance + points_to_redeem, "updatedAt" = now()
        WHERE id = account_id;
      INSERT INTO public."BrasapointsTransaction"
        (id, "accountId", type, points, "orderId", description, "createdAt")
      VALUES
        (gen_random_uuid()::text, account_id, 'MANUAL_ADJUSTMENT', points_to_redeem, NEW.id,
         'Brasapuntos restored after order cancellation or refund', now());
      UPDATE public."Order" SET "brasapointsRestoredAt" = now(), "updatedAt" = now() WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brasapoints_order_lifecycle ON public."Order";
CREATE TRIGGER brasapoints_order_lifecycle
AFTER INSERT OR UPDATE OF status, "paymentStatus", "loyaltyUsdRate"
ON public."Order"
FOR EACH ROW
EXECUTE FUNCTION public.apply_brasapoints_order_lifecycle();
