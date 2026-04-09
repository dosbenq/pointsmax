-- Add rich data columns to programs
ALTER TABLE programs ADD COLUMN IF NOT EXISTS best_redemption TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS worst_redemption TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS transfer_partners TEXT;

-- Add new programs that don't exist
INSERT INTO programs (id, name, short_name, slug, type, issuer, color_hex, geography, display_order) VALUES
('22222222-0002-0002-0002-000000000020', 'IHG One Rewards', 'IHG', 'ihg', 'hotel_points', 'IHG', '#6a994e', 'GLOBAL', 300),
('22222222-0002-0002-0002-000000000021', 'Wyndham Rewards', 'Wyndham', 'wyndham', 'hotel_points', 'Wyndham', '#003B5C', 'GLOBAL', 310),
('22222222-0002-0002-0002-000000000022', 'Accor Live Limitless', 'Accor', 'accor', 'hotel_points', 'Accor', '#1B1464', 'GLOBAL', 320),
('22222222-0002-0002-0002-000000000023', 'JetBlue TrueBlue', 'JetBlue', 'jetblue', 'airline_miles', 'JetBlue', '#0042A8', 'US', 240),
('22222222-0002-0002-0002-000000000024', 'Emirates Skywards', 'Emirates', 'emirates', 'airline_miles', 'Emirates', '#D71921', 'GLOBAL', 250),
('22222222-0002-0002-0002-000000000025', 'Air Canada Aeroplan', 'Aeroplan', 'aeroplan', 'airline_miles', 'Air Canada', '#F01428', 'GLOBAL', 215),
('22222222-0002-0002-0002-000000000026', 'ANA Mileage Club', 'ANA', 'ana', 'airline_miles', 'ANA', '#00285F', 'GLOBAL', 216),
('22222222-0002-0002-0002-000000000050', 'HDFC SmartBuy', 'HDFC SB', 'hdfc-smartbuy', 'transferable_points', 'HDFC Bank', '#004B87', 'IN', 105),
('22222222-0002-0002-0002-000000000051', 'Axis EDGE Rewards', 'Axis EDGE', 'axis-edge', 'transferable_points', 'Axis Bank', '#97144D', 'IN', 110),
('22222222-0002-0002-0002-000000000052', 'ICICI Reward Points', 'ICICI RP', 'icici-rewards', 'transferable_points', 'ICICI Bank', '#F58220', 'IN', 115),
('22222222-0002-0002-0002-000000000053', 'SBI Reward Points', 'SBI RP', 'sbi-rewards', 'transferable_points', 'SBI Card', '#22409A', 'IN', 120),
('22222222-0002-0002-0002-000000000054', 'Tata Neu Coins', 'Tata Neu', 'tata-neu', 'cashback', 'Tata Digital', '#5C2D91', 'IN', 125),
('22222222-0002-0002-0002-000000000055', 'Air India Maharaja Club', 'Air India', 'air-india', 'airline_miles', 'Air India', '#ED1C24', 'IN', 200),
('22222222-0002-0002-0002-000000000056', 'InterMiles', 'InterMiles', 'intermiles', 'airline_miles', 'InterMiles', '#1A237E', 'IN', 210)
ON CONFLICT (slug) DO NOTHING;

-- Update US valuations to TPG April 2026
UPDATE valuations SET cpp_cents = 2.05, notes = 'TPG Apr 2026. Best via Hyatt transfers. Points Boost changed portal to 1cpp.', source_url = 'https://thepointsguy.com/loyalty-programs/monthly-valuations/' WHERE program_id = (SELECT id FROM programs WHERE slug = 'chase-ur' LIMIT 1);
UPDATE valuations SET cpp_cents = 2.00, notes = 'TPG Apr 2026. Best via Avianca/ANA transfers. Cathay ratio worsened Mar 2026.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'amex-mr' LIMIT 1);
UPDATE valuations SET cpp_cents = 1.85, notes = 'TPG Apr 2026. Best via Turkish transfers.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'capital-one' LIMIT 1);
UPDATE valuations SET cpp_cents = 1.90, notes = 'TPG Apr 2026. Best via airline transfers.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'citi-thankyou' LIMIT 1);
UPDATE valuations SET cpp_cents = 2.20, notes = 'TPG Apr 2026. Highest-valued transferable currency.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'bilt' LIMIT 1);
UPDATE valuations SET cpp_cents = 1.35, notes = 'TPG Apr 2026. DOWN from 1.5. Dynamic pricing.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'united' LIMIT 1);
UPDATE valuations SET cpp_cents = 1.20, notes = 'TPG Apr 2026. DOWN from 1.25.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'delta' LIMIT 1);
UPDATE valuations SET cpp_cents = 1.60, notes = 'TPG Apr 2026. DOWN from 1.7.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'american' LIMIT 1);
UPDATE valuations SET cpp_cents = 1.25, notes = 'TPG Apr 2026. DOWN from 1.3.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'southwest' LIMIT 1);
UPDATE valuations SET cpp_cents = 1.70, notes = 'TPG Apr 2026. New Gondola methodology. 5-tier chart May 2026.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'hyatt' LIMIT 1);
UPDATE valuations SET cpp_cents = 0.75, notes = 'TPG Apr 2026. UP from 0.70.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'marriott' LIMIT 1);
UPDATE valuations SET cpp_cents = 0.40, notes = 'TPG Apr 2026. DOWN from 0.5. Multiple devaluations.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'hilton' LIMIT 1);
UPDATE valuations SET cpp_cents = 1.40, notes = 'TPG Apr 2026. DOWN from 1.5. Rebranded Atmos.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'alaska' LIMIT 1);
UPDATE valuations SET cpp_cents = 1.40, notes = 'TPG Apr 2026. Dec 2025 deval: 8-14% more Avios needed.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'avios' LIMIT 1);
UPDATE valuations SET cpp_cents = 1.10, notes = 'TPG Apr 2026.' WHERE program_id = (SELECT id FROM programs WHERE slug = 'turkish' LIMIT 1);

-- Insert valuations for new programs
INSERT INTO valuations (program_id, cpp_cents, source, source_url, notes)
SELECT id, 0.60, 'tpg', 'https://thepointsguy.com/loyalty-programs/monthly-valuations/', 'TPG Apr 2026. UP from 0.5' FROM programs WHERE slug = 'ihg'
ON CONFLICT DO NOTHING;
INSERT INTO valuations (program_id, cpp_cents, source, source_url, notes)
SELECT id, 0.65, 'tpg', 'https://thepointsguy.com/loyalty-programs/monthly-valuations/', 'TPG Apr 2026. DOWN from 1.1' FROM programs WHERE slug = 'wyndham'
ON CONFLICT DO NOTHING;
INSERT INTO valuations (program_id, cpp_cents, source, source_url, notes)
SELECT id, 1.35, 'tpg', 'https://thepointsguy.com/loyalty-programs/monthly-valuations/', 'TPG Apr 2026' FROM programs WHERE slug = 'jetblue'
ON CONFLICT DO NOTHING;
INSERT INTO valuations (program_id, cpp_cents, source, source_url, notes)
SELECT id, 1.40, 'tpg', 'https://thepointsguy.com/loyalty-programs/monthly-valuations/', 'TPG Apr 2026' FROM programs WHERE slug = 'aeroplan'
ON CONFLICT DO NOTHING;

-- India program valuations
INSERT INTO valuations (program_id, cpp_cents, source, source_url, notes)
SELECT id, 1.20, 'cardexpert', 'https://cardexpert.in', '₹1/pt via SmartBuy. Feb 2026: Infinia caps tightened.' FROM programs WHERE slug = 'hdfc-smartbuy'
ON CONFLICT DO NOTHING;
INSERT INTO valuations (program_id, cpp_cents, source, source_url, notes)
SELECT id, 0.60, 'cardexpert', 'https://cardexpert.in', '₹0.25-0.50/pt. Best via Travel EDGE.' FROM programs WHERE slug = 'axis-edge'
ON CONFLICT DO NOTHING;
INSERT INTO valuations (program_id, cpp_cents, source, source_url, notes)
SELECT id, 0.80, 'cardexpert', 'https://cardexpert.in', '₹0.60-1.00/pt. Best via iShop.' FROM programs WHERE slug = 'icici-rewards'
ON CONFLICT DO NOTHING;
INSERT INTO valuations (program_id, cpp_cents, source, source_url, notes)
SELECT id, 0.30, 'cardexpert', 'https://cardexpert.in', '₹0.25/pt.' FROM programs WHERE slug = 'sbi-rewards'
ON CONFLICT DO NOTHING;
INSERT INTO valuations (program_id, cpp_cents, source, source_url, notes)
SELECT id, 0.80, 'technofino', 'https://technofino.in', '₹0.67/mile. Apr 2026: reduced for 90% routes.' FROM programs WHERE slug = 'air-india'
ON CONFLICT DO NOTHING;
