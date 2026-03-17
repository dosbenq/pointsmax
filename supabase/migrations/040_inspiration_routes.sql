CREATE TABLE inspiration_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL CHECK (region IN ('US', 'IN', 'GLOBAL')),
  origin_iata text,
  destination_iata text NOT NULL,
  destination_label text NOT NULL,
  cabin text NOT NULL,
  program_slug text NOT NULL,
  miles_required int NOT NULL,
  estimated_cash_value_usd int NOT NULL,
  cpp_cents numeric NOT NULL,
  headline text NOT NULL,
  description text NOT NULL,
  is_featured boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inspiration_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads inspiration_routes"
  ON inspiration_routes FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Service role manages inspiration_routes"
  ON inspiration_routes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO inspiration_routes (
  region, origin_iata, destination_iata, destination_label, cabin, program_slug,
  miles_required, estimated_cash_value_usd, cpp_cents, headline, description,
  is_featured, display_order
)
VALUES
  ('US', 'JFK', 'NRT', 'Tokyo, Japan', 'business', 'aeroplan', 55000, 3900, 7.1, 'ANA Business to Tokyo', 'A classic sweet spot: Aeroplan can unlock ANA business class across the Pacific for dramatically less than cash fares.', true, 10),
  ('US', 'JFK', 'IST', 'Istanbul, Turkey', 'business', 'turkish-miles-smiles', 45000, 2800, 6.2, 'Turkish Business to Istanbul', 'Turkish Miles&Smiles keeps transatlantic business redemptions unusually efficient from the East Coast.', true, 20),
  ('US', 'EWR', 'SIN', 'Singapore', 'business', 'aeroplan', 87500, 5200, 5.9, 'Singapore via Aeroplan', 'Long-haul premium cabins to Singapore can return outsized value when partner space opens through Star Alliance channels.', true, 30),
  ('US', 'LAX', 'HND', 'Tokyo, Japan', 'first', 'virgin-atlantic-flying-club', 72500, 7800, 10.8, 'ANA First from Los Angeles', 'Aspirational first-class value when Virgin Atlantic miles line up with ANA premium award availability.', true, 40),
  ('US', 'ORD', 'ZRH', 'Zurich, Switzerland', 'business', 'air-canada-aeroplan', 70000, 3400, 4.9, 'Swiss Business to Zurich', 'A reliable example of premium transatlantic value using Aeroplan for Star Alliance partner awards.', false, 50),
  ('US', 'SFO', 'CDG', 'Paris, France', 'business', 'flying-blue', 60000, 3100, 5.2, 'Flying Blue to Paris', 'Flying Blue promo-style pricing can create strong value on nonstop Europe routes from the West Coast.', false, 60),
  ('US', 'SEA', 'ICN', 'Seoul, South Korea', 'business', 'alaska-mileage-plan', 75000, 3600, 4.8, 'Korean Premium to Seoul', 'Mileage Plan partner awards can still create above-market value on select Asia routes.', false, 70),
  ('US', 'DFW', 'MAD', 'Madrid, Spain', 'business', 'iberia-plus', 42500, 2400, 5.6, 'Iberia Business to Madrid', 'One of the cleanest transatlantic sweet spots when off-peak pricing is available.', false, 80),
  ('US', 'MIA', 'LIM', 'Lima, Peru', 'business', 'avianca-lifemiles', 35000, 1600, 4.6, 'Lifemiles to South America', 'Shorter premium flights to northern South America can price far below the cabin’s cash equivalent.', false, 90),
  ('US', 'BOS', 'DUB', 'Dublin, Ireland', 'business', 'british-airways-avios', 50000, 2100, 4.2, 'Avios to Dublin', 'Avios can be compelling on shorter transatlantic flights where surcharges stay manageable.', false, 100),
  ('US', 'ATL', 'JNB', 'Johannesburg, South Africa', 'business', 'air-france-klm-flying-blue', 95000, 5400, 5.7, 'Flying Blue to South Africa', 'Very long-haul business class routes create the biggest gap between points pricing and cash fares.', false, 110),
  ('US', 'IAD', 'CAI', 'Cairo, Egypt', 'business', 'air-canada-aeroplan', 80000, 3700, 4.6, 'Aeroplan to North Africa', 'Aeroplan’s reach into Africa remains one of its strongest use cases for premium cabins.', false, 120),
  ('US', 'LAX', 'SYD', 'Sydney, Australia', 'business', 'qantas-frequent-flyer', 108000, 6200, 5.7, 'Qantas Business to Sydney', 'Hard-to-find space, but the value is obvious when premium Australia redemptions appear.', false, 130),
  ('US', 'JFK', 'DOH', 'Doha, Qatar', 'business', 'qatar-privilege-club', 70000, 4100, 5.9, 'Qsuite to Doha', 'Qatar business class is one of the clearest examples of premium cash fares translating into elite points value.', false, 140),
  ('US', 'SFO', 'AKL', 'Auckland, New Zealand', 'business', 'air-canada-aeroplan', 87500, 4800, 5.5, 'Aeroplan to New Zealand', 'Ultra-long-haul business flights are exactly where transferable points can outperform cashback.', false, 150),
  ('IN', 'DEL', 'LHR', 'London, United Kingdom', 'business', 'air-india-maharaja-club', 40000, 2100, 5.3, 'Air India Business to London', 'For Indian flyers, nonstop Europe business awards can materially outperform fixed-value redemptions.', true, 10),
  ('IN', 'BOM', 'SIN', 'Singapore', 'business', 'club-vistara', 30000, 1400, 4.7, 'Singapore Business from Mumbai', 'Short-haul premium redemptions in Asia often create the easiest high-value wins from India.', true, 20),
  ('IN', 'BLR', 'DXB', 'Dubai, UAE', 'business', 'emirates-skywards', 28000, 1100, 3.9, 'Dubai Premium Getaway', 'Even mid-haul business cabins can beat the value of cashback when booked at saver levels.', true, 30),
  ('IN', 'DEL', 'SIN', 'Singapore', 'business', 'singapore-krisflyer', 43500, 1700, 3.9, 'KrisFlyer to Singapore', 'Transferable bank points in India become much more useful when KrisFlyer availability opens.', true, 40),
  ('IN', 'MAA', 'BKK', 'Bangkok, Thailand', 'business', 'air-india-maharaja-club', 22000, 850, 3.9, 'Business to Bangkok', 'Regional business awards are a practical way to extract better-than-cash value from Indian points balances.', false, 50),
  ('IN', 'HYD', 'KUL', 'Kuala Lumpur, Malaysia', 'business', 'singapore-krisflyer', 27000, 980, 3.6, 'Asia Business Hop', 'Shorter Southeast Asia premium routes are achievable and useful for smaller transferable balances.', false, 60),
  ('IN', 'DEL', 'CDG', 'Paris, France', 'business', 'flying-blue', 55000, 2500, 4.5, 'Flying Blue to Paris', 'Flying Blue is often one of the cleanest Europe transfer options for premium redemptions from India.', false, 70),
  ('IN', 'BOM', 'NRT', 'Tokyo, Japan', 'business', 'air-canada-aeroplan', 70000, 3200, 4.6, 'Aeroplan to Tokyo', 'A strong use case for Indian travelers who collect flexible points and want high-value long-haul awards.', false, 80),
  ('IN', 'DEL', 'SYD', 'Sydney, Australia', 'business', 'qantas-frequent-flyer', 90000, 4200, 4.7, 'Sydney Business from Delhi', 'Australia routes are expensive in cash, which makes premium award pricing stand out even more.', false, 90),
  ('IN', 'BOM', 'MRU', 'Mauritius', 'business', 'air-mauritius-kestrelflyer', 26000, 1200, 4.6, 'Mauritius Escape', 'Leisure-heavy routes with premium cabin cash fares can still produce outsized points value from India.', false, 100);
