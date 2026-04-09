-- Original US cards from migration 003 that may have empty rich data
UPDATE cards SET
  earning_rates = '2X United + dining; 1X else',
  top_perks = 'Free first checked bag; 2 United Club passes/year; priority boarding',
  expert_summary = 'Solid co-brand for United flyers. Free bags save $70/RT. Best for loyal United passengers flying 4+ times/year.',
  ideal_for = 'Frequent United flyers wanting free bags and priority boarding'
WHERE name = 'United Explorer' AND expert_summary IS NULL;

UPDATE cards SET
  earning_rates = '2X Delta purchases; 2X restaurants/supermarkets; 1X else',
  top_perks = 'Free first checked bag (you + 8 companions); $200 Delta credit after $10K spend; priority boarding',
  expert_summary = 'Best entry Delta card. Free bags for up to 9 people is incredible value for families. $150/yr easily offset by bag savings.',
  ideal_for = 'Occasional Delta flyers who check bags; families traveling together'
WHERE name = 'Delta Gold Amex' AND expert_summary IS NULL;

UPDATE cards SET
  earning_rates = '9X Hyatt; 2X dining/airlines/transit/gyms; 1X else',
  top_perks = 'Annual Cat 1-4 free night; 2nd free night after $15K spend; Discoverist status + 5 elite nights/year',
  expert_summary = 'The annual Cat 1-4 free night alone is worth $200-300+, easily offsetting the $95 fee. Best hotel card in the game per r/churning.',
  ideal_for = 'Hyatt loyalists; travelers who value free night certificates at high-value properties'
WHERE name = 'World of Hyatt' AND expert_summary IS NULL;

UPDATE cards SET
  earning_rates = '6X Marriott; 3X gas/grocery/dining ($6K cap); 2X else',
  top_perks = 'Annual 35K free night certificate; 15 elite night credits; Silver Elite status',
  expert_summary = 'Best entry Marriott card. Annual 35K free night + 15 elite nights toward status. Good for occasional Marriott stays.',
  ideal_for = 'Marriott stayers wanting free nights and status credits at low fee'
WHERE name = 'Marriott Bonvoy Boundless' AND expert_summary IS NULL;

-- India cards from migration 007
UPDATE cards SET
  earning_rates = '4 RP/₹150 (2.67%); 10X on SmartBuy (13.3%); milestone bonuses ₹1L/₹3L/₹5L',
  top_perks = '6 domestic + 6 intl lounges/yr; ₹500/qtr BookMyShow; 2% forex; travel insurance',
  expert_summary = 'Best mid-premium HDFC card: SmartBuy access (13.3%), solid lounges, BookMyShow. The go-to for ₹5-10L annual spenders.',
  ideal_for = 'Mid-premium spenders ₹5-10L/yr wanting SmartBuy access without Infinia threshold'
WHERE name = 'HDFC Regalia Gold' AND expert_summary IS NULL;

UPDATE cards SET
  earning_rates = '2 EDGE RP/₹200 base; 2X on Ace Deals partners; 10% cashback on select brands',
  top_perks = 'Lifetime free; 4 domestic lounge/year; 1% fuel surcharge waiver; Ace Deals partner offers',
  expert_summary = 'Best Axis entry card: LTF with Ace Deals cashback, domestic lounges, and decent base rewards.',
  ideal_for = 'Entry-level Axis card users; online shoppers using Ace Deals partners'
WHERE name = 'Axis Ace' AND expert_summary IS NULL;

UPDATE cards SET
  earning_rates = '1 MR/₹50 (2% base); 5X via Reward Multiplier; 1000 bonus MR on 6x₹1K txns/month',
  top_perks = 'No pre-set spending limit; Gold Collection voucher redemptions (Taj/Amazon); 20% off select dining',
  expert_summary = 'Strong entry Amex India card with up to 13% via multipliers/milestones. Requires discipline for 6 monthly transactions.',
  ideal_for = 'Users with ₹6L+ income seeking high limits and Taj/Marriott voucher redemptions'
WHERE name = 'Amex Gold (India)' AND expert_summary IS NULL;

UPDATE cards SET
  earning_rates = '1 MR/₹40 intl (3.75%); 1 MR/₹40 domestic (2.5%); 20X on select luxury brands',
  top_perks = 'Unlimited lounges (Centurion + Priority Pass); Marriott/Hilton Gold status; Taj Epicure; FHR benefits; 24/7 Concierge',
  expert_summary = 'India''s luxury lifestyle card. Unmatched hotel elite statuses and lounge access. ₹66K+GST fee requires heavy travel to justify.',
  ideal_for = 'Luxury travelers (5-10 hotel nights/yr); HNIs valuing elite status over pure points value'
WHERE name = 'Amex Platinum (India)' AND expert_summary IS NULL;

UPDATE cards SET
  earning_rates = '4 Air India miles per ₹100 (4%); 10X on Air India bookings',
  top_perks = '4 intl + 8 domestic lounge visits/yr; 5000 welcome miles; 2% forex; complimentary travel insurance',
  expert_summary = 'Best co-brand for Air India loyalists. 4% mile earn rate is strong. Maharaja Club miles gained value with Apr 2026 chart improvements.',
  ideal_for = 'Air India frequent flyers; Star Alliance travelers based in India'
WHERE name = 'Air India SBI Signature' AND expert_summary IS NULL;

UPDATE cards SET
  earning_rates = '10X on partner sites (Amazon, BookMyShow, etc.); 5X on other online; 1X offline; 1 pt = ₹0.25',
  top_perks = 'Low fee ₹499; 10X on Amazon/Cleartrip/BookMyShow/Lenskart; e-voucher redemptions',
  expert_summary = 'Best SBI entry card for online shoppers. 10X on Amazon via partner sites makes it decent for e-commerce despite low base rate.',
  ideal_for = 'Online shoppers buying frequently on partner sites (Amazon, Cleartrip)'
WHERE name = 'SBI SimplyCLICK' AND expert_summary IS NULL;

UPDATE cards SET
  earning_rates = '4X Flipkart; 4X Myntra/Cleartrip/Uber/PVR; 2X other online; 1X offline',
  top_perks = 'LTF with spend waiver; 4X on Flipkart (best card for Flipkart); cashback-style RP; no forex',
  expert_summary = 'India''s best card for Flipkart shoppers: 4X rewards (effectively 2% on Flipkart). LTF makes it a no-brainer if you shop Flipkart regularly.',
  ideal_for = 'Flipkart shoppers; Myntra/Cleartrip/Uber users'
WHERE name LIKE '%Flipkart Axis%' AND expert_summary IS NULL;

UPDATE cards SET
  earning_rates = '5 RP/₹150 (3.3%); up to 10% SmartBuy; 2X online shopping',
  top_perks = '₹1000 fee (waived ₹1L); 6 domestic + 3 intl lounges; 2.5% forex; milestone bonuses',
  expert_summary = 'Solid mid-tier HDFC card for ₹3-5L spenders wanting SmartBuy access. Good lounges at low fee.',
  ideal_for = 'Mid-spenders ₹3-5L/yr wanting HDFC SmartBuy and lounge access at lowest cost'
WHERE name = 'HDFC Regalia First' AND expert_summary IS NULL;
