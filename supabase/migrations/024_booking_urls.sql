-- Create booking_urls table
CREATE TABLE IF NOT EXISTS public.booking_urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_slug TEXT NOT NULL,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    region TEXT NOT NULL CHECK (region IN ('us', 'in', 'global')),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.booking_urls ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access to booking_urls"
ON public.booking_urls FOR SELECT
TO public
USING (is_active = true);

-- Insert initial data from hardcoded list
INSERT INTO public.booking_urls (program_slug, label, url, region, sort_order) VALUES
('chase-ur', 'Chase UR transfer partners', 'https://www.ultimaterewards.com', 'us', 10),
('amex-mr', 'Amex MR transfer partners', 'https://global.americanexpress.com/rewards/transfer', 'us', 20),
('capital-one', 'Capital One transfer partners', 'https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/', 'us', 30),
('citi-thankyou', 'Citi ThankYou transfer partners', 'https://www.citi.com/credit-cards/thankyou-rewards', 'us', 40),
('bilt', 'Bilt transfer partners', 'https://www.bilt.com/rewards/travel', 'us', 50),
('hdfc-millennia', 'HDFC Millennia portal', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards', 'in', 60),
('sbi-card', 'SBI Card rewards', 'https://www.sbicard.com/en/personal/rewards.page', 'in', 70),
('axis-edge', 'Axis Edge Rewards', 'https://www.axisbank.com/axis-edge-rewards/', 'in', 80),
('icici-rewards', 'ICICI Rewards', 'https://www.icicibank.com/personal-banking/cards/credit-card', 'in', 90),
('hyatt', 'Hyatt award search', 'https://world.hyatt.com/content/gp/en/rewards.html', 'global', 100),
('marriott', 'Marriott Bonvoy award search', 'https://www.marriott.com/loyalty/redeem.mi', 'global', 110),
('hilton', 'Hilton Honors award search', 'https://www.hilton.com/en/hilton-honors/points/', 'global', 120),
('ihg', 'IHG One Rewards award search', 'https://www.ihg.com/onerewards/content/us/en/redeem-rewards', 'global', 130),
('united', 'United MileagePlus award search', 'https://www.united.com/en/us/fly/travel/awards.html', 'global', 140),
('delta', 'Delta SkyMiles award search', 'https://www.delta.com/us/en/skymiles/overview', 'global', 150),
('american', 'American AAdvantage award search', 'https://www.aa.com/homePage.do', 'global', 160),
('flying-blue', 'Air France/KLM Flying Blue', 'https://www.flyingblue.com/en/spend/flights', 'global', 170),
('british-airways', 'British Airways Avios', 'https://www.britishairways.com/travel/home/public/en_us/', 'global', 180),
('aeroplan', 'Air Canada Aeroplan', 'https://www.aeroplan.com/', 'global', 190),
('krisflyer', 'Singapore KrisFlyer', 'https://www.singaporeair.com/en_UK/us/home', 'global', 200),
('turkish', 'Turkish Miles&Smiles', 'https://www.turkishairlines.com/en-int/miles-and-smiles/', 'global', 210),
('lifemiles', 'Avianca LifeMiles', 'https://www.lifemiles.com/fly/search', 'global', 220);
