---
name: Wishrack
description: A personal clothes-and-shoes wishlist in forest green and mint, where light photo panels curve into deep green price footers; Day by default, Night as a dark-green version.
colors:
  page: "#eaf4ef"
  page-2: "#f7fbf9"
  surface: "#ffffff"
  panel: "#dcebe3"
  panel-hi: "#f4faf7"
  forest: "#12493b"
  forest-2: "#1d5c4b"
  on-forest: "#ffffff"
  on-forest-2: "#cfe3d9"
  on-forest-3: "#a9cbbd"
  sage: "#a9c9ad"
  sage-ink: "#1f4a3b"
  ink: "#13241e"
  ink-2: "#56685f"
  line: "#d4e3da"
  title: "#12493b"
  sale: "#b9362f"
  drop: "#2a7d45"
  rose: "#e8b4ae"
  go-bg: "#ffffff"
  go-ink: "#12493b"
  shade: "rgba(9, 30, 24, .45)"
  bar-shadow: "rgba(18, 73, 59, .14)"
typography:
  display:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(26px, 7.4vw, 34px)"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-0.015em"
  display-gate:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(28px, 8vw, 36px)"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.01em"
  price-big:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    fontFeature: "tnum"
  title:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.22
  headline:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 600
  section:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "19px"
    fontWeight: 600
  banner-title:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 600
  price:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15.5px"
    fontWeight: 600
    lineHeight: 1.15
    fontFeature: "tnum"
  box-title:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  card-title:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
    lineHeight: 1.28
  body:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  button:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  chip:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  support:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  hint:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
  label:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
  meta:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 400
  flag:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    fontFeature: "tnum"
  state:
    fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
rounded:
  sm: "12px"
  chip: "13px"
  md: "16px"
  pill-field: "18px"
  lg: "22px"
  box: "24px"
  panel-curve: "26px"
  xl: "28px"
  full: "999px"
spacing:
  chip-gap: "8px"
  grid-gap: "14px"
  box: "16px"
  grid-gap-wide: "18px"
  gutter: "20px"
  section: "30px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.forest-2}"
  button-white:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.title}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "48px"
  button-sage:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.sage-ink}"
    rounded: "{rounded.md}"
    height: "48px"
  button-deep:
    backgroundColor: "{colors.forest-2}"
    textColor: "{colors.on-forest}"
    rounded: "{rounded.md}"
    height: "48px"
  button-small:
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.sale}"
  circle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    size: "46px"
  circle-open:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
  avatar:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    size: "46px"
  chip:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.sage-ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.chip}"
    padding: "0 18px"
    height: "44px"
  chip-on:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
  chip-icon:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    size: "44px"
  product-card:
    backgroundColor: "{colors.forest}"
    rounded: "{rounded.lg}"
  product-card-panel:
    backgroundColor: "{colors.panel}"
    padding: "12px 12px 16px"
  product-card-foot:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    typography: "{typography.price}"
    padding: "12px 10px 13px 13px"
  go-disc:
    backgroundColor: "{colors.go-bg}"
    textColor: "{colors.go-ink}"
    rounded: "{rounded.full}"
    size: "36px"
  flag:
    backgroundColor: "{colors.go-bg}"
    textColor: "{colors.drop}"
    typography: "{typography.flag}"
    rounded: "{rounded.full}"
    padding: "4px 9px 4px 7px"
  flag-sale:
    backgroundColor: "{colors.go-bg}"
    textColor: "{colors.sale}"
  price-drop-banner:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    rounded: "{rounded.lg}"
    padding: "22px 166px 40px 34px"
    height: "156px"
  gone-card:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    rounded: "{rounded.lg}"
    padding: "10px 12px 10px 10px"
    width: "262px"
  gone-item:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "12px"
  state-bought:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    typography: "{typography.state}"
    rounded: "{rounded.full}"
  state-removed:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.sage-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.full}"
  pill-input:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill-field}"
    padding: "0 6px 0 18px"
    height: "56px"
  field:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "46px"
  card-box:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.box}"
  save-panel:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    rounded: "{rounded.box}"
    padding: "18px"
  tabbar:
    backgroundColor: "{colors.surface}"
    height: "104px"
  tab:
    textColor: "{colors.ink-2}"
    size: "48px"
  tab-current:
    textColor: "{colors.title}"
  fab:
    backgroundColor: "{colors.surface}"
    size: "66px"
  fab-core:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    size: "52px"
  segment-on:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page-2}"
    padding: "10px 10px 10px 16px"
---

# Design System: Wishrack

## Overview

**Creative North Star: "Forest and Mint"**

Design C, pinned by the owner from a reference screenshot of a plant-shop app and approved as a preview. A mint-washed page holds soft white controls and pale green photo panels; deep forest green carries everything that matters about money and action: the price-drop banner, every card's price footer, the primary buttons and the raised save button. The signature move is the curve: each product card's light photo panel ends in a rounded bottom (26px) that sits inside a forest card, so the green reads as a footer the panel curves into, and the one white bottom bar dips in the middle to cradle the save button.

The app is dense but soft: a two-column grid on the phone, large radii (12 to 28px) everywhere, no hairlines between things, depth from green-tinted ambient shadows rather than borders. Poppins at 400 to 700 does all the talking, with tabular figures for every price. Day (mint) is the default look; Night swaps the same roles to dark greens and turns the shadows black.

It replaces the earlier navy knitted world entirely; nothing from that world (stitch textures, ribbed edges, mustard buttons, Bricolage Grotesque or Figtree) carries over.

**Key Characteristics:**
- Forest green (#12493b) is the money-and-action colour: banner, card footers, primary actions, selected states.
- Light panels curve into forest footers; the curve is the card.
- One curved white bottom bar with a raised forest save button in its dip.
- Sage chips, white circle buttons, white discs on green.
- Price history as rounded bars: forest fell, rose rose, sage no change.
- Removing never deletes; Bought & removed holds everything until "Delete forever".
- Day default, Night as dark green; Poppins only.

## Colors

A two-green system on a mint wash: deep forest for weight and action, sage for soft secondary controls, white for everything you touch that is not green.

### Primary
- **Forest** (`forest`): the price-drop banner, product card bodies and price footers, Bought & removed strip cards, the save panel, primary buttons, the save button core, selected chips, the open search circle, the avatar, the chosen theme segment, the "fell" bar in price history, the focus ring of the link field, crop frame and checkbox accent.
- **Forest Lit** (`forest-2`): primary button hover, the "deep" buttons that sit on a forest panel (Screenshots, Add by hand), the progress track, and the empty banner's art tile.
- **On Forest** (`on-forest`, `on-forest-2`, `on-forest-3`): white headline and price text on forest, then two softer mints for supporting text and struck-out MRP.

### Secondary
- **Sage** (`sage`) with **Sage Ink** (`sage-ink`): store chips, the "Save" button in the link field, the removed state pill in the Bought & removed list, the "no change" bar, link underlines, text selection, scrollbars, the dashed drop-target border.

### Tertiary
- **Rose** (`rose`): one job only, the "price rose" bar in price history.

### Neutral
- **Mint Wash** (`page`) fading to **Lower Page** (`page-2`): the page is a 420px vertical gradient from page to page-2; the sheet repeats it over 360px. `page` also fills form fields and the theme segment track.
- **Surface White** (`surface`): circle buttons, the default button, inputs, the bottom bar, the save button's outer ring, sheet boxes, Bought & removed list rows.
- **Photo Panel** (`panel`, `panel-hi`): product photo panels, lit by a radial gradient from panel-hi near the top.
- **Ink** (`ink`, `ink-2`): body text and secondary text. `title` is forest in Day and turns to ink-light in Night so product names and links stay readable.
- **Line** (`line`): used only for the dashed no-photo frame in review.
- **Sale** (`sale`) and **Drop** (`drop`): percent-off and errors in red; price-fell text and the "on" status dot in green.
- **Go disc** (`go-bg`, `go-ink`): the white disc with forest arrow that opens the store; white in both themes.

### Night
Night lives under `:root[data-theme="dark"]` and, when no theme is chosen, under `prefers-color-scheme: dark`. Every role keeps its name; values move to dark greens (page #0e1d18, surface #15261f, panel #1b3129, forest lifts to #1c6551). The go disc stays white with forest ink. Full values are in the sidecar.

### Named Rules
**The Money Is Green Rule.** Forest is where price and action live: footers, banner, primary buttons, the save button, selected states. Supporting controls are sage or white, never a second strong colour.

**The White Disc Rule.** Anything small and round sitting on green (the store arrow, drop flags, the bought pill, the banner tag) is a white disc or pill with forest or status-coloured ink, in both themes.

**The Three-Bar Rule.** Price history speaks in exactly three colours: forest for a fall, rose for a rise, sage for no change, with a legend only for directions that occur.

## Typography

**Display Font:** Poppins (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Poppins (same stack)

**Character:** One geometric sans at four weights, self-hosted (400, 500, 600, 700; latin and latin-ext, 400 and 600 preloaded) so the installed app keeps its type offline. Weight, not a second family, carries the hierarchy.

### Hierarchy
- **Display** (700, clamp 26 to 34px, 1.18, -0.015em): the home headline, balanced, max 13em.
- **Display, gate** (700, clamp 28 to 36px, 1.14): the passcode screen headline, max 12ch.
- **Price, big** (700, 28px, tabular): the price in the item sheet.
- **Title** (700, 22px, 1.22): the product name in the item sheet, forest/title colour.
- **Headline** (600, 20px): view titles beside the back circle; sheet heading.
- **Section** (600, 19px): "Bought & removed", review heading.
- **Banner title** (600, 18px): "Price dropped"; also empty-state headings.
- **Price** (600, 15.5px, 1.15, tabular): every card footer price; struck MRP below it at 11px 400.
- **Box title** (600, 15px): sheet box headings.
- **Card title** (600, 14.5px, 1.28, two-line clamp): product names on cards and list rows.
- **Body / Button** (400 / 600, 14px, 1.45): base text and button labels; small buttons drop to 13px.
- **Chip / Support** (500 / 400, 13px): chips; sub copy in ink-2, max 62ch.
- **Hint** (12.5px), **Label** (500, 11.5px), **Meta** (11px), **Flag** (600, 11px, tabular), **State** (600, 10.5px).

### Named Rules
**The Tabular Price Rule.** Every price, tally, flag amount and axis date uses tabular figures.

**The One Family Rule.** Poppins only; hierarchy comes from weight (400 to 700) and size, never a second face.

## Layout

Phone first. Views are capped at 1180px and centred, with a 20px side gutter on every row and safe-area insets added top and bottom. Content clears the bottom bar with 150px of bottom padding.

- **Home order:** top row (search circle left; bag circle with count and the W avatar right), display headline, rack tally, price-drop banner (58px top margin so the photo can overflow upward), store chips, then the card grid, then the Bought & removed strip.
- **Grid:** two columns with a 14px gap on phones; from 640px it becomes auto-fill columns of at least 200px with an 18px gap.
- **Chips:** one horizontally scrolling row, 8px gaps, scrollbar hidden, the sort chip first.
- **Bought & removed:** a horizontal strip of 262px cards on home; a full list of auto-fill columns (min 330px) on its own view.
- **Sheet:** full-screen on phones; from 720px it docks right at 480px wide with a 28px left curve, and its call-to-action bar follows it.
- **Review:** each found product stacks on phones; from 560px the crop editor and fields sit side by side.
- **Rhythm:** 8px chip gaps, 14px grid gap, 16px box padding, 20px gutter, 30px above section titles.

## Elevation & Depth

Depth is soft and ambient, tinted forest in Day and black in Night. There are no borders between surfaces; white things lift off the mint with `lift-sm`, and the big green things (cards, banner, primary buttons, toast, review panels) carry the deeper `lift`.

### Shadow Vocabulary
- **Lift** (`--lift`, `0 14px 30px -16px rgba(18, 73, 59, .45)`): product cards, banner, primary buttons, Bought & removed strip cards, review panels, the save button ring, toast, docked sheet.
- **Lift, small** (`--lift-sm`, `0 6px 16px -10px rgba(18, 73, 59, .5)`): circles, default buttons, inputs, chip icons, flags, pills, sheet boxes, list rows.
- **Bar shadow** (`drop-shadow(0 -8px 18px var(--bar-shadow))`): cast upward from the curved bottom bar.
- **Banner photo** (`0 18px 30px -12px rgba(0, 0, 0, .45)`): the item photo overflowing the banner.

### Named Rules
**The No-Line Rule.** Surfaces separate by tone and soft shadow, not borders. The only strokes are focus rings, the warning field, the drop-target dash and the crop frame.

## Shapes

Everything is generously rounded and nothing is square. The scale runs 12px (small buttons, fields, notes), 13px (chips, pills), 16px (buttons, search field), 18px (link field, call-to-action buttons, banner photo), 22px (cards, banner, boxes, list rows), 24px (save panel, review panels), 28px (sheet hero photo, docked sheet edge), with 50% circles and 999px pills for flags and state tags.

The defining silhouette is the **panel curve**: a product card is a forest shape with 22px corners, and its light photo panel inside has 22px top corners and 26px bottom corners, so the panel's rounded bottom curves into the green price footer. Photos inside the panel are inset 10px with 16px top and 12px bottom corners.

The second silhouette is the **bar dip**: the bottom bar is one SVG path (viewBox 390 by 124) with rounded top corners and a smooth dip in the middle where the raised save button sits.

Price bars use 8px top and 4px bottom corners.

## Components

### Buttons
Soft, pill-cornered, pressable.
- **Shape:** gently rounded (16px), 48px tall; small buttons 44px tall at 12px.
- **Primary:** forest with white text and the deeper lift; hover moves to forest-2. Call-to-action in the sheet: 56px tall, 18px corners, 15px text, next to a 56px square "Mark as bought" toggle that turns forest when pressed.
- **Default:** white with forest/title text and the small lift.
- **Sage:** sage with sage ink, no shadow (the Save button in the link field).
- **Deep:** forest-2 with white text, no shadow, for buttons placed on a forest panel.
- **Danger:** white with sale-red text ("Delete forever", "Remove", "Lock this device").
- **Press:** scale to 0.97 over 0.12s. Disabled: 50% opacity.
- **Link-ish:** forest/title text, 600, underlined in sage with a 3px offset.

### Circle buttons
White 46px circles with ink icons and the small lift: search, bag (with a forest count badge), back, remove. An expanded circle turns forest. The avatar is a forest 46px circle with a white "W" and a small green online dot.

### Chips
- **Style:** sage with sage ink, 44px tall, 13px corners, 500 weight, no shadow.
- **Selected:** forest with white text (`aria-pressed`).
- **Icon chip:** a white 44px square-ish chip with the small lift, holding the sort control (an invisible select over the icon).
- The "Look for it elsewhere" store search links in the sheet reuse the same chip.

### Product card (signature)
- **Corner style:** 22px outer; inner panel 22px top, 26px bottom.
- **Panel:** photo panel colour with a radial light spot; photo 1:1, inset 10px; below it the store line (11px, ink-2) and the two-line product name (card title, forest/title).
- **Footer:** forest, white tabular price with struck MRP in on-forest-3 beneath, or "No price yet" in on-forest-2; a 36px white go disc with a forest arrow opens the store.
- **Flag:** white pill top-left on the photo: green amount for a recent drop, red "% off" or "No price".
- **Behaviour:** tapping the photo or the go disc opens the store; tapping the name opens the item sheet. Loading cards breathe (opacity to 0.55, 1.4s alternate).

### Price-drop banner (signature)
A forest carousel card, 22px corners, at least 156px tall, with the dropped item's photo (120 by 168px, 18px corners) anchored bottom-right so it overflows the banner's top. A white tag above the top edge shows the amount saved in green. Text: "Price dropped" and a sentence with the new price in bold white. With several drops: left and right arrows and dot pagination (current dot widens to a 14px bar). With none: "No price drops yet", the rack total, and a forest-2 tile holding a hanger.

### Price history bars (signature)
Up to 24 bars, 96px tall, 6px gaps, each 6 to 34px wide with 8px top and 4px bottom corners. Forest for a fall, rose for a rise, sage for no change or the first point. Bars grow from the bottom (0.5s, 40ms stagger). An axis below shows first date, "Lowest" price and last date; a legend shows only directions that occur. A single price gets the caption "One price so far. Each morning's check adds a bar."

### Bought & removed
- **Strip card (home):** forest, 262px wide, 22px corners, 72 by 88px thumbnail at 14px corners, a state pill (white "Bought" with check, or translucent white "Removed"), name and meta in on-forest-3. Removed items dim their thumbnail to 55%.
- **List row (own view):** white, 22px corners, 84 by 104px thumbnail, state pill (forest "Bought", sage "Removed" with how long ago), name, meta, then two small buttons: "Put back" (or "Back to wishlist") and red "Delete forever", which asks "Tap again to delete" for 3 seconds before deleting.
- **Rule:** removing or marking bought moves an item here with an Undo toast; only "Delete forever" deletes.

### Inputs / Fields
- **Pill field:** white, 56px tall, 18px corners, small lift, 16px input text, with a button docked at the right (44px, 13px corners). Focus adds a 2.5px forest ring.
- **Form field:** page-mint fill, 46px tall, 12px corners, 16px 500 text, 11.5px label above. Focus turns the transparent 1.5px border forest. A missing price gets a dashed sale-red border on white with a red hint.
- **Checkbox:** 20px, forest accent.
- **Crop editor:** 9:16 frame, forest 2.5px crop box with 6px corners and white round corner handles; the outside darkens with forest at 45%.

### Navigation (signature)
- **Curved bottom bar:** fixed, centred, up to 560px wide, 104px tall plus safe area; one white SVG path with the middle dip, casting the bar shadow upward.
- **Raised save button:** a 66px white ring with the lift, holding a 52px forest core and white scan icon, sitting in the dip; presses to 0.92.
- **Tabs:** Home, Price drops, (gap), Bought & removed, Settings; 48px targets, ink-2 icons; the current tab turns forest/title with a 5px dot below.

### Sheets, boxes and settings
The item sheet rises (0.32s) over a dark-green shade, repeating the page gradient; its hero photo has 28px corners. Content sits in white boxes (22px corners, 16px padding, small lift); the "Waiting for you" and "You bought this" boxes invert to forest. Settings uses a segmented control on page-mint (15px track, 12px options) whose chosen option is forest. Status dots are 9px: green on, red off.

### Toast
Ink background with page text, 14px corners, the lift, rising above the bottom bar; an "Undo" action in sage. Hides after 5 seconds.

## Do's and Don'ts

### Do:
- **Do** put prices, primary actions and selected states on forest (#12493b), and keep supporting controls sage or white.
- **Do** build every product card as a light panel with a 26px rounded bottom curving into a forest price footer, with a white go disc to the store.
- **Do** keep one curved white bottom bar with the raised forest save button in its dip.
- **Do** use the three history colours exactly: forest fell, rose rose, sage no change.
- **Do** send removed and bought items to Bought & removed with Undo; reserve deletion for "Delete forever" with its tap-again confirmation.
- **Do** use the `--lift` and `--lift-sm` shadows for depth and let Night swap them to black.
- **Do** set every price and amount in tabular figures.
- **Do** show the hanger placeholder ("No photo yet") when there is no photo.

### Don't:
- **Don't** separate surfaces with borders or hairlines; use tone and soft shadow.
- **Don't** introduce a second strong accent; rose is for rising-price bars only and sale red is for discounts and errors.
- **Don't** add a second typeface or weights outside 400 to 700.
- **Don't** use square corners; buttons, chips and fields start at 12px (only small marks such as legend keys, the progress bar and the crop box go tighter).
- **Don't** fabricate product photos; placeholders show the hanger.
- **Don't** bring back anything from the old navy knitted world (stitch charts, ribbed edges, mustard, Bricolage Grotesque, Figtree).
