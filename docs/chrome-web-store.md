# Chrome Web Store listing

Upload `hairline-<version>.zip` (`npm run zip`) at https://chrome.google.com/webstore/devconsole, then fill in
the tabs below. The same zip works for Microsoft Edge Add-ons (https://partner.microsoft.com/dashboard/microsoftedge).

## Store listing
**Name:** Hairline: CSS Inspector & Dev Tools

**Summary** (from the manifest, max 132 characters):
15 tools to inspect, edit and export any website: CSS inspector, color picker, fonts, ruler, screenshots, Send to AI and more.

**Category:** Developer Tools · **Language:** English

**Description:**
```
Hairline puts 15 web design and development tools in your browser's side panel. Inspect any element's CSS, edit text and styles live, pick colors, measure layouts, swap fonts and export what you find.

FREE TOOLS
• CSS Inspector: hover any element to see its box model and styles
• Live Text Editor: edit any text on the page in place
• List All Fonts: every font family, weight and size used on the page
• Color Picker: pick any pixel and copy HEX, RGB or HSL
• Page Ruler: drag to measure anything in pixels
• Page Outliner: outline every element to see the HTML structure
• Delete Element: remove or hide anything, and undo any time
• Screenshot: capture the visible area or an element
• Send to AI: ask Claude, ChatGPT or Gemini about any element or page

HAIRLINE PRO ($29, one-time payment)
• Live CSS editing in the inspector, and full-page screenshots
• Fonts Changer: swap fonts on the whole page or a single element
• Color Palette: extract every color a website uses
• Move Element: drag elements to try new layouts
• Export Element: copy any element as standalone HTML + CSS
• Extract Images: find every image and download them all
• Image Replacer: swap any image with a file or URL
• More Send to AI prompts: recreate a component, edit it with words, accessibility review and style guide

One payment, no subscription. Use Pro in up to 3 browsers, with a 14-day money-back guarantee.

PRIVATE BY DESIGN
Hairline runs on your device. No accounts, no analytics, no tracking. Pages you inspect never leave your browser.

Works in Chrome, Microsoft Edge and Brave.
Website: https://bencounsell.com/hairline/
Support: support@bencounsell.com
```

**Graphics:** screenshots (1280×800, upload in order 1–5) and promo tiles (`promo-small.png` 440×280,
`promo-marquee.png` 1400×560) are in `docs/store/`, as 24-bit PNGs without alpha. Promo video: upload `product-tour.mp4` to YouTube (thumbnail: `docs/store/youtube-thumbnail.jpg`, 1280×720) and paste the link.

**Website:** https://bencounsell.com/hairline/ · **Support URL:** mailto:support@bencounsell.com

## Privacy practices
**Single purpose:** Hairline is a set of tools for inspecting, editing, measuring and exporting the design and
code of web pages you visit.

**Permission justifications:**
- `activeTab`: runs the tool the user picks on the current tab, only after they click the toolbar icon, a shortcut or the side panel.
- `scripting`: injects Hairline's tools (highlights, ruler, inspector) into the tab the user chose.
- `storage`: saves the user's settings and their Pro licence key on the device.
- `clipboardWrite`: copies colors, CSS and exported code to the clipboard when the user clicks copy.
- `downloads`: saves screenshots and extracted images to the user's Downloads folder.
- `sidePanel`: shows Hairline's tools in the browser side panel.
- Host permission `https://bencounsell.com/*`: checks a Pro licence key with Hairline's licence server.
- Optional host permission `<all_urls>`: only if the user turns on "Allow on all sites", so the side panel keeps working as they switch tabs and navigate.

**Remote code:** No, Hairline doesn't use remote code.

**Data usage:** tick nothing except **Authentication information** (the licence key sent to the licence server
to unlock Pro). Then certify all three statements: not sold to third parties, not used for unrelated purposes,
not used for creditworthiness or lending.

**Privacy policy URL:** https://bencounsell.com/privacy.html · **Terms:** https://bencounsell.com/terms.html

## After approval
Put the listing URL in `hairline/main.js` (`storeUrl`) in the bencounsell/bencounsell.com repo, and remove
`"status"` from Hairline in `content/products.json` there, then `npm run build`.
