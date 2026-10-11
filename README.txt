MONTHLY INSPECTION TRACKING PORTAL V4 - MODULAR PATCH
=====================================================

WHY THIS PATCH
--------------
1. Mobile was showing LOCAL MODE because the Supabase settings were previously stored in browser localStorage.
2. This V4 stores ONLY the safe Supabase Project URL + Publishable Key in config.js.
   Therefore GitHub Pages connects automatically on every mobile/laptop.
3. The app is split into separate HTML pages like your QR projects:
   - index.html      = Dashboard
   - register.html   = Monthly inspection register
   - admin.html      = Admin / masters
   Future changes to one page are easier and do not require changing the whole portal.
4. KPI cards are smaller and cleaner.
5. Product, monthly and issue graphs are redesigned/polished.
6. Issue chart has a clean empty state when there are no issues.

UPLOAD / REPLACE THESE FILES ON GITHUB
--------------------------------------
index.html
register.html
admin.html
styles.css
config.js
core.js
dashboard.js
register.js
admin.js

You may leave supabase.sql in the repository unchanged.

IMPORTANT
---------
config.js contains ONLY the browser-safe Publishable key. Never put a Supabase secret key in GitHub.

AFTER UPLOAD
------------
1. Wait about 1 minute for GitHub Pages.
2. Hard refresh desktop: Ctrl+F5.
3. On mobile, close/reopen the page or clear site cache once.
4. Dashboard left bottom should show "Live Online".
5. Open register.html on mobile and add/edit a test row.
