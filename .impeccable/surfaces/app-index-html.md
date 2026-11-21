---
version: 1
slug: "app-index-html"
primary_target: "app/index.html"
related_targets: ["app/styles.css","app/app.js"]
---

# Wishrack app (app/index.html)

Scope: the whole installable app: passcode gate, home (rack grid, price-drop banner, store chips, Bought & removed strip), Price drops, Save (link/screenshots, review with crop editor), Bought & removed, item sheet, settings. Mode: Operate.
Audience and job: the owner, on an Android phone (often late at night) and a Windows laptop. Save a product in one share or paste, check it, then browse, watch prices and jump to the store.
Constraints: Day (light mint) is the default look, Night is a dark-green version; prices in Rs., tabular. No fabricated product photos (placeholders show a hanger). Removing an item moves it to Bought & removed; only "Delete forever" there deletes. zoom.js must stay loaded.

## Direction contract
THESIS: Design C, pinned by the owner from a reference screenshot (a plant-shop app) and approved as a preview: forest green and mint, product cards whose light panel curves into a green price footer, one curved bottom bar with a raised save button. It replaces the earlier "Nani's cardigan" navy world.
OWN-WORLD: forest #12493b for banner, card footers and primary actions; mint page wash #eaf4ef; panel #dcebe3; sage chips #a9c9ad; white circles and inputs; Poppins 400 to 700; large radii (16/22/28px); soft green-tinted shadows in Day, black in Night.
STORY: The owner sees the rack total and the latest price drop, filters by store, taps a photo to go to the store, opens an item to see its price history, marks it bought or removes it, and can put it back from Bought & removed.
FIRST VIEWPORT: Top row: search circle left; bag circle with count and green W avatar right. Two-line headline, rack total, forest price-drop banner with the item photo overflowing its top right, store chips, then the 2-column card grid; curved white bottom bar with Home, Price drops, raised scan button, Bought & removed, Settings.
FORM: Pinned whole by the owner's screenshot and approved preview (mockups/design-c.html); the owner's words: "can we get the app front end to look exactly like the scrrenshot", then "Approve, build it". seed: none (pinned)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
