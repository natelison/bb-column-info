# Changelog

All notable changes to Bb Column Info. The extension and the Tampermonkey userscript share the same features but have separate version numbers.

## Extension

### 1.1.0 (2026-10-08)
**Added**
- Points possible in the gradebook grid. Each graded column shows "100 points", "1 point", etc. in a gray band under its header, like the old gradebook.
- **Show points in grid** switch in the popup (on by default). Changes apply to open gradebook tabs right away.

### 1.0.1 (2026-09-22)
**Fixed**
- The overlay now works right after you click **Enable on this site**, without reloading the page.

### 1.0.0 (2026-09-22)
**Added**
- Hover a column header in the Ultra gradebook grid view to see its settings: points, availability, grading type, due date, attempts, scoring model, schema, category, calculation settings, and created/modified dates.
- Advanced view with column, content, schema and category IDs, plus Copy ID and Raw JSON buttons.
- Works on any institution's Blackboard Learn Ultra site. Runs only on sites the user enables from the popup.

## Userscript

### 1.4.0 (2026-10-08)
**Added**
- Points possible in the gradebook grid, matching extension 1.1.0.
- **Show points in grid** toggle in the Tampermonkey menu.

**Changed**
- Runs on all `/ultra/` pages and checks for the gradebook in code, so it works when you click into a gradebook instead of loading it directly.

### 1.3.0
**Changed**
- Uses the current site's address instead of a hard-coded FVTC URL, so it works on any Blackboard Learn Ultra site.

### 1.2.0
**Added**
- Regular and Advanced views, with the choice remembered between visits.

### 1.1.0
**Changed**
- Restyled the overlay to match Ultra's light theme.

### 1.0.0
- First version: column details overlay on gradebook header hover.
