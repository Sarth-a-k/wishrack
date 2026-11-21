# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

An installable web app (PWA). The owner uses it on an Android phone (Chrome, installed to the home screen) and on a Windows laptop. Mobile web stays `web`; there is no native app.

## Stack

Chosen with the owner (they asked for a free app that works without a Claude subscription):

- Front end: plain static HTML, CSS and JavaScript in `app/`, no framework or build step. Service worker for offline viewing and the Android share target.
- Back end: one Cloudflare Worker (`worker/index.js`) on the free plan, which also serves `app/`.
- Storage: Cloudflare D1 (items and small JPEG photos). No R2.
- Reading screenshots: Google Gemini (free tier) through the Worker, key kept as a Worker secret; Tesseract.js text recognition on the device as the fallback when there is no key or the daily limit is used up.
- Reading links: the Worker fetches the store page and reads Shopify product JSON, schema.org Product data and meta tags; Gemini only when those miss.
- Daily price re-check by a Worker cron trigger.

## Users

One person: the owner, a student in India. Single user only; no accounts, sharing or other people's racks.

They come across clothes and shoes while scrolling Instagram reels and ads, store apps (H&M, Uniqlo, Bonkers Corner and others) and websites, usually on their phone. The job: save a product in seconds (screenshot or link) without leaving what they were doing, then later see everything they want in one place, check whether the price is good, and jump straight to the store to buy.

## Product Purpose

A personal wishlist for clothes and shoes seen anywhere online. Each saved item shows its photo and price; tapping the photo opens the store that sells it. It compares prices across Indian stores and watches saved prices for drops.

Success: saving a product takes one share or one paste, the saved price and store are right without retyping, and the owner buys at a lower price than they would have otherwise.

## Positioning

Every store has its own wishlist, but each one only holds that store's items and nothing seen on Instagram. Wishrack takes a screenshot or link from anywhere, works out the product, price and store, and keeps one rack across all stores, with price-drop tracking. It runs free on the owner's own Cloudflare account and does not depend on a Claude subscription.

## Operating Context

- Capture happens mid-scroll on an Android phone, one-handed: Android share sheet (share to Wishrack), paste, or picking screenshots from the gallery, often several at once.
- Browsing and buying happen later, on the phone or the laptop.
- Typical sources: Instagram reels and sponsored posts (brands such as Bonkers Corner), H&M India, Uniqlo India, Myntra, Amazon.in, Flipkart, Ajio.
- Size matters when buying: the owner compares a store's size chart against clothes that already fit (for example a Ducati sweatshirt in M).

## Capabilities and Constraints

- Clothes and shoes only. Size and colour are first-class fields.
- Indian stores; prices in Indian rupees (Rs.). Other currencies are out of scope.
- Free to run: Cloudflare free plan (50 outbound requests per Worker run, so the daily price check is limited to about 20 items per run) and the Gemini free tier (daily limits; Google may use free-tier inputs to improve its models).
- Access is protected by one passcode stored as a Worker secret. Product photos are served by unguessable id without the passcode.
- Cross-store comparison is search links to Myntra, Amazon, Flipkart, Ajio and Google Shopping, not automatic, because those stores block automated server requests. Price-drop tracking works on the saved store's page.
- Instagram links need a login, so a link alone from Instagram gives little; a screenshot is the reliable input there.
- Screenshot reading can be wrong; every extraction goes through a check-and-edit step (including adjusting the photo crop) before saving.
- Terms used in the app: rack (the whole list), item, store, price, MRP (original price), price drop, bought, removed, "Bought & removed" (the list items move to when bought or removed).
- Removing an item never deletes it: it moves to Bought & removed, where it can be put back. Only "Delete forever" in that list deletes.
- Visual design: decided (November 2026). The owner chose "design C", forest green and mint, from a reference screenshot they supplied, and approved the preview (`mockups/design-c.html`). It is built into `app/` and recorded in DESIGN.md. The earlier mockups A and B and the navy "Nani's cardigan" look are retired.

## Brand Commitments

- Name: Wishrack (current working name, in use across the app and mockups).
- Colours: the owner chose forest green and mint (design C) over the earlier blue-and-cozy direction. Their first brief was "blue and cozy colours"; the approved green design now replaces it. Keep the look cozy and not plain, with a dark-green Night version for late-night use.
- The product grid should read like a store's product listing, modelled on the Uniqlo results grid the owner shared: product photo first, then name and price.
- Tapping a product's photo opens the store that sells it.

## Evidence on Hand

- Seven real saved products with real prices and store links: `worker/seed.sql` (H&M cardigan, three Bonkers Corner pants and joggers, H&M felted and teddy jackets, Uniqlo fleece).
- No product photos yet; they will come from the owner's screenshots or store pages. Do not fabricate product imagery beyond clearly marked placeholders.
- No other users, reviews or testimonials exist; do not invent any.

## Product Principles

1. Capture beats completeness: saving must be fast, and anything missing can be fixed later in the item.
2. Never show a price the app did not read: a guess is marked as missing, not filled in.
3. The store is one tap away: every item leads straight to where it can be bought.
4. Free and self-owned: no paid service and no dependency on a subscription the owner may not keep.
5. Phone first, laptop equally capable.
