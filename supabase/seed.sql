-- ============================================================
-- PointsMax — Seed Data
-- Run AFTER 001_initial_schema.sql
-- Sources: TPG (Jan 2025), NerdWallet valuations
-- ============================================================

-- ─────────────────────────────────────────────
-- PROGRAMS
-- ─────────────────────────────────────────────

INSERT INTO programs (id, name, short_name, slug, type, issuer, color_hex, display_order) VALUES

-- ── TRANSFERABLE POINTS (shown first in UI) ──────────────────
('11111111-0001-0001-0001-000000000001', 'Chase Ultimate Rewards',      'Chase UR',      'chase-ur',       'transferable_points', 'Chase',           '#1A56C4', 10),
('11111111-0001-0001-0001-000000000002', 'Amex Membership Rewards',     'Amex MR',       'amex-mr',        'transferable_points', 'American Express','#007BC1', 20),
('11111111-0001-0001-0001-000000000003', 'Capital One Miles',           'Cap One Miles', 'capital-one',    'transferable_points', 'Capital One',     '#CC0000', 30),
('11111111-0001-0001-0001-000000000004', 'Citi ThankYou Points',        'Citi TYP',      'citi-thankyou',  'transferable_points', 'Citi',            '#00A9E0', 40),
('11111111-0001-0001-0001-000000000005', 'Bilt Rewards',                'Bilt',          'bilt',           'transferable_points', 'Bilt',            '#1C1C1C', 50),
('11111111-0001-0001-0001-000000000006', 'Wells Fargo Rewards',         'WF Rewards',    'wells-fargo',    'transferable_points', 'Wells Fargo',     '#CC0000', 60),

-- ── AIRLINE MILES ─────────────────────────────────────────────
('22222222-0002-0002-0002-000000000001', 'United MileagePlus',          'United',        'united',         'airline_miles', 'United',          '#0033A0', 100),
('22222222-0002-0002-0002-000000000002', 'Delta SkyMiles',              'Delta',         'delta',          'airline_miles', 'Delta',           '#E01933', 110),
('22222222-0002-0002-0002-000000000003', 'American AAdvantage',         'American AA',   'american',       'airline_miles', 'American',        '#B0213F', 120),
('22222222-0002-0002-0002-000000000004', 'Alaska Mileage Plan',         'Alaska',        'alaska',         'airline_miles', 'Alaska',          '#0060AF', 130),
('22222222-0002-0002-0002-000000000005', 'Southwest Rapid Rewards',     'Southwest',     'southwest',      'airline_miles', 'Southwest',       '#304CB2', 140),
('22222222-0002-0002-0002-000000000006', 'British Airways Avios',       'BA Avios',      'british-airways','airline_miles', 'British Airways', '#075AAA', 150),
('22222222-0002-0002-0002-000000000007', 'Air France/KLM Flying Blue',  'Flying Blue',   'flying-blue',    'airline_miles', 'Air France/KLM',  '#0A2FFF', 160),
('22222222-0002-0002-0002-000000000008', 'Virgin Atlantic Flying Club',  'Virgin Atl.',   'virgin-atlantic','airline_miles', 'Virgin Atlantic', '#E21021', 170),
('22222222-0002-0002-0002-000000000009', 'Singapore KrisFlyer',         'Singapore',     'singapore',      'airline_miles', 'Singapore Air',   '#1D3557', 180),
('22222222-0002-0002-0002-000000000010', 'ANA Mileage Club',            'ANA',           'ana',            'airline_miles', 'ANA',             '#003580', 190),
('22222222-0002-0002-0002-000000000011', 'Avianca LifeMiles',           'Avianca',       'avianca',        'airline_miles', 'Avianca',         '#E00000', 200),
('22222222-0002-0002-0002-000000000012', 'Turkish Airlines Miles&Smiles','Turkish',       'turkish',        'airline_miles', 'Turkish Airlines','#C70A0A', 210),
('22222222-0002-0002-0002-000000000013', 'Air Canada Aeroplan',         'Aeroplan',      'aeroplan',       'airline_miles', 'Air Canada',      '#CC0000', 220),
('22222222-0002-0002-0002-000000000014', 'Iberia Plus',                 'Iberia',        'iberia',         'airline_miles', 'Iberia',          '#C40316', 230),
('22222222-0002-0002-0002-000000000015', 'Aer Lingus AerClub',          'Aer Lingus',    'aer-lingus',     'airline_miles', 'Aer Lingus',      '#00833E', 240),
('22222222-0002-0002-0002-000000000016', 'Emirates Skywards',           'Emirates',      'emirates',       'airline_miles', 'Emirates',        '#C60C30', 250),
('22222222-0002-0002-0002-000000000017', 'Cathay Pacific Asia Miles',   'Asia Miles',    'cathay',         'airline_miles', 'Cathay Pacific',  '#006564', 260),
('22222222-0002-0002-0002-000000000018', 'Etihad Guest',                'Etihad',        'etihad',         'airline_miles', 'Etihad',          '#BD8B13', 270),
('22222222-0002-0002-0002-000000000019', 'JetBlue TrueBlue',            'JetBlue',       'jetblue',        'airline_miles', 'JetBlue',         '#003876', 280),
('22222222-0002-0002-0002-000000000020', 'Hawaiian Airlines HawaiianMiles','Hawaiian',   'hawaiian',       'airline_miles', 'Hawaiian Air',    '#7B1FA2', 290),

-- ── HOTEL POINTS ──────────────────────────────────────────────
('33333333-0003-0003-0003-000000000001', 'World of Hyatt',              'Hyatt',         'hyatt',          'hotel_points', 'Hyatt',           '#1D4D8C', 300),
('33333333-0003-0003-0003-000000000002', 'Marriott Bonvoy',             'Marriott',      'marriott',       'hotel_points', 'Marriott',        '#8B0000', 310),
('33333333-0003-0003-0003-000000000003', 'Hilton Honors',               'Hilton',        'hilton',         'hotel_points', 'Hilton',          '#003580', 320),
('33333333-0003-0003-0003-000000000004', 'IHG One Rewards',             'IHG',           'ihg',            'hotel_points', 'IHG',             '#E65C00', 330),
('33333333-0003-0003-0003-000000000005', 'Wyndham Rewards',             'Wyndham',       'wyndham',        'hotel_points', 'Wyndham',         '#006699', 340),
('33333333-0003-0003-0003-000000000006', 'Choice Privileges',           'Choice',        'choice',         'hotel_points', 'Choice Hotels',   '#CC0000', 350);

-- ─────────────────────────────────────────────
-- VALUATIONS (CPP in cents, as of Jan 2025)
-- Source: The Points Guy monthly valuations
-- ─────────────────────────────────────────────

INSERT INTO valuations (program_id, cpp_cents, source, source_url, notes) VALUES

-- Transferable points
('11111111-0001-0001-0001-000000000001', 2.05, 'tpg', 'https://thepointsguy.com/points-miles/monthly-valuations/', 'Best via Hyatt or United transfers'),
('11111111-0001-0001-0001-000000000002', 2.00, 'tpg', 'https://thepointsguy.com/points-miles/monthly-valuations/', 'Best via Air France or ANA transfers'),
('11111111-0001-0001-0001-000000000003', 1.85, 'tpg', 'https://thepointsguy.com/points-miles/monthly-valuations/', 'Best via Turkish or Avianca transfers'),
('11111111-0001-0001-0001-000000000004', 1.80, 'tpg', 'https://thepointsguy.com/points-miles/monthly-valuations/', 'Best via Turkish or Singapore transfers'),
('11111111-0001-0001-0001-000000000005', 2.05, 'tpg', 'https://thepointsguy.com/points-miles/monthly-valuations/', 'Best via Hyatt or Alaska transfers'),
('11111111-0001-0001-0001-000000000006', 1.82, 'tpg', 'https://thepointsguy.com/points-miles/monthly-valuations/', 'Best via transfer partners'),

-- Airline miles
('22222222-0002-0002-0002-000000000001', 1.35, 'tpg', null, 'Good for Star Alliance partner awards'),
('22222222-0002-0002-0002-000000000002', 1.20, 'tpg', null, 'Dynamic pricing limits value; best for last-minute deals'),
('22222222-0002-0002-0002-000000000003', 1.77, 'tpg', null, 'Good for partner awards and domestic first class'),
('22222222-0002-0002-0002-000000000004', 1.35, 'tpg', null, 'Excellent for Alaska and partners, great J pricing'),
('22222222-0002-0002-0002-000000000005', 1.50, 'tpg', null, 'Best for companion pass strategy'),
('22222222-0002-0002-0002-000000000006', 1.50, 'tpg', null, 'Excellent for short-haul and partner J awards'),
('22222222-0002-0002-0002-000000000007', 1.35, 'tpg', null, 'Good for last-minute promo awards'),
('22222222-0002-0002-0002-000000000008', 1.50, 'tpg', null, 'Best for Delta One and ANA awards'),
('22222222-0002-0002-0002-000000000009', 1.30, 'tpg', null, 'Best for Star Alliance partner awards'),
('22222222-0002-0002-0002-000000000010', 1.60, 'tpg', null, 'Best for ANA First Class — aspirational'),
('22222222-0002-0002-0002-000000000011', 1.70, 'tpg', null, 'Excellent Star Alliance partner pricing'),
('22222222-0002-0002-0002-000000000012', 1.50, 'tpg', null, 'Best for Star Alliance J/F awards'),
('22222222-0002-0002-0002-000000000013', 1.50, 'tpg', null, 'Excellent for partner awards, no fuel surcharges'),
('22222222-0002-0002-0002-000000000014', 1.50, 'tpg', null, 'Best for Iberia/British Airways routes'),
('22222222-0002-0002-0002-000000000015', 1.50, 'tpg', null, 'Good for Iberia and transatlantic'),
('22222222-0002-0002-0002-000000000016', 1.30, 'tpg', null, 'Good for first class on Emirates metal'),
('22222222-0002-0002-0002-000000000017', 1.40, 'tpg', null, 'Good for oneworld partner awards'),
('22222222-0002-0002-0002-000000000018', 1.35, 'tpg', null, 'Etihad First Apartment aspirational value'),
('22222222-0002-0002-0002-000000000019', 1.50, 'tpg', null, 'Best for Mint and partner awards'),
('22222222-0002-0002-0002-000000000020', 1.00, 'tpg', null, 'Limited partner options'),

-- Hotel points
('33333333-0003-0003-0003-000000000001', 1.70, 'tpg', null, 'Best hotel currency; excellent resort value'),
('33333333-0003-0003-0003-000000000002', 0.84, 'tpg', null, 'Poor value unless using PointSavers or airline transfer'),
('33333333-0003-0003-0003-000000000003', 0.60, 'tpg', null, 'Better to use for aspirational resorts only'),
('33333333-0003-0003-0003-000000000004', 0.70, 'tpg', null, 'Best for IHG luxury properties'),
('33333333-0003-0003-0003-000000000005', 0.90, 'tpg', null, 'Best at all-inclusive resorts'),
('33333333-0003-0003-0003-000000000006', 0.70, 'tpg', null, 'Limited partner options');

-- ─────────────────────────────────────────────
-- TRANSFER PARTNERS
-- Format: (from, to, ratio_from, ratio_to, min, increment, time_min_hrs, time_max_hrs, is_instant)
-- ─────────────────────────────────────────────

-- ── CHASE ULTIMATE REWARDS → ──────────────────────────────────
INSERT INTO transfer_partners (from_program_id, to_program_id, ratio_from, ratio_to, min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs, is_instant) VALUES
-- Airlines
('11111111-0001-0001-0001-000000000001', '22222222-0002-0002-0002-000000000001', 1, 1, 1000, 1000,  0,  1,  true),  -- United
('11111111-0001-0001-0001-000000000001', '22222222-0002-0002-0002-000000000005', 1, 1, 1000, 1000,  0,  1,  true),  -- Southwest
('11111111-0001-0001-0001-000000000001', '22222222-0002-0002-0002-000000000006', 1, 1, 1000, 1000,  0,  2,  true),  -- BA Avios
('11111111-0001-0001-0001-000000000001', '22222222-0002-0002-0002-000000000007', 1, 1, 1000, 1000,  0,  1,  true),  -- Flying Blue
('11111111-0001-0001-0001-000000000001', '22222222-0002-0002-0002-000000000008', 1, 1, 1000, 1000,  0,  2,  true),  -- Virgin Atlantic
('11111111-0001-0001-0001-000000000001', '22222222-0002-0002-0002-000000000009', 1, 1, 1000, 1000, 24, 48,  false), -- Singapore
('11111111-0001-0001-0001-000000000001', '22222222-0002-0002-0002-000000000013', 1, 1, 1000, 1000,  0,  2,  true),  -- Aeroplan
('11111111-0001-0001-0001-000000000001', '22222222-0002-0002-0002-000000000014', 1, 1, 1000, 1000,  0,  2,  true),  -- Iberia
('11111111-0001-0001-0001-000000000001', '22222222-0002-0002-0002-000000000015', 1, 1, 1000, 1000,  0,  2,  true),  -- Aer Lingus
('11111111-0001-0001-0001-000000000001', '22222222-0002-0002-0002-000000000016', 1, 1, 1000, 1000,  0,  2,  true),  -- Emirates
-- Hotels
('11111111-0001-0001-0001-000000000001', '33333333-0003-0003-0003-000000000001', 1, 1, 1000, 1000,  0,  1,  true),  -- Hyatt
('11111111-0001-0001-0001-000000000001', '33333333-0003-0003-0003-000000000004', 1, 1, 1000, 1000,  0, 24,  false); -- IHG

-- ── AMEX MEMBERSHIP REWARDS → ─────────────────────────────────
INSERT INTO transfer_partners (from_program_id, to_program_id, ratio_from, ratio_to, min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs, is_instant) VALUES
-- Airlines
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000002',  1,  1, 1000, 1000,  0,  2,  true),  -- Delta
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000006',  1,  1, 1000, 1000,  0,  2,  true),  -- BA Avios
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000007',  1,  1, 1000, 1000,  0,  2,  true),  -- Flying Blue
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000008',  1,  1, 1000, 1000,  0,  2,  true),  -- Virgin Atlantic
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000009',  1,  1, 1000, 1000, 24, 48,  false), -- Singapore
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000010',  1,  1, 1000, 1000, 24, 48,  false), -- ANA
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000011',  1,  1, 1000, 1000,  0,  2,  true),  -- Avianca
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000012',  1,  1, 1000, 1000,  0,  2,  true),  -- Turkish
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000013',  1,  1, 1000, 1000,  0,  2,  true),  -- Aeroplan
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000014',  1,  1, 1000, 1000,  0,  2,  true),  -- Iberia
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000015',  1,  1, 1000, 1000,  0,  2,  true),  -- Aer Lingus
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000016',  1,  1, 1000, 1000,  0,  2,  true),  -- Emirates
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000017',  1,  1, 1000, 1000,  0,  2,  true),  -- Cathay
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000018',  1,  1, 1000, 1000,  0,  2,  true),  -- Etihad
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000019',  250,200,1000, 250,   0,  2,  true),  -- JetBlue (250:200)
('11111111-0001-0001-0001-000000000002', '22222222-0002-0002-0002-000000000020',  1,  1, 1000, 1000,  0,  2,  true),  -- Hawaiian
-- Hotels
('11111111-0001-0001-0001-000000000002', '33333333-0003-0003-0003-000000000002',  1,  1, 1000, 1000,  0, 24,  false), -- Marriott
('11111111-0001-0001-0001-000000000002', '33333333-0003-0003-0003-000000000003',  1,  2, 1000, 1000,  0,  2,  true),  -- Hilton (1:2 bonus)
('11111111-0001-0001-0001-000000000002', '33333333-0003-0003-0003-000000000006',  1,  1, 1000, 1000,  0,  2,  true);  -- Choice

-- ── CAPITAL ONE → ─────────────────────────────────────────────
INSERT INTO transfer_partners (from_program_id, to_program_id, ratio_from, ratio_to, min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs, is_instant) VALUES
('11111111-0001-0001-0001-000000000003', '22222222-0002-0002-0002-000000000013', 1, 1, 1000, 1000,  0,  2,  true),  -- Aeroplan
('11111111-0001-0001-0001-000000000003', '22222222-0002-0002-0002-000000000012', 1, 1, 1000, 1000,  0,  2,  true),  -- Turkish
('11111111-0001-0001-0001-000000000003', '22222222-0002-0002-0002-000000000006', 1, 1, 1000, 1000,  0,  2,  true),  -- BA Avios
('11111111-0001-0001-0001-000000000003', '22222222-0002-0002-0002-000000000007', 1, 1, 1000, 1000,  0,  2,  true),  -- Flying Blue
('11111111-0001-0001-0001-000000000003', '22222222-0002-0002-0002-000000000009', 1, 1, 1000, 1000, 24, 48,  false), -- Singapore
('11111111-0001-0001-0001-000000000003', '22222222-0002-0002-0002-000000000011', 1, 1, 1000, 1000,  0,  2,  true),  -- Avianca
('11111111-0001-0001-0001-000000000003', '22222222-0002-0002-0002-000000000016', 1, 1, 1000, 1000,  0,  2,  true),  -- Emirates
('11111111-0001-0001-0001-000000000003', '22222222-0002-0002-0002-000000000014', 1, 1, 1000, 1000,  0,  2,  true),  -- Iberia
-- Hotels
('11111111-0001-0001-0001-000000000003', '33333333-0003-0003-0003-000000000005', 1, 1, 1000, 1000,  0,  2,  true);  -- Wyndham

-- ── CITI THANKYOU → ───────────────────────────────────────────
INSERT INTO transfer_partners (from_program_id, to_program_id, ratio_from, ratio_to, min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs, is_instant) VALUES
('11111111-0001-0001-0001-000000000004', '22222222-0002-0002-0002-000000000012', 1, 1, 1000, 1000,  0,  2,  true),  -- Turkish
('11111111-0001-0001-0001-000000000004', '22222222-0002-0002-0002-000000000009', 1, 1, 1000, 1000, 24, 48,  false), -- Singapore
('11111111-0001-0001-0001-000000000004', '22222222-0002-0002-0002-000000000008', 1, 1, 1000, 1000,  0,  2,  true),  -- Virgin Atlantic
('11111111-0001-0001-0001-000000000004', '22222222-0002-0002-0002-000000000011', 1, 1, 1000, 1000,  0,  2,  true),  -- Avianca
('11111111-0001-0001-0001-000000000004', '22222222-0002-0002-0002-000000000007', 1, 1, 1000, 1000,  0,  2,  true),  -- Flying Blue
('11111111-0001-0001-0001-000000000004', '22222222-0002-0002-0002-000000000017', 1, 1, 1000, 1000,  0,  2,  true),  -- Cathay
('11111111-0001-0001-0001-000000000004', '22222222-0002-0002-0002-000000000016', 1, 1, 1000, 1000,  0,  2,  true),  -- Emirates
('11111111-0001-0001-0001-000000000004', '22222222-0002-0002-0002-000000000018', 1, 1, 1000, 1000,  0,  2,  true),  -- Etihad
-- Hotels
('11111111-0001-0001-0001-000000000004', '33333333-0003-0003-0003-000000000005', 1, 1, 1000, 1000,  0,  2,  true);  -- Wyndham

-- ── BILT REWARDS → ────────────────────────────────────────────
INSERT INTO transfer_partners (from_program_id, to_program_id, ratio_from, ratio_to, min_transfer, transfer_increment, transfer_time_min_hrs, transfer_time_max_hrs, is_instant) VALUES
-- Airlines
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000004', 1, 1, 1000, 1000,  0,  2,  true),  -- Alaska
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000003', 1, 1, 1000, 1000,  0, 48,  false), -- American
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000001', 1, 1, 1000, 1000,  0,  2,  true),  -- United
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000007', 1, 1, 1000, 1000,  0,  2,  true),  -- Flying Blue
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000006', 1, 1, 1000, 1000,  0,  2,  true),  -- BA Avios
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000008', 1, 1, 1000, 1000,  0,  2,  true),  -- Virgin Atlantic
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000016', 1, 1, 1000, 1000,  0,  2,  true),  -- Emirates
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000012', 1, 1, 1000, 1000,  0,  2,  true),  -- Turkish
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000009', 1, 1, 1000, 1000, 24, 48,  false), -- Singapore
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000017', 1, 1, 1000, 1000,  0,  2,  true),  -- Cathay
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000013', 1, 1, 1000, 1000,  0,  2,  true),  -- Aeroplan
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000020', 1, 1, 1000, 1000,  0,  2,  true),  -- Hawaiian
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000014', 1, 1, 1000, 1000,  0,  2,  true),  -- Iberia
('11111111-0001-0001-0001-000000000005', '22222222-0002-0002-0002-000000000015', 1, 1, 1000, 1000,  0,  2,  true),  -- Aer Lingus
-- Hotels
('11111111-0001-0001-0001-000000000005', '33333333-0003-0003-0003-000000000001', 1, 1, 1000, 1000,  0,  2,  true),  -- Hyatt
('11111111-0001-0001-0001-000000000005', '33333333-0003-0003-0003-000000000002', 1, 1, 1000, 1000,  0, 24,  false), -- Marriott
('11111111-0001-0001-0001-000000000005', '33333333-0003-0003-0003-000000000004', 1, 1, 1000, 1000,  0, 24,  false); -- IHG

-- ─────────────────────────────────────────────
-- REDEMPTION OPTIONS (direct, non-transfer redemptions)
-- ─────────────────────────────────────────────

INSERT INTO redemption_options (program_id, category, cpp_cents, label, notes) VALUES

-- Chase UR direct redemptions
('11111111-0001-0001-0001-000000000001', 'travel_portal',    1.50, 'Chase Travel Portal',      'Worth 1.5cpp with Sapphire Reserve, 1.25cpp with Preferred'),
('11111111-0001-0001-0001-000000000001', 'cashback',         1.00, 'Cash Back',                '1 cent per point — worst use'),
('11111111-0001-0001-0001-000000000001', 'statement_credit', 1.00, 'Statement Credit',         '1 cent per point'),
('11111111-0001-0001-0001-000000000001', 'gift_cards',       1.00, 'Gift Cards',               '1 cent per point'),

-- Amex MR direct redemptions
('11111111-0001-0001-0001-000000000002', 'travel_portal',    1.00, 'Amex Travel Portal',       '1cpp — use transfer partners for better value'),
('11111111-0001-0001-0001-000000000002', 'statement_credit', 0.60, 'Statement Credit',         '0.6cpp — poor value'),
('11111111-0001-0001-0001-000000000002', 'cashback',         0.60, 'Cash Back / Deposit',      '0.6cpp — avoid'),
('11111111-0001-0001-0001-000000000002', 'gift_cards',       1.00, 'Gift Cards',               '1cpp via Amex gift card shop'),

-- Capital One direct redemptions
('11111111-0001-0001-0001-000000000003', 'travel_portal',    1.00, 'Capital One Travel Portal','1cpp on flights, hotels, rental cars'),
('11111111-0001-0001-0001-000000000003', 'statement_credit', 1.00, 'Statement Credit / Cash',  '1cpp — matches portal'),
('11111111-0001-0001-0001-000000000003', 'cashback',         1.00, 'Cash Back',                '1cpp'),

-- Citi ThankYou direct redemptions
('11111111-0001-0001-0001-000000000004', 'travel_portal',    1.00, 'Citi Travel Portal',       '1cpp'),
('11111111-0001-0001-0001-000000000004', 'statement_credit', 0.50, 'Statement Credit',         '0.5cpp — worst option'),
('11111111-0001-0001-0001-000000000004', 'gift_cards',       1.00, 'Gift Cards',               '1cpp'),

-- Bilt direct redemptions
('11111111-0001-0001-0001-000000000005', 'travel_portal',    1.25, 'Bilt Travel Portal',       '1.25cpp on flights; 1cpp on hotels'),
('11111111-0001-0001-0001-000000000005', 'cashback',         0.55, 'Cash Back',                '0.55cpp — very poor'),
('11111111-0001-0001-0001-000000000005', 'pay_with_points',  0.55, 'Rent Payment',             '0.55cpp — avoid unless desperate');

-- ─────────────────────────────────────────────
-- SAMPLE TRANSFER BONUSES (illustrative)
-- In production, admin updates these in real time
-- ─────────────────────────────────────────────

-- Get the transfer_partner id for Amex → Flying Blue
-- then insert a sample 30% bonus (update dates to real dates when running)
WITH amex_flyingblue AS (
  SELECT id FROM transfer_partners
  WHERE from_program_id = '11111111-0001-0001-0001-000000000002'
    AND to_program_id   = '22222222-0002-0002-0002-000000000007'
)
INSERT INTO transfer_bonuses (transfer_partner_id, bonus_pct, start_date, end_date, source_url, is_verified, notes)
SELECT id, 30, CURRENT_DATE, CURRENT_DATE + 30, 'https://thepointsguy.com', true,
  '30% transfer bonus to Flying Blue — great for last-minute Europe J awards'
FROM amex_flyingblue;
