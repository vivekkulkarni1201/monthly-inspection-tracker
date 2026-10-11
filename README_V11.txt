MONTHLY INSPECTION TRACKER — V11 HISTORY PATCH
================================================

CHANGES
-------
1. Register month selector is now the same dark custom selector as the dashboard.
   No white native month list.
2. Month selection supports January 2024 through December 2026.
3. Branding:
   - Removed the custom/cut Vertiv V.
   - Uses the supplied orange Vertiv reference art directly.
   - Keep it Humming is on ONE line.
   - Artwork is embedded inside styles.css, so no image file can go missing.
4. Historical Back Entry added to Admin:
   - Month
   - Planned inspections
   - Completed inspections
   - Total UPS offered
   - UPS inspected/completed
   - Total UPS manufactured
   - Delayed / Cancelled / Waiver UPS
   - Remarks
   - UPS type-wise quantity
   - Issue type + quantity + remarks
   - Saved-history list with Edit/Delete
5. Dashboard reads consolidated historical data for older months.
6. Monthly graph shows Jan-Dec of the SELECTED YEAR (2024, 2025 or 2026).
7. For historical-only months the dashboard shows a compact Planned / Completed / UPS Offered / UPS Inspected banner.

FIRST RUN — IMPORTANT
---------------------
Run `supabase_history_patch.sql` ONCE in:
Supabase -> SQL Editor -> New Query -> paste -> Run

THEN GITHUB REPLACE/UPLOAD
--------------------------
index.html
register.html
admin.html
styles.css
core.js
dashboard.js
register.js
admin.js
supabase_history_patch.sql

No change required to config.js.

HOW TO ENTER OLD DATA
---------------------
Admin -> Historical Back Entry
Choose month from 2024-01 to 2026-12.
Enter aggregate figures, product type quantities and issues.
Save Historical Month.

The dashboard will automatically use that history when a month has no detailed live inspection rows.
