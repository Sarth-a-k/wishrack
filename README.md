# Wishrack

A personal wishlist for clothes and shoes you see anywhere online. Share a screenshot or link from Instagram or any store app, and Wishrack reads the product, price and store, keeps it on one rack, tracks price drops, and takes you straight to the store when you tap the photo.

- Installable web app for Android and laptop, with an Android share-menu target
- Screenshots read by Google Gemini (free tier), with on-device text recognition as a fallback; screenshots without clothes or shoes are skipped
- Store links read from the page's own product data (Shopify stores, schema.org, meta tags)
- Daily price checks and a knitted price-history chart
- Runs free on your own Cloudflare account (one Worker + D1)

## Set up

See [SETUP.md](SETUP.md).

## Layout

- `app/` the web app (HTML, CSS, JS, service worker, icons, fonts)
- `worker/` the Cloudflare Worker API, database schema and seed data
- `PRODUCT.md`, `DESIGN.md` product and design records
- `tools/` icon generator and a static server for `mockups/`
