# FlatCart Price Capture (browser extension)

A small Chrome extension that reads the price/stock you're already looking at on
Blinkit, Zepto, Instamart, or BigBasket and sends it straight to your FlatCart
shopping list — no retyping, no automation. It only reads the page when you click
the extension icon; it doesn't run in the background or on any other page.

This isn't published to the Chrome Web Store (that needs a developer account and
review), so each flatmate installs it locally in "developer mode" — takes under a
minute.

## Install

1. Download/clone this repo, or just this `extension/` folder.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `extension/` folder.
5. Pin it (puzzle-piece icon in the toolbar → pin FlatCart) so it's easy to reach.

## Use

1. Browse to a product page on Blinkit/Zepto/Instamart/BigBasket like normal.
2. Click the FlatCart extension icon.
3. First time: log in with your FlatCart account, then pick your household.
4. It'll guess the item name, price, and whether it's in stock from the page —
   check/edit the guess (it's a simple text scan, not always right), pick which
   shopping-list item it matches (or add it as new), and hit **Send to FlatCart**.
5. Open the FlatCart web app any time to see the updated price comparison and plan.

## Notes

- The price/name/stock guess is a best-effort text scan of the page — always glance
  at it before sending, especially on pages with multiple prices (offers, MRP vs
  selling price, etc).
- Your login token is stored locally in the browser via the extension's own storage,
  the same way the web app stores it.
- If you update `extension/` files, go to `chrome://extensions` and click the reload
  icon on the FlatCart card to pick up the changes.
