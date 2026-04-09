-- Ensure columns exist
ALTER TABLE cards ADD COLUMN IF NOT EXISTS earning_rates TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS top_perks TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS community_sentiment TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ideal_for TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS recent_changes TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS expert_summary TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS welcome_benefit TEXT;

-- HDFC Tata Neu Infinity
INSERT INTO cards (id, name, issuer, annual_fee_usd, program_id, display_order, geography, currency, earning_rates, top_perks, community_sentiment, ideal_for, recent_changes, expert_summary) VALUES
('aaaa0001-0000-0000-0000-000000000520', 'HDFC Tata Neu Infinity', 'HDFC Bank', 18,
 (SELECT id FROM programs WHERE slug = 'tata-neu' LIMIT 1), 127, 'IN', 'INR',
 '10% NeuCoins on Tata Neu app (5% base + 5% addl); 5% on Tata brands; 1.5% other; 1.5% UPI (500/mo cap)',
 '8 domestic + 4 intl lounge visits/yr; 1% fuel waiver; ₹1Cr air accident insurance; 1 NeuCoin = ₹1',
 'Reddit: best for Tata ecosystem. TechnoFino: loves 5-10% on BigBasket/Croma/1mg. Hates: glitchy Tata Neu app, recent UPI/insurance caps Jul 2025.',
 'Heavy Tata ecosystem shoppers (BigBasket, Croma, 1mg, Tata CLiQ); UPI users',
 'Jun 2025: Lounge now requires ₹50K/qtr spend. Jul 2025: UPI cap, insurance cap, NeuCoins 12-month validity.',
 'Strong 5-10% returns within Tata ecosystem (BigBasket, Croma, 1mg) + rare UPI rewards. Recent 2025 caps slightly dilute value.')
ON CONFLICT (id) DO NOTHING;

-- ICICI Sapphiro
INSERT INTO cards (id, name, issuer, annual_fee_usd, program_id, display_order, geography, currency, earning_rates, top_perks, community_sentiment, ideal_for, recent_changes, expert_summary) VALUES
('aaaa0001-0000-0000-0000-000000000521', 'ICICI Sapphiro', 'ICICI Bank', 42,
 (SELECT id FROM programs WHERE slug = 'icici-rewards' LIMIT 1), 112, 'IN', 'INR',
 '2 RP/₹100 (2%); 2X on weekend dining; milestone bonuses up to ₹15K',
 '2 domestic + 2 intl lounge/quarter; 1% forex markup (India lowest!); golf privileges; comprehensive insurance',
 'Reddit r/CreditCardsIndia: best ICICI daily driver. CardExpert 4/5. Loves 1% forex (lowest in India). Hates iShop devaluations 2026.',
 'Daily spenders wanting flat 2% with ICICI; international travelers (lowest 1% forex)',
 '2026: iShop removed 6X on Amazon Pay/Swiggy. Transport/insurance caps. Still best for forex.',
 'India lowest forex markup (1%) + solid 2% base rewards. Best for ICICI ecosystem users who travel internationally.')
ON CONFLICT (id) DO NOTHING;

-- ICICI Emeralde Private Metal
INSERT INTO cards (id, name, issuer, annual_fee_usd, program_id, display_order, geography, currency, earning_rates, top_perks, community_sentiment, ideal_for, recent_changes, expert_summary) VALUES
('aaaa0001-0000-0000-0000-000000000522', 'ICICI Emeralde Private Metal', 'ICICI Bank', 142,
 (SELECT id FROM programs WHERE slug = 'icici-rewards' LIMIT 1), 103, 'IN', 'INR',
 '3 RP/₹100 (3%); up to 18% via iShop HPCL/FASTag route; 2X weekends',
 'Unlimited domestic + intl lounge (Priority Pass); 1% forex; 24/7 concierge; Comprehensive insurance ₹2Cr',
 'TechnoFino: India best rewards after HDFC Infinia. r/CreditCardsIndia: loves 3% uncapped base. Hates invite-only access.',
 'Ultra-HNWIs with ICICI Private Banking (₹5Cr+ portfolio); heavy spenders wanting 3% uncapped',
 '2026: iShop caps on transport/insurance. Still uncapped on base rewards.',
 'India highest uncapped base rate (3%) with unlimited lounges and lowest forex. Invite-only for ICICI Private Banking clients.')
ON CONFLICT (id) DO NOTHING;

-- IDFC FIRST Select
INSERT INTO cards (id, name, issuer, annual_fee_usd, program_id, display_order, geography, currency, earning_rates, top_perks, community_sentiment, ideal_for, recent_changes, expert_summary) VALUES
('aaaa0001-0000-0000-0000-000000000523', 'IDFC FIRST Select', 'IDFC FIRST Bank', 6,
 NULL, 132, 'IN', 'INR',
 '3X on select online merchants; 10X on IDFC Travel portal; 0.5% base; 6X on MCC 5411/5812',
 'LTF on ₹50K spend; 0.99% forex (industry lowest tier); Railway lounge access; 6-month RP validity',
 'Reddit: decent LTF card. TechnoFino: loves low forex. Hates 6-month RP expiry and low base rate.',
 'Domestic travelers; IDFC bank customers; those wanting sub-1% forex',
 'No major 2025-2026 devaluations. Stable.',
 'India lowest-tier forex (0.99%) + solid travel portal. Best as LTF secondary card for low forex spend.')
ON CONFLICT (id) DO NOTHING;

-- Kotak 811 #DreamDifferent
INSERT INTO cards (id, name, issuer, annual_fee_usd, program_id, display_order, geography, currency, earning_rates, top_perks, community_sentiment, ideal_for, recent_changes, expert_summary) VALUES
('aaaa0001-0000-0000-0000-000000000524', 'Kotak 811 #DreamDifferent', 'Kotak Mahindra Bank', 0,
 NULL, 140, 'IN', 'INR',
 '1% cashback on all spends (no categories); 5% on first online txn/month',
 'Lifetime free; simple flat 1% cashback; no spend conditions; instant digital issuance',
 'Reddit: simplest LTF cashback card. Good for beginners. No hoops. Low limits initially.',
 'Beginners wanting no-fuss cashback; Kotak 811 account holders',
 'No devaluations. Simple and stable.',
 'Simplest LTF card: flat 1% cashback everywhere, no categories to track, instant digital issuance. Perfect starter card.')
ON CONFLICT (id) DO NOTHING;

-- HDFC Diners Club Privilege (mid-tier)
INSERT INTO cards (id, name, issuer, annual_fee_usd, program_id, display_order, geography, currency, earning_rates, top_perks, community_sentiment, ideal_for, recent_changes, expert_summary) VALUES
('aaaa0001-0000-0000-0000-000000000525', 'HDFC Diners Club Privilege', 'HDFC Bank', 30,
 (SELECT id FROM programs WHERE slug = 'hdfc-smartbuy' LIMIT 1), 120, 'IN', 'INR',
 '1.33% (2 RP/₹150); up to 6.67% via SmartBuy; 10X on select partners',
 '12 lounge visits/year (domestic + intl combined); 2% forex; BOGO movies; milestone bonuses',
 'CardExpert: solid mid-tier HDFC. TechnoFino: good for ₹3-8L spenders. Diners acceptance a concern.',
 'Mid-premium spenders (₹3-8L/year) wanting SmartBuy access and movie perks',
 '2025: SmartBuy caps apply. Lounge visits stable at 12/year.',
 'Best mid-tier HDFC card: SmartBuy access (up to 6.67%), BOGO movies, 12 lounges at low ₹2500 fee.')
ON CONFLICT (id) DO NOTHING;

-- Amex Platinum Travel (India)
INSERT INTO cards (id, name, issuer, annual_fee_usd, program_id, display_order, geography, currency, earning_rates, top_perks, community_sentiment, ideal_for, recent_changes, expert_summary) VALUES
('aaaa0001-0000-0000-0000-000000000526', 'Amex Platinum Travel (India)', 'American Express', 42,
 (SELECT id FROM programs WHERE slug = 'amex-mr-india' LIMIT 1), 114, 'IN', 'INR',
 '1 MR/₹50 (2% base); up to 10% milestone bonus on ₹4L spend; 5% via Reward Multiplier',
 'Taj voucher ₹10K on ₹4L spend; complimentary domestic/intl lounges; 3% cashback on fuel (pre-2025)',
 'TechnoFino: best travel value card in mid-range. Reddit: loves Taj voucher + milestone MR. Hates 2025 milestone slash.',
 'Travel lovers spending ₹4L+/year who value Taj vouchers and milestone bonuses',
 'Jun 2025: No MR on fuel. Milestone thresholds increased (₹4L → ₹7L for top tier). Significant devaluation.',
 'Was India best mid-range travel card but 2025 milestone devaluation hurt badly. Still decent at ₹3500 fee for Taj voucher + lounge access.')
ON CONFLICT (id) DO NOTHING;

-- Scapia Credit Card
INSERT INTO cards (id, name, issuer, annual_fee_usd, program_id, display_order, geography, currency, earning_rates, top_perks, community_sentiment, ideal_for, recent_changes, expert_summary) VALUES
('aaaa0001-0000-0000-0000-000000000527', 'Scapia Credit Card', 'Scapia (Federal Bank)', 0,
 NULL, 134, 'IN', 'INR',
 '4% cashback on Scapia app travel bookings; 1% on other spends; 1% forex markup',
 'Lifetime free; 4% on flights/hotels via Scapia app; 1% forex; no spend conditions for features',
 'Reddit r/CreditCardsIndia: best LTF travel card. Loves 4% on travel + 1% forex. Hates: lounge threshold doubled to ₹20K/mo in 2026.',
 'Budget travelers booking via Scapia app; international travelers wanting low 1% forex',
 '2026: Lounge access threshold doubled to ₹20K/month spend (was ₹10K). SBI Cashback-style devaluation concerns.',
 'Best LTF travel card: 4% on Scapia bookings + 1% forex. Recent lounge threshold increase is a warning sign.')
ON CONFLICT (id) DO NOTHING;
