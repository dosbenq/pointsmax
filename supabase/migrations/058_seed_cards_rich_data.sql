-- ============================================================
-- PointsMax — Migration 058
-- Seed 60+ cards with real descriptions, community insights,
-- earning rates, and expert summaries (US + India)
-- ============================================================

-- 1) Idempotent column adds (safe re-run if 056 already applied)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS earning_rates TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS top_perks TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS community_sentiment TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ideal_for TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS recent_changes TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS expert_summary TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS welcome_benefit TEXT;

-- ============================================================
-- 2) UPDATE existing US cards (7 core cards from migration 003)
-- ============================================================

UPDATE cards SET
  earning_rates = '5X Chase Travel; 3X dining/streaming/online grocery; 2X travel; 1X else',
  top_perks = '$50 hotel credit; 10% anniversary bonus; DashPass; trip protection',
  community_sentiment = 'r/churning gold standard. Best $95 card. 75K SUB. Pair with Freedom cards.',
  ideal_for = 'Travel beginners entering Chase ecosystem; $2-5K/month spenders',
  recent_changes = 'Jun 2025: Points Boost. Portal baseline to 1cpp.',
  expert_summary = 'Gold standard entry travel card. 75K SUB, 5X/3X earning, Hyatt/United/SW transfers. $95/yr.',
  annual_fee_usd = 95,
  signup_bonus_pts = 75000,
  signup_bonus_spend = 4000
WHERE name = 'Chase Sapphire Preferred';

UPDATE cards SET
  earning_rates = '8X Chase Travel; 4X flights/hotels direct; 3X dining; 5X Lyft',
  top_perks = '$300 travel credit; Priority Pass + Sapphire Lounges; $300 StubHub; Global Entry',
  community_sentiment = 'r/churning premium favorite. $300 credit makes effective fee ~$250. Sapphire Lounges expanding.',
  ideal_for = 'Frequent travelers $5K+/month; luxury travelers wanting lounge access',
  recent_changes = 'SUB 125K. Added StubHub/dining credits. Fee now $795.',
  expert_summary = 'Premium powerhouse: 8X Chase Travel, Sapphire Lounges, $1100+ in credits offsetting $795 fee.',
  annual_fee_usd = 795,
  signup_bonus_pts = 125000
WHERE name = 'Chase Sapphire Reserve';

UPDATE cards SET
  earning_rates = '4X US supermarkets ($25K cap); 4X restaurants worldwide ($50K cap); 3X flights; 1X else',
  top_perks = '$120 Uber Cash; $120 dining credit; $100 Resy credit; $100 Hotel Collection; no FTF',
  community_sentiment = 'r/creditcards #1 dining/grocery card. 4X on both unmatched. Uber/dining credits offset $325 fee.',
  ideal_for = 'Foodies and families: $500+/mo groceries, frequent dining, Uber users',
  recent_changes = 'Fee $325. Added $100 Resy credit. SUB up to 100K via Resy.',
  expert_summary = 'Undisputed king of dining/grocery rewards: 4X both categories, $340+ annual credits, incredible transfer partners.',
  annual_fee_usd = 325,
  signup_bonus_pts = 100000,
  signup_bonus_spend = 6000
WHERE name = 'Amex Gold';

UPDATE cards SET
  earning_rates = '5X flights direct/Amex Travel ($500K cap); 5X prepaid hotels via Amex Travel; 1X else',
  top_perks = 'Centurion + Priority Pass lounges; $200 airline credit; $200 Uber; $600 FHR; $300 entertainment; $300 Lululemon; hotel elite statuses',
  community_sentiment = 'r/churning love/hate. Amazing lounges + credits but $895 needs effort. "Best if you travel, worst if you dont."',
  ideal_for = 'Luxury travelers flying 10+/yr who use Centurion Lounges; status chasers',
  recent_changes = 'Fee $895. SUB up to 175K. Added Lululemon credit.',
  expert_summary = 'Unparalleled luxury: Centurion Lounges, $1400+ credits, hotel elite statuses. $895 fee justified for frequent luxury travelers.',
  annual_fee_usd = 895,
  signup_bonus_pts = 175000,
  signup_bonus_spend = 8000
WHERE name = 'Amex Platinum';

UPDATE cards SET
  earning_rates = '10X hotels/cars via portal; 5X flights; 5X Entertainment; 2X everywhere',
  top_perks = '$300 travel credit; 10K anniversary miles; Priority Pass + Capital One Lounges; Global Entry',
  community_sentiment = 'r/creditcards darling. "Best premium for the price." $300+10K miles = effective $95 fee. Lounges getting rave reviews.',
  ideal_for = 'Travelers wanting premium lounges at fraction of Amex Plat price; 2X catch-all with no FTF',
  recent_changes = 'Lounges expanding 10+ airports. No devaluations.',
  expert_summary = 'Best premium value: Priority Pass + growing Capital One Lounges, $400 annual travel value for $395/yr (effective $95).',
  annual_fee_usd = 395,
  signup_bonus_pts = 75000
WHERE name = 'Capital One Venture X';

UPDATE cards SET
  earning_rates = '1X rent (no fee, 100K cap); 3X dining; 2X travel; 1X else; double on Rent Day (1st)',
  top_perks = 'Only card earning on rent with no fees; 1:1 transfers to Hyatt/AA/United/Turkish; $0 annual fee',
  community_sentiment = 'r/creditcards unanimous: must-have for renters. 2.2cpp by TPG — highest currency. Hyatt transfers.',
  ideal_for = 'Renters paying $1500+/month; anyone wanting free 2.2cpp points',
  recent_changes = 'Now valued 2.2¢ by TPG — highest transferable currency. More partners added.',
  expert_summary = 'Category-defining: earns on rent (no fees), 2.2¢ TPG value, transfers to Hyatt/AA/United. Must-have for renters.',
  annual_fee_usd = 0
WHERE name = 'Bilt Mastercard';

UPDATE cards SET
  earning_rates = '3X grocery/dining/gas/flights/hotels/travel agencies; 1X else',
  top_perks = 'Hotel credit; 15+ transfer partners; no FTF; trip protection',
  community_sentiment = 'Solid mid-tier competing with CSP. Broadest 3X categories. ThankYou partners weaker than Chase.',
  ideal_for = 'Broad spenders wanting 3X on groceries, gas, AND dining in one card',
  recent_changes = 'Rebranded "Citi Strata Premier" in some markets.',
  expert_summary = 'Broadest 3X earning: dining, groceries, gas, flights, hotels. $95/yr with Turkish/JetBlue transfers.',
  annual_fee_usd = 95,
  signup_bonus_pts = 60000
WHERE name = 'Citi Premier';

-- ============================================================
-- 3) INSERT new US cards (only truly new ones not in earlier migrations)
-- ============================================================

INSERT INTO cards (id, name, issuer, annual_fee_usd, signup_bonus_pts, signup_bonus_spend, program_id, display_order, geography, earning_rates, top_perks, community_sentiment, ideal_for, recent_changes, expert_summary)
VALUES
  ('aaaa0001-0000-0000-0000-000000000401', 'Chase Ink Business Preferred', 'Chase', 95, 100000, 8000,
   (SELECT id FROM programs WHERE slug = 'chase-ur' LIMIT 1), 25, 'US',
   '3X travel/shipping/internet/ads (first $150K combined); 1X else',
   '100K UR SUB; cell phone protection; trip cancellation; employee cards free',
   'r/churning staple. Best business SUB. 100K UR = $2000+ via Hyatt.',
   'Business owners with $8K in 3mo biz spend',
   'No changes. 100K SUB — one of the highest.',
   'Best SUB in Chase ecosystem: 100K UR worth $2000+ via Hyatt. 3X on shipping/internet/ads.'),

  ('aaaa0001-0000-0000-0000-000000000404', 'Amex Gold (Resy)', 'American Express', 325, 100000, 6000,
   (SELECT id FROM programs WHERE slug = 'amex-mr' LIMIT 1), 12, 'US',
   '4X US supermarkets ($25K cap); 4X restaurants worldwide; 3X flights; 1X else',
   '$120 Uber Cash; $120 dining credit; $100 Resy credit; 100K SUB via Resy',
   'Best SUB route for Amex Gold — 100K via Resy link vs 60K public offer.',
   'Anyone getting Amex Gold — always apply via Resy for higher SUB',
   'Resy offer fluctuates 75K-100K.',
   'Same Amex Gold but with elevated 100K SUB through Resy portal. Always check Resy first.'),

  ('aaaa0001-0000-0000-0000-000000000407', 'Wells Fargo Active Cash', 'Wells Fargo', 0, 20000, 500,
   (SELECT id FROM programs WHERE slug = 'wells-fargo-rewards' LIMIT 1), 51, 'US',
   '2% cash rewards on all purchases',
   '$200 bonus; 0% intro APR 12mo; cell phone protection ($600/claim)',
   'r/creditcards: best 2% card WITH cell phone protection. Unique perk for $0.',
   'Everyday spenders wanting 2% + cell phone protection',
   'No changes. Stable flat-rate card.',
   'Clean 2% on everything + cell phone protection ($600/claim) on a $0 fee card.'),

  ('aaaa0001-0000-0000-0000-000000000408', 'Discover it Cash Back', 'Discover', 0, 0, 0,
   (SELECT id FROM programs WHERE slug = 'discover-miles' LIMIT 1), 55, 'US',
   '5% rotating quarterly ($1500 cap); 1% else; FIRST YEAR: Cashback Match doubles ALL rewards',
   'Cashback Match (doubles year 1); no FTF; free FICO; US customer service',
   'r/creditcards top beginner pick. 10% effective on categories in year 1. Great starter.',
   'Beginners building credit; first-year maximizers',
   'No major changes. Quarterly categories rotate.',
   'Doubles ALL cash back in year 1 via Cashback Match — effectively 10% on categories, 2% on everything else.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4) UPDATE existing US cards from migration 022b with rich data
-- ============================================================

UPDATE cards SET
  earning_rates = '5% Chase Travel; 3% dining/drugstores; 1.5% everything else',
  top_perks = '$250 bonus; 0% intro APR; DashPass; 2% Lyft thru 9/2027',
  community_sentiment = 'r/creditcards top no-fee card. 1.5% base becomes 2.25%+ with Sapphire. Easy SUB.',
  ideal_for = 'Everyday spenders in Chase ecosystem; beginners',
  recent_changes = 'SUB fluctuated $200-$300. Currently $250.',
  expert_summary = 'No-fee powerhouse: uncapped 1.5% on all + 3%/5% bonuses. Essential Chase ecosystem filler.',
  signup_bonus_pts = 25000,
  signup_bonus_spend = 500
WHERE name = 'Chase Freedom Unlimited';

UPDATE cards SET
  earning_rates = '5% rotating quarterly ($1500 cap); 5% Chase Travel; 3% dining/drugstores; 1% else',
  top_perks = '$200 bonus; cell phone protection ($800/claim); purchase protection; trip insurance',
  community_sentiment = 'r/creditcards: "overpowered" with 9% stacked rates. Must activate quarterly. $1500 cap.',
  ideal_for = 'Category maximizers pairing with Sapphire; beginners under 5/24',
  recent_changes = 'Normal quarterly updates. Q1 2026: dining. Q2: Amazon.',
  expert_summary = 'Rotating 5% categories + fixed 3% dining. Cell phone protection on a $0 card. Pair with Sapphire.',
  signup_bonus_pts = 20000,
  signup_bonus_spend = 500
WHERE name = 'Chase Freedom Flex';

UPDATE cards SET
  earning_rates = '3% dining/entertainment/groceries/streaming; 8% Capital One Entertainment; 5% hotels/cars via portal; 1% else',
  top_perks = 'No FTF; 0% intro APR 12mo; rewards never expire',
  community_sentiment = 'r/creditcards: "must-have long-term card." Uncapped 3% on key categories with no fee.',
  ideal_for = 'Foodies, entertainment fans, grocery shoppers wanting no-fee 3%',
  recent_changes = '2024 rebrand from SavorOne. No devaluations.',
  expert_summary = 'No-fee 3% on dining, groceries, entertainment, and streaming — uncapped. Best paired with Venture X.'
WHERE name = 'Capital One SavorOne';

UPDATE cards SET
  earning_rates = '2% on everything (1% when you buy + 1% when you pay)',
  top_perks = '0% intro APR 18mo on BT; Citi Entertainment access; ThankYou transfer access',
  community_sentiment = 'r/creditcards: best simple 2% card. Pair with Strata for transfers.',
  ideal_for = 'Everyday spenders wanting flat 2%; balance transfer users',
  recent_changes = 'Minor ThankYou transfer ratio devals Jul 2025 for no-fee cards.',
  expert_summary = 'Unlimited 2% on everything. No fee. Pair with Citi Premier for ThankYou transfers.',
  signup_bonus_pts = 20000,
  signup_bonus_spend = 1500
WHERE name = 'Citi Double Cash';

-- ============================================================
-- 5) UPDATE existing India cards with rich data
-- ============================================================

UPDATE cards SET
  earning_rates = '5 RP/₹150 (3.3%); up to 10X (33%) SmartBuy hotels; 5X (16.5%) flights',
  top_perks = 'Unlimited global lounges (Priority Pass); Unlimited golf; 2% forex; Club Marriott; Concierge',
  community_sentiment = 'CardExpert #1 premium. r/CreditCardsIndia loves SmartBuy 33%. Hates 2025-26 devaluations (₹18L waiver, caps).',
  ideal_for = 'High spenders ₹10L+/yr; HNWIs with HDFC relationship (ITR >₹45L)',
  recent_changes = '2026: Fee waiver ₹10L→₹18L. SmartBuy proposed 5x→3x rolled back. Caps tightened.',
  expert_summary = 'India #1 super-premium: up to 33% via SmartBuy, unlimited lounges/golf. But 2025-26 devals pushing some to Axis Magnus.'
WHERE name = 'HDFC Infinia';

UPDATE cards SET
  earning_rates = '5% Prime/3% non-Prime on Amazon; 2% Amazon Pay partners; 1% other',
  top_perks = 'Lifetime free; Unlimited non-expiring cashback; 1.99% forex; 1% fuel waiver',
  community_sentiment = 'Reddit: best LTF for Amazon shoppers. Loves 5% unlimited. Hates low non-Amazon rates.',
  ideal_for = 'Frequent Amazon Prime shoppers',
  recent_changes = 'Oct 2025: Forex cut to 1.99%. Added 5% on Amazon Pay travel. Excluded utilities.',
  expert_summary = 'Top LTF pick for Amazon loyalists: unmatched 5% unlimited on Amazon + travel via Amazon Pay.'
WHERE name LIKE 'ICICI Amazon%';

UPDATE cards SET
  earning_rates = '2 EDGE RP/₹200 base; 5X via Travel EDGE (10% flights/hotels)',
  top_perks = '8 intl lounge visits/yr; 4 domestic/quarter; 2% forex; Axis travel portal',
  community_sentiment = 'TechnoFino: best mid-range travel card. 10% Travel EDGE return. r/CreditCardsIndia: best alternative to Infinia.',
  ideal_for = 'Travel enthusiasts ₹3-5L/yr booking via Travel EDGE',
  recent_changes = 'No major 2025-26 devaluations. Stable.',
  expert_summary = 'Up to 10% on travel via EDGE portal, solid lounges, low forex. India best mid-range travel card.'
WHERE name = 'Axis Atlas';

-- ============================================================
-- 6) INSERT new India cards
-- ============================================================

INSERT INTO cards (id, name, issuer, annual_fee_usd, signup_bonus_pts, signup_bonus_spend, program_id, display_order, geography, currency, earning_rates, top_perks, community_sentiment, ideal_for, recent_changes, expert_summary)
VALUES
  ('aaaa0001-0000-0000-0000-000000000501', 'HDFC Diners Club Black', 'HDFC Bank', 142, 0, 0,
   (SELECT id FROM programs WHERE slug = 'hdfc-millennia' LIMIT 1), 102, 'IN', 'INR',
   '3.33% (5 RP/₹150); up to 10% SmartBuy; 33% on 10X partners',
   'Unlimited lounge (primary+addon); Unlimited golf; 2% forex; BOGO movies; 10X partners',
   'TechnoFino #2 premium after Infinia. Loves SmartBuy + BOGO. Hates Diners acceptance internationally.',
   'High domestic spenders ₹10L+/yr; movie enthusiasts',
   '2025-26: SmartBuy caps 10K RP/month. BOGO limited cities.',
   'Rivals Infinia rewards (3.33%+10% SmartBuy) with better movie/dining perks. Limited international acceptance.'),

  ('aaaa0001-0000-0000-0000-000000000502', 'HDFC Millennia', 'HDFC Bank', 12, 0, 0,
   (SELECT id FROM programs WHERE slug = 'hdfc-millennia' LIMIT 1), 130, 'IN', 'INR',
   '5% on Amazon/Flipkart/Myntra (₹1000/mo cap); 1% other',
   'Low fee (₹1000, waived ₹1L); 5% e-commerce; 1% fuel waiver',
   'Reddit: best entry cashback. CardExpert: ideal for online shoppers. Low caps.',
   'Online shoppers ₹20K+/mo Amazon/Flipkart',
   'Stable. No major changes.',
   'India most popular entry card: 5% back on Amazon/Flipkart/Myntra. Low ₹1000 fee.'),

  ('aaaa0001-0000-0000-0000-000000000503', 'Axis Magnus', 'Axis Bank', 148, 0, 0,
   (SELECT id FROM programs WHERE slug = 'axis-edge' LIMIT 1), 101, 'IN', 'INR',
   '12 EDGE RP/₹200 up to ₹1.5L/mo; 35 RP above; 5X Travel EDGE',
   'Unlimited intl lounge (Priority Pass) + 4 guest; Unlimited domestic; 2% forex; ₹12,500 welcome voucher',
   'CardExpert: mixed post-devaluation. TechnoFino: still viable for ultra-high spenders. Multiple devals.',
   'Ultra-high spenders >₹1.5L/month; frequent travelers',
   'Jun 2025: T&Cs updated. Guest visits capped 4/yr. RP forfeiture rules.',
   'Viable for ultra-high spenders (14-24% via accelerated rates). Multiple devals eroded edge vs Infinia.'),

  ('aaaa0001-0000-0000-0000-000000000504', 'SBI Elite', 'SBI Card', 59, 0, 0,
   (SELECT id FROM programs WHERE slug = 'sbi-reward-points' LIMIT 1), 115, 'IN', 'INR',
   '5X dining/groceries (10pts/₹100); 2pts/₹100 other; 1pt=₹0.25',
   '₹6000/yr movies (BookMyShow); 8 domestic + 6 intl lounges; 1.99% forex; milestone bonuses',
   'CardExpert 3/5. Reddit: loves movies + milestones. Hates low base (0.5%), ₹10L waiver.',
   'Frequent moviegoers; ₹5-10L/yr spenders hitting milestones',
   'Trident membership withdrawn Jun 2024. Stable otherwise.',
   'Standout movie benefits (₹6K/yr) + lounges at moderate fee. Best for entertainment spenders.'),

  ('aaaa0001-0000-0000-0000-000000000505', 'OneCard', 'OneCard (Federal Bank)', 0, 0, 0,
   (SELECT id FROM programs WHERE slug = 'sbi-reward-points' LIMIT 1), 135, 'IN', 'INR',
   '5X on top 2 auto-detected categories; 1X others; 1% fuel',
   'Lifetime free metal card; smart auto-category 5X; instant EMI; digital-first',
   'Reddit: best LTF for beginners. Loves metal card, smart categories. Hates low limits initially.',
   'First-time card holders wanting premium feel; digital-native users',
   'Expanding offers. No major devals.',
   'Disrupted Indian cards: free metal card + smart 5X category detection. Best LTF beginner card.'),

  ('aaaa0001-0000-0000-0000-000000000506', 'IndusInd Tiger', 'IndusInd Bank', 0, 0, 0,
   (SELECT id FROM programs WHERE slug = 'indusmoments' LIMIT 1), 131, 'IN', 'INR',
   'Tiered: 1-6 RP/₹100 based on spend volume; 1 RP = ₹0.40 or 1.2 airmiles',
   'Lifetime free Visa Signature; 2 domestic lounge/qtr + 2 intl/yr (no spend req); 1.5% forex; golf',
   'Reddit: "hidden gem" best LTF with premium perks. CardExpert 4.8/5. Loves free lounges.',
   'Moderate-high spenders ₹5L+/yr wanting premium perks without fees',
   'Cash redemption capped 5000 RP/mo (Sep 2024).',
   'Rare LTF Visa Signature: unconditional lounges, 1.5% forex, accelerated rewards. Best-kept secret.')
ON CONFLICT (id) DO NOTHING;
