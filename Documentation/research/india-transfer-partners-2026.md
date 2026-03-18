# India Transfer Partners Research

Research date: 2026-03-17

## Sources checked

- Axis Bank press release on enhanced rewards redemption:
  `https://www.axisbank.com/about-us/press-releases/axis-bank-launches-an-enhanced-rewards-redemption-program-with-13-loyalty-program-partners`
  Notes:
  - confirms `EDGE Rewards / EDGE Miles` transferability
  - explicitly names `Singapore Airlines (KrisFlyer)`, `Marriott Bonvoy`, `Qatar Airways Privilege Club`, and `United Airlines MileagePlus`
  - gives a worked Magnus example of `25,000 Axis EDGE Reward points -> 20,000 KrisFlyer miles`
- HDFC Diners Club Privilege official card page:
  `https://www.hdfcbank.com/personal/pay/cards/credit-cards/diners-privilege-old`
  Notes:
  - explicitly lists AirMiles redemption across `InterMiles`, `Singapore Airlines (KrisFlyer Miles)`, and `Club Vistara`
  - explicitly states `1 Reward Point = 0.5 AirMile` on the Privilege-era page
- HDFC H.O.G Diners Club page:
  `https://www.hdfcbank.com/personal/pay/cards/credit-cards/hog-diners-club-credit-card`
  Notes:
  - explicitly lists `InterMiles`, `Singapore Airlines (KrisFlyer Miles)`, and `Club Vistara`
  - states `1 Reward Point = up to 1 AirMile`, which is stronger than Diners Privilege and shows the family is card-variant-sensitive
- American Express India Membership Rewards:
  `https://www.americanexpress.com/en-in/benefits/rewards/membership-rewards/`
  and
  `https://www.americanexpress.com/in/customer-service/faq.benefits-rewards-and-offers.how-do-i-transfer-my-points-to-another-loyalty-program.html`
  Notes:
  - confirms India Membership Rewards supports transfers to participating airline and hotel programs
  - confirms transfers typically take `3-5 working days`
  - public pages do not enumerate the full partner list cleanly enough for production-grade edge insertion
- SBI Card official pages:
  `https://www.sbicard.com/en/personal/credit-cards/travel/krisflyer-sbi-card.page`
  `https://www.sbicard.com/sbi-card-en/assets/docs/pdf/who-we-are/notices/Disclosure-under-Regulation-30-and-51-Press-Release-sep24.pdf`
  Notes:
  - confirms SBI is currently shipping direct co-branded accrual into KrisFlyer rather than a general transferable currency
  - this supports skipping generic `SBI Card -> airline` transfer edges for now

## Edges added

These were added in migration `039_india_transfer_edges.sql` and are intentionally slug-gated plus `ON CONFLICT DO NOTHING`.

- `hdfc-diners-club-rewards -> krisflyer`
- `hdfc-diners-club-rewards -> club-vistara`
- `hdfc-diners-club-rewards -> intermiles`
- `axis-edge-miles -> air-india-maharaja-club`
- `axis-edge-miles -> krisflyer`
- `axis-edge-miles -> marriott-bonvoy`
- `axis-edge-miles -> qatar-privilege-club`
- `axis-edge-miles -> united-mileageplus`
- `axis-edge-miles -> flying-blue`

## Edges intentionally skipped

- Generic `axis-edge-rewards` edges:
  Public Axis material makes it clear conversion value varies materially by card family, so a single program-level ratio would be misleading.
- `amex-membership-rewards-india -> specific airline/hotel` edges:
  Amex India publicly confirms transfer-partner support and timelines, but the public pages checked here do not cleanly enumerate partner names and ratios. Those edges need one more official source before shipping.
- Generic `sbi-card -> airline` edges:
  SBI currently presents KrisFlyer and Air India primarily through co-branded cards, not through a broad transferable SBI rewards currency in the current public material.
- `icici-rewards -> airline` edges:
  ICICI’s public pages clearly support co-branded Emirates products, but I did not find a clean official source showing a transferable ICICI Rewards partner graph with production-grade ratios.

## Important modeling notes

- HDFC Diners transfer value is card-variant-sensitive. The public Diners Privilege page shows `1 RP = 0.5 AirMile`, while H.O.G Diners says `up to 1 AirMile`. The migration therefore labels these edges as conservative family defaults rather than pretending there is one universally correct Diners ratio.
- Axis `EDGE Miles` is a cleaner transfer currency than generic `EDGE Rewards`, so the migration focuses on `axis-edge-miles`.
- Several canonical slugs referenced in the migration live in catalog staging or future publish flows. The migration is safe because every insert is slug-gated; missing slugs simply no-op instead of failing.

## Follow-up before relying on these edges for end-user recommendations

- Confirm whether `intermiles` exists as a published program slug in the live programs table; if not, the HDFC -> InterMiles edge will safely no-op today.
- Confirm a second official Axis source for the exact `EDGE Miles -> Flying Blue` ratio before exposing it prominently in UI copy.
- Add an official Amex India partner-list source before inserting concrete `amex-membership-rewards-india` edges.
