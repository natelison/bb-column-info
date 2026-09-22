# Bb Column Info

A Chrome/Edge extension for **Blackboard Learn Ultra**. Hover over a column header in the gradebook's grid view to see that column's settings without opening it.

![Icon](extension/icons/icon128.png)

## What it shows

**Regular view:** points possible, availability, grading type, due date, attempts allowed, scoring model, grading schema, gradebook category, whether the column is included in calculations, and the created and modified dates.

**Advanced view** (a switch in the overlay): everything in regular view, plus the column, content, schema, and category IDs, whether statistics are shown to students, and **Copy ID** and **Raw JSON** buttons for working with the Blackboard REST API.

## Install

1. Install from the Chrome Web Store: *(link coming soon)*
2. Open your institution's Blackboard site (any page under `/ultra`).
3. Click the extension icon, then click **Enable on this site**. Chrome asks for access to that one site only.
4. Open a course gradebook in grid view and hover over a column header.

You can remove a site at any time from the extension's popup.

## How it works

The extension reads column details from your Blackboard site's public REST API (`/learn/api/public/v2/courses/{courseId}/gradebook/columns/{columnId}`), using the Blackboard login you already have in the browser. You only see information your account can already access. See [PRIVACY.md](PRIVACY.md) for details.

It works with any institution's Blackboard Learn Ultra domain. Nothing runs until you enable your site.

## Repository layout

| Path | Contents |
|---|---|
| `extension/` | Manifest V3 extension source (load unpacked for development) |
| `userscript/` | Tampermonkey version of the same overlay |

## Development

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. After making changes, click the reload icon on the extension's card.

To build a store package, bump `version` in `extension/manifest.json` and zip the *contents* of `extension/`:

```bash
cd extension && zip -r ../bb-column-info-$(jq -r .version manifest.json).zip . -x ".*"
```

## Userscript alternative

If you'd rather not install the extension, install [Tampermonkey](https://www.tampermonkey.net/) and then open [`userscript/bb-gradebook-column-overlay.user.js`](userscript/bb-gradebook-column-overlay.user.js) (click **Raw**) to install the userscript.

## Disclaimer

This is an independent project. It is not affiliated with, endorsed by, or supported by Anthology Inc. or Blackboard. Blackboard and Blackboard Learn are trademarks of their respective owners.

## License

[MIT](LICENSE)
