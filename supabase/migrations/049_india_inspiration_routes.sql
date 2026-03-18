-- ============================================================
-- PointsMax — Migration 049
-- India inspiration routes seed
-- ============================================================

INSERT INTO public.inspiration_routes (
  region, origin_iata, destination_iata, destination_label, cabin, program_slug,
  miles_required, estimated_cash_value_usd, cpp_cents, headline, description,
  is_featured, display_order
)
VALUES
  ('IN', 'DEL', 'JFK', 'New York, USA', 'business', 'air-india-maharaja-club', 80000, 4200, 5.3, 'Nonstop to New York via Air India', 'A nonstop long-haul business redemption that gives Indian premium travelers a clear Maharaja Club target.', true, 10),
  ('IN', 'BOM', 'SYD', 'Sydney, Australia', 'business', 'krisflyer', 96000, 4800, 5.0, 'Sydney via Singapore with KrisFlyer', 'A classic one-stop premium redemption where KrisFlyer keeps the routing and award logic straightforward.', false, 20),
  ('IN', 'DEL', 'ORD', 'Chicago, USA', 'business', 'aeroplan', 75000, 3800, 5.1, 'Aeroplan to Chicago from Delhi', 'Useful when Star Alliance partner space beats the nonstop carriers on value.', false, 30),
  ('IN', 'BLR', 'CDG', 'Paris, France', 'business', 'flying-blue', 60000, 2800, 4.7, 'Paris from Bangalore with Flying Blue', 'A strong Europe sweet spot when Flying Blue promo pricing lines up from Bangalore.', false, 40),
  ('IN', 'DEL', 'ICN', 'Seoul, South Korea', 'business', 'air-india-maharaja-club', 45000, 2100, 4.7, 'Seoul via Air India wide-body routes', 'An Asia long-haul redemption that works best when direct cash fares are elevated.', false, 50),
  ('IN', 'HYD', 'NRT', 'Tokyo, Japan', 'business', 'krisflyer', 92000, 4400, 4.8, 'Tokyo via Singapore from Hyderabad', 'A Hyderabad-origin premium itinerary that meaningfully outperforms cash prices in peak periods.', false, 60),
  ('IN', 'BOM', 'LAX', 'Los Angeles, USA', 'business', 'air-india-maharaja-club', 87000, 4500, 5.2, 'Mumbai to Los Angeles on Air India', 'A marquee nonstop West Coast redemption with strong outsized value versus cash.', true, 70),
  ('IN', 'DEL', 'MEL', 'Melbourne, Australia', 'business', 'qantas-frequent-flyer', 105000, 5200, 5.0, 'Melbourne with Qantas points from Delhi', 'A long-haul Australia use case where a premium cabin meaningfully lifts cents-per-point value.', false, 80),
  ('IN', 'BLR', 'LHR', 'London, United Kingdom', 'business', 'british-airways-avios', 55000, 2600, 4.7, 'Avios to London from Bangalore', 'Useful when direct London pricing spikes but short transfer windows keep the routing practical.', false, 90),
  ('IN', 'DEL', 'ZRH', 'Zurich, Switzerland', 'business', 'aeroplan', 72000, 3400, 4.7, 'Aeroplan to Europe via Star Alliance', 'A steady Europe premium benchmark when Lufthansa Group cash fares rise.', false, 100),
  ('IN', 'MAA', 'SIN', 'Singapore', 'business', 'krisflyer', 35000, 1600, 4.6, 'Short-hop premium from Chennai', 'A relatively low-mileage regional premium redemption that is easy to explain and easy to book.', false, 110),
  ('IN', 'BOM', 'AMS', 'Amsterdam, Netherlands', 'business', 'flying-blue', 58000, 2700, 4.7, 'Flying Blue to Amsterdam from Mumbai', 'A strong Europe example tied to one of the easiest SkyTeam programs for Indian users to understand.', false, 120),
  ('IN', 'DEL', 'DOH', 'Doha, Qatar', 'business', 'qatar-privilege-club', 30000, 1500, 5.0, 'Qsuite-style hop from Delhi', 'A short premium sector where Avios-linked pricing can still produce standout value.', true, 130),
  ('IN', 'BLR', 'SIN', 'Singapore', 'economy', 'krisflyer', 16500, 700, 4.2, 'Efficient economy value to Singapore', 'A clean economy sweet spot that keeps the inspiration grid from being premium-cabin only.', false, 140),
  ('IN', 'HYD', 'DXB', 'Dubai, UAE', 'business', 'emirates-skywards', 28000, 1200, 4.3, 'Emirates Business from Hyderabad', 'A short-haul business redemption that still compares well against busy-season paid fares.', false, 150),
  ('IN', 'BOM', 'HKG', 'Hong Kong', 'business', 'cathay-asia-miles', 40000, 1900, 4.8, 'Asia Miles to Hong Kong from Mumbai', 'A practical Asia premium use case where the program remains easy to narrate to users.', false, 160),
  ('IN', 'DEL', 'MLE', 'Maldives', 'business', 'air-india-maharaja-club', 18000, 900, 5.0, 'Maldives business quick escape', 'Short-haul aspirational travel with a simple story and strong cash comparison.', false, 170),
  ('IN', 'BLR', 'KUL', 'Kuala Lumpur, Malaysia', 'business', 'krisflyer', 25000, 1000, 4.0, 'Malaysia hop via KrisFlyer', 'A medium-haul premium example that broadens coverage beyond Europe and North America.', false, 180),
  ('IN', 'DEL', 'GRU', 'São Paulo, Brazil', 'business', 'aeroplan', 100000, 5000, 5.0, 'Aeroplan to South America from Delhi', 'A niche but memorable long-haul benchmark for users optimizing transferrable points.', false, 190),
  ('IN', 'MAA', 'DOH', 'Doha, Qatar', 'first', 'qatar-privilege-club', 60000, 4200, 7.0, 'High-end Doha redemption from Chennai', 'One of the flashiest modeled India-origin routes in the catalog, useful as an editorial hero card.', true, 200)
ON CONFLICT (region, origin_iata, destination_iata, cabin, program_slug, headline) DO NOTHING;
