-- Launch migration audit (001-010)
-- Paste into Supabase SQL editor and run.

WITH checks AS (
  SELECT
    '001_initial_schema.sql' AS migration,
    (
      to_regclass('public.programs') IS NOT NULL
      AND to_regclass('public.valuations') IS NOT NULL
      AND to_regclass('public.transfer_partners') IS NOT NULL
      AND to_regclass('public.transfer_bonuses') IS NOT NULL
      AND to_regclass('public.redemption_options') IS NOT NULL
      AND to_regclass('public.users') IS NOT NULL
      AND to_regclass('public.user_balances') IS NOT NULL
      AND to_regclass('public.alert_subscriptions') IS NOT NULL
      AND to_regclass('public.latest_valuations') IS NOT NULL
      AND to_regclass('public.active_bonuses') IS NOT NULL
    ) AS loaded,
    concat_ws('; ',
      CASE WHEN to_regclass('public.programs') IS NULL THEN 'missing programs' END,
      CASE WHEN to_regclass('public.valuations') IS NULL THEN 'missing valuations' END,
      CASE WHEN to_regclass('public.transfer_partners') IS NULL THEN 'missing transfer_partners' END,
      CASE WHEN to_regclass('public.transfer_bonuses') IS NULL THEN 'missing transfer_bonuses' END,
      CASE WHEN to_regclass('public.redemption_options') IS NULL THEN 'missing redemption_options' END,
      CASE WHEN to_regclass('public.users') IS NULL THEN 'missing users' END,
      CASE WHEN to_regclass('public.user_balances') IS NULL THEN 'missing user_balances' END,
      CASE WHEN to_regclass('public.alert_subscriptions') IS NULL THEN 'missing alert_subscriptions' END,
      CASE WHEN to_regclass('public.latest_valuations') IS NULL THEN 'missing latest_valuations view' END,
      CASE WHEN to_regclass('public.active_bonuses') IS NULL THEN 'missing active_bonuses view' END
    ) AS details

  UNION ALL
  SELECT
    '002_auth_preferences.sql',
    (
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='auth_id'
      )
      AND to_regclass('public.user_preferences') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.tgname='on_auth_user_created'
          AND n.nspname='auth'
          AND c.relname='users'
          AND NOT t.tgisinternal
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='users' AND policyname='Users see own profile'
      )
    ),
    concat_ws('; ',
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='auth_id'
      ) THEN 'missing users.auth_id' END,
      CASE WHEN to_regclass('public.user_preferences') IS NULL THEN 'missing user_preferences' END,
      CASE WHEN NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.tgname='on_auth_user_created'
          AND n.nspname='auth'
          AND c.relname='users'
          AND NOT t.tgisinternal
      ) THEN 'missing on_auth_user_created trigger' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='users' AND policyname='Users see own profile'
      ) THEN 'missing users RLS policy' END
    )

  UNION ALL
  SELECT
    '003_cards_and_alerts.sql',
    (
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='transfer_bonuses' AND column_name='alerted_at'
      )
      AND EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname='public' AND t.typname='spend_category'
      )
      AND to_regclass('public.cards') IS NOT NULL
      AND to_regclass('public.card_earning_rates') IS NOT NULL
    ),
    concat_ws('; ',
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='transfer_bonuses' AND column_name='alerted_at'
      ) THEN 'missing transfer_bonuses.alerted_at' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname='public' AND t.typname='spend_category'
      ) THEN 'missing spend_category enum' END,
      CASE WHEN to_regclass('public.cards') IS NULL THEN 'missing cards table' END,
      CASE WHEN to_regclass('public.card_earning_rates') IS NULL THEN 'missing card_earning_rates table' END
    )

  UNION ALL
  SELECT
    '004_users_rls.sql',
    (
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname='users' AND c.relrowsecurity
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='users' AND policyname='Users see own profile'
      )
    ),
    concat_ws('; ',
      CASE WHEN NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname='users' AND c.relrowsecurity
      ) THEN 'users RLS not enabled' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='users' AND policyname='Users see own profile'
      ) THEN 'missing users RLS policy' END
    )

  UNION ALL
  SELECT
    '005_card_affiliate_urls.sql',
    (
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cards' AND column_name='apply_url'
      )
      AND EXISTS (SELECT 1 FROM public.cards WHERE apply_url IS NOT NULL)
    ),
    concat_ws('; ',
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cards' AND column_name='apply_url'
      ) THEN 'missing cards.apply_url' END,
      CASE WHEN NOT EXISTS (SELECT 1 FROM public.cards WHERE apply_url IS NOT NULL) THEN 'no apply_url data seeded' END
    )

  UNION ALL
  SELECT
    '006_india_programs.sql',
    (
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='programs' AND column_name='geography'
      )
      AND EXISTS (SELECT 1 FROM public.programs WHERE slug='hdfc-millennia')
      AND EXISTS (
        SELECT 1 FROM public.transfer_partners tp
        JOIN public.programs p ON p.id = tp.from_program_id
        WHERE p.slug='hdfc-millennia'
      )
    ),
    concat_ws('; ',
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='programs' AND column_name='geography'
      ) THEN 'missing programs.geography' END,
      CASE WHEN NOT EXISTS (SELECT 1 FROM public.programs WHERE slug='hdfc-millennia') THEN 'missing India program seed' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM public.transfer_partners tp
        JOIN public.programs p ON p.id = tp.from_program_id
        WHERE p.slug='hdfc-millennia'
      ) THEN 'missing India transfer partner seed' END
    )

  UNION ALL
  SELECT
    '007_india_cards.sql',
    (
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cards' AND column_name='currency'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cards' AND column_name='earn_unit'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cards' AND column_name='geography'
      )
      AND EXISTS (SELECT 1 FROM public.cards WHERE geography='IN')
      AND EXISTS (
        SELECT 1
        FROM public.card_earning_rates cer
        JOIN public.cards c ON c.id = cer.card_id
        WHERE c.geography='IN'
      )
    ),
    concat_ws('; ',
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cards' AND column_name='currency'
      ) THEN 'missing cards.currency' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cards' AND column_name='earn_unit'
      ) THEN 'missing cards.earn_unit' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cards' AND column_name='geography'
      ) THEN 'missing cards.geography' END,
      CASE WHEN NOT EXISTS (SELECT 1 FROM public.cards WHERE geography='IN') THEN 'no India cards seeded' END,
      CASE WHEN NOT EXISTS (
        SELECT 1
        FROM public.card_earning_rates cer
        JOIN public.cards c ON c.id = cer.card_id
        WHERE c.geography='IN'
      ) THEN 'no India earning rates seeded' END
    )

  UNION ALL
  SELECT
    '008_affiliate_clicks.sql',
    (
      to_regclass('public.affiliate_clicks') IS NOT NULL
      AND to_regclass('public.idx_affiliate_clicks_created_at') IS NOT NULL
      AND to_regclass('public.idx_affiliate_clicks_card_source') IS NOT NULL
    ),
    concat_ws('; ',
      CASE WHEN to_regclass('public.affiliate_clicks') IS NULL THEN 'missing affiliate_clicks table' END,
      CASE WHEN to_regclass('public.idx_affiliate_clicks_created_at') IS NULL THEN 'missing idx_affiliate_clicks_created_at' END,
      CASE WHEN to_regclass('public.idx_affiliate_clicks_card_source') IS NULL THEN 'missing idx_affiliate_clicks_card_source' END
    )

  UNION ALL
  SELECT
    '009_security_hardening_rls.sql',
    (
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='user_balances' AND c.relrowsecurity
      )
      AND EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='alert_subscriptions' AND c.relrowsecurity
      )
      AND EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='affiliate_clicks' AND c.relrowsecurity
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='user_balances' AND policyname='Users manage own balances'
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='alert_subscriptions' AND policyname='Users manage own alert subscriptions'
      )
    ),
    concat_ws('; ',
      CASE WHEN NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='user_balances' AND c.relrowsecurity
      ) THEN 'user_balances RLS not enabled' END,
      CASE WHEN NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='alert_subscriptions' AND c.relrowsecurity
      ) THEN 'alert_subscriptions RLS not enabled' END,
      CASE WHEN NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='affiliate_clicks' AND c.relrowsecurity
      ) THEN 'affiliate_clicks RLS not enabled' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='user_balances' AND policyname='Users manage own balances'
      ) THEN 'missing user_balances policy' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='alert_subscriptions' AND policyname='Users manage own alert subscriptions'
      ) THEN 'missing alert_subscriptions policy' END
    )

  UNION ALL
  SELECT
    '010_flight_watches.sql',
    (
      to_regclass('public.flight_watches') IS NOT NULL
      AND to_regclass('public.idx_flight_watches_active') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='flight_watches' AND c.relrowsecurity
      )
      AND EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='flight_watches' AND policyname='Users manage own flight watches'
      )
    ),
    concat_ws('; ',
      CASE WHEN to_regclass('public.flight_watches') IS NULL THEN 'missing flight_watches table' END,
      CASE WHEN to_regclass('public.idx_flight_watches_active') IS NULL THEN 'missing idx_flight_watches_active' END,
      CASE WHEN NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='flight_watches' AND c.relrowsecurity
      ) THEN 'flight_watches RLS not enabled' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='flight_watches' AND policyname='Users manage own flight watches'
      ) THEN 'missing flight_watches policy' END
    )
)
SELECT
  migration,
  loaded,
  CASE WHEN loaded THEN 'ok' ELSE COALESCE(details, 'check failed') END AS details
FROM checks
ORDER BY migration;
