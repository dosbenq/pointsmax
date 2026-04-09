-- 059: Add real card image URLs and insert more popular cards
-- Card images from official issuer CDNs; 7 new cards across US and India

BEGIN;

-- ============================================================
-- US Card Images (from issuer CDNs)
-- ============================================================
UPDATE cards SET image_url = 'https://creditcards.chase.com/K-Marketplace/images/cardart/sapphire_preferred_702.png' WHERE name = 'Chase Sapphire Preferred' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://creditcards.chase.com/K-Marketplace/images/cardart/sapphire_reserve_702.png' WHERE name = 'Chase Sapphire Reserve' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://icm.aexp-static.com/acquisition/card-art/NUS000000174_480x304_straight_withname.png' WHERE name = 'Amex Gold' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://icm.aexp-static.com/acquisition/card-art/NUS000000256_480x304_straight_withname.png' WHERE name = 'Amex Platinum' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://ecm.capitalone.com/WCM/card/products/og/venture-x.png' WHERE name = 'Capital One Venture X' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://ecm.capitalone.com/WCM/card/products/og/savor.png' WHERE name LIKE '%Capital One Savor%' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://icm.aexp-static.com/acquisition/card-art/NUS000000327_480x304_straight_withname.png' WHERE name LIKE '%Hilton Honors%Surpass%' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://creditcards.chase.com/K-Marketplace/images/cardart/freedom_unlimited_702.png' WHERE name = 'Chase Freedom Unlimited' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://creditcards.chase.com/K-Marketplace/images/cardart/freedom_flex_702.png' WHERE name = 'Chase Freedom Flex' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://creditcards.chase.com/K-Marketplace/images/cardart/ink_702.png' WHERE name = 'Chase Ink Business Preferred' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://icm.aexp-static.com/acquisition/card-art/NUS000000174_480x304_straight_withname.png' WHERE name LIKE '%Amex Gold%Resy%' AND image_url IS NULL;

-- ============================================================
-- India Card Images
-- ============================================================
UPDATE cards SET image_url = 'https://www.axisbank.com/images/default-source/atlas/webp/card-front-lg.webp' WHERE name = 'Axis Atlas' AND image_url IS NULL;
UPDATE cards SET image_url = 'https://www.axisbank.com/images/default-source/magnus/webp/card-front-lg.webp' WHERE name = 'Axis Magnus' AND image_url IS NULL;

-- ============================================================
-- Insert more popular US and India cards
-- ============================================================
INSERT INTO cards (id, name, issuer, annual_fee_usd, signup_bonus_pts, signup_bonus_spend, program_id, display_order, geography, image_url, earning_rates, top_perks, community_sentiment, ideal_for, expert_summary) VALUES
-- Amex Blue Business Plus
('aaaa0001-0000-0000-0000-000000000410', 'Amex Blue Business Plus', 'American Express', 0, 15000, 3000,
 (SELECT id FROM programs WHERE slug = 'amex-mr' LIMIT 1), 35, 'US',
 'https://icm.aexp-static.com/acquisition/card-art/NUS000000152_480x304_straight_withname.png',
 '2X on all purchases up to $50,000/year; 1X after',
 'No annual fee; 0% intro APR 12 months; Expanded Buying Power; Purchase Protection',
 'r/churning: "best no-fee business card." Uncapped 2X MR on $50K. Essential Amex ecosystem filler.',
 'Small biz owners/freelancers spending <$50K/year wanting no-fee 2X MR',
 'No-fee 2X MR on everything up to $50K. Essential Amex trifecta card for non-bonus spend.'),

-- Marriott Bonvoy Brilliant
('aaaa0001-0000-0000-0000-000000000411', 'Marriott Bonvoy Brilliant', 'American Express', 650, 200000, 6000,
 (SELECT id FROM programs WHERE slug = 'marriott' LIMIT 1), 47, 'US',
 'https://icm.aexp-static.com/acquisition/card-art/NUS000000305_480x304_straight_withname.png',
 '6X Marriott; 3X flights/dining; 2X else',
 '$300 dining credit; 85K free night certificate; Platinum Elite status; Priority Pass',
 'r/churning: best Marriott card for status chasers. 200K SUB is massive. $300 dining credit offsets fee.',
 'Frequent Marriott stayers wanting Platinum Elite and the 85K free night',
 'Top Marriott card: 200K SUB, Platinum Elite, 85K annual free night, $300 dining credit. $650 fee justified for Marriott loyalists.'),

-- IHG One Rewards Premier
('aaaa0001-0000-0000-0000-000000000412', 'IHG One Rewards Premier', 'Chase', 99, 140000, 3000,
 (SELECT id FROM programs WHERE slug = 'ihg' LIMIT 1), 48, 'US',
 NULL,
 '26X IHG; 5X travel/dining/gas; 3X else',
 '140K SUB; annual free night (40K cap); Platinum Elite; 4th night free on awards; Global Entry',
 'r/churning: best hotel SUB at 140K. 4th night free saves 25% on hotel stays.',
 'IHG loyalists staying 5+ nights/year',
 'Massive 140K SUB, Platinum Elite, 4th night free. Best hotel card for IHG loyalists at just $99/yr.'),

-- Southwest Rapid Rewards Priority
('aaaa0001-0000-0000-0000-000000000413', 'Southwest Rapid Rewards Priority', 'Chase', 149, 65000, 3000,
 (SELECT id FROM programs WHERE slug = 'southwest' LIMIT 1), 44, 'US',
 NULL,
 '3X Southwest; 2X Rapid Rewards hotel/car; 1X else',
 '$75 annual SW credit; 7,500 anniversary points; 4 upgraded boardings/year; WiFi credits',
 'r/churning: get for Companion Pass play. SW points = 1.25¢. Annual credit + points offset fee.',
 'Southwest frequent flyers; Companion Pass seekers',
 'Best Southwest card: $75 credit + 7,500 anniversary points + upgraded boarding. Key for Companion Pass.'),

-- US Bank Altitude Reserve
('aaaa0001-0000-0000-0000-000000000414', 'US Bank Altitude Reserve', 'US Bank', 400, 60000, 4500,
 NULL, 40, 'US',
 NULL,
 '5X prepaid hotels/car via portal; 3X travel/mobile wallet; 1X else; 1.5X redemption via portal',
 '$325 annual travel credit; Priority Pass; Global Entry; mobile wallet 3X everywhere',
 'r/creditcards: "hidden gem." 3X on mobile wallet payments = 3X everywhere. $325 credit makes effective fee $75.',
 'Mobile wallet users (Apple/Google Pay) wanting 3X on everything',
 'The hidden premium card: 3X on ALL mobile wallet payments + $325 credit. Effective $75/yr fee.'),

-- ICICI Coral
('aaaa0001-0000-0000-0000-000000000415', 'ICICI Coral', 'ICICI Bank', 6, 0, 0,
 (SELECT id FROM programs WHERE slug = 'icici-rewards' LIMIT 1), 125, 'IN',
 NULL,
 '2 RP/₹100 (2%); Buy 1 Get 1 on BookMyShow (₹200 cap)',
 'Low fee (₹500); BOGO movies; 2 domestic lounges/quarter; 2% forex',
 'Reddit r/CreditCardsIndia: best entry ICICI card. Loves BOGO movies. Hates low lounge limits.',
 'Movie lovers wanting BOGO; entry-level ICICI card holders',
 'Best entry ICICI card: BOGO movies on BookMyShow + 2% rewards at low ₹500 fee.'),

-- SBI BPCL Octane
('aaaa0001-0000-0000-0000-000000000416', 'SBI BPCL Octane', 'SBI Card', 18, 0, 0,
 (SELECT id FROM programs WHERE slug = 'sbi-rewards' LIMIT 1), 126, 'IN',
 NULL,
 '25X on BPCL fuel (25%!); 10X dining/groceries/movies; 1X else',
 'Best fuel card in India; low forex; 6 domestic + 2 intl lounges',
 'CardExpert: India #1 fuel card. 25% back on BPCL is insane. Reddit: "must have if you drive."',
 'Car owners fueling at BPCL stations regularly',
 'India''s best fuel card: 25% back on BPCL fuel, 10X on dining/groceries. Must-have for drivers.')

ON CONFLICT (id) DO NOTHING;

COMMIT;
