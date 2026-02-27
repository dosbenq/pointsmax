# Supabase Migration Run Order + Verification

Run this in Supabase SQL Editor against production.

## 1) Run Migrations in Order

If already applied, the statements are mostly idempotent; still run in order:

1. `003_cards_and_alerts.sql` (only if not already run)
2. `004_users_rls.sql`
3. `005_card_affiliate_urls.sql`
4. `006_india_programs.sql`
5. `007_india_cards.sql`
6. `008_affiliate_clicks.sql`
7. `009_security_hardening_rls.sql`
8. `010_flight_watches.sql`

Files:

- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/supabase/migrations/003_cards_and_alerts.sql`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/supabase/migrations/004_users_rls.sql`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/supabase/migrations/005_card_affiliate_urls.sql`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/supabase/migrations/006_india_programs.sql`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/supabase/migrations/007_india_cards.sql`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/supabase/migrations/008_affiliate_clicks.sql`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/supabase/migrations/009_security_hardening_rls.sql`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/supabase/migrations/010_flight_watches.sql`

## 2) Verification Queries

Run all queries below after migrations.

### A. Users table + RLS

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
  and column_name in ('auth_id', 'tier', 'stripe_customer_id')
order by column_name;
```

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('users', 'user_balances', 'user_preferences', 'alert_subscriptions', 'affiliate_clicks')
order by tablename;
```

### B. Cards apply_url column

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name = 'apply_url';
```

```sql
select
  count(*) as total_cards,
  count(*) filter (where apply_url is not null and apply_url <> '') as cards_with_apply_url
from public.cards;
```

### C. India geography + program seed

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'programs'
  and column_name = 'geography';
```

```sql
select geography, count(*) as programs
from public.programs
group by geography
order by geography;
```

```sql
select slug, name, type, geography
from public.programs
where geography = 'IN'
order by display_order;
```

```sql
select count(*) as india_transfer_edges
from public.transfer_partners tp
join public.programs p_from on p_from.id = tp.from_program_id
where p_from.geography = 'IN';
```

### D. India cards + affiliate click table

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name in ('currency', 'earn_unit', 'geography')
order by column_name;
```

```sql
select geography, currency, count(*) as cards
from public.cards
group by geography, currency
order by geography, currency;
```

```sql
select to_regclass('public.affiliate_clicks') as affiliate_clicks_table;
```

```sql
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('user_balances', 'alert_subscriptions', 'flight_watches')
order by tablename, policyname;
```

### E. Flight watch table + index

```sql
select to_regclass('public.flight_watches') as flight_watches_table;
```

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'flight_watches';
```

```sql
select to_regclass('public.idx_flight_watches_active') as flight_watch_active_index;
```

## 3) Functional DB Smoke

```sql
-- Premium upgrades can be persisted
select id, email, tier, stripe_customer_id
from public.users
order by created_at desc
limit 10;
```

```sql
-- Programs API region filter support data
select count(*) filter (where geography in ('global','US')) as us_or_global,
       count(*) filter (where geography in ('global','IN')) as in_or_global
from public.programs
where is_active = true;
```
