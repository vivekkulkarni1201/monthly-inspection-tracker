MONTHLY INSPECTION TRACKING PORTAL V5
======================================

V5 changes
----------
1. Fixed ugly/native month dropdown on dashboard with a custom dark month picker.
2. Removed the lower summary strip.
3. Brought the Monthly Inspection Register back onto the main dashboard.
4. KPI cards are more compact, brighter and fully neon-polished.
5. Vertiv branding remains integrated into the sidebar design rather than looking pasted-on.
6. Monthly graph now forces ALL 12 month labels to stay visible.
7. Product Type chart is now a premium donut with:
   - Qty
   - Percentage
   - Total in center
   - Clean legend
8. Issue Type Summary is now a premium donut with:
   - Qty
   - Percentage
   - Total in center
   - Clean legend
   - Proper empty state when no issues exist
9. Dashboard table supports direct edit links into register.html.
10. Modular structure remains:
   index.html      Dashboard
   register.html   Full monthly register
   admin.html      Admin / master data

UPLOAD / REPLACE ON GITHUB
--------------------------
index.html
styles.css
dashboard.js
register.js

The existing V4 files below can remain as they are:
config.js
core.js
register.html
admin.html
admin.js

If you prefer, uploading the full V5 ZIP contents is also safe.

AFTER GITHUB UPLOAD
-------------------
1. Wait around 1 minute.
2. Desktop: Ctrl + F5.
3. Mobile: close browser tab and reopen the GitHub Pages URL once.
4. Live Online should remain automatic because config.js already contains the browser-safe Supabase publishable key.

SECURITY
--------
Only the Supabase publishable key is used in config.js. Never add a Supabase secret key to GitHub.
