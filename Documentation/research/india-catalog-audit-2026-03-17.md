# India catalog audit — March 17, 2026

Live production audit against Supabase showed:

- `14` active India cards live
- all live India cards are missing `apply_url`
- live India reward programs are still thin:
  - `hdfc-millennia`
  - `axis-edge`
  - `amex-india-mr`
  - `air-india`
  - `indigo-6e`
  - `taj-innercircle`
  - `sbi-reward-points`
  - `amazon-pay-rewards`
  - `kotak-royale`
  - `yes-rewardz`
  - `standard-chartered-360`
- live India transfer partners were present but materially incomplete, and all existing timings were still set to `24h`

Cards already live from the target list:

- `HDFC Infinia`
- `HDFC Regalia Gold`
- `Axis Atlas`
- `Kotak Royale Signature`

Cards missing from the target list:

- `HDFC Diners Club Black Metal Edition`
- `Axis Bank Reserve Credit Card`
- `Emeralde Private Metal Credit Card`
- `Indulge Credit Card`
- `YES Private Credit Card`
- `World Safari Credit Card`
- `SBI Card Elite`

Implementation choice for Sprint 5:

- publish only the missing high-signal India cards instead of replaying the full staging catalog
- add the missing India-side reward programs needed to support those cards:
  - `icici-rewards`
  - `indusmoments`
  - `rbl-rewards`
- add the missing India transfer edges to globally live programs already present in production:
  - `singapore`
  - `british-airways`
  - `etihad`
  - `marriott`
- do **not** add `club-vistara` in this pass because the live catalog is already converging toward the post-merger Air India state

This keeps the migration targeted and compatible with the actual production schema instead of assuming the staging catalog tables are deployed live.
