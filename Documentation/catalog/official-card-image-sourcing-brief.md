# Official Card Image Sourcing Brief

Use this instead of AI-generated card art for the production catalog.

## Goal

For each active-public card in the catalog:

- locate the official issuer-hosted image or CDN asset
- download it
- store it in our own asset storage
- reference the self-hosted asset from PointsMax

Do not hotlink issuer CDNs in production. Official image URLs change too often.

## Source Manifest

Use:

- `Documentation/catalog/card-official-image-source-manifest.csv`

This file contains:

- card name
- issuer
- asset slug
- official source page
- source confidence
- extraction status

## Rules

- Prefer official issuer portfolio pages or official product pages.
- If the page references a CDN-hosted card image, fetch that file and self-host it.
- Preserve the official card art where available.
- If no official image exists, fall back to:
  1. issuer portfolio tile image
  2. issuer card hero asset
  3. placeholder brand treatment

## Storage Policy

- Download the asset into our own controlled store.
- Normalize filenames to `image_asset_slug`.
- Prefer `png`, `webp`, or issuer-supplied `svg` where quality is acceptable.
- Record the final hosted path back into the seed/migration layer.

## Why

This is better than AI-generated images for scale and accuracy:

- brand-accurate
- lower manual QA load
- easier to maintain
- less risk of invented or unrealistic card designs
