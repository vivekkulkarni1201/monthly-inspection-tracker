MONTHLY INSPECTION TRACKING PORTAL V3
======================================

This version fixes the Supabase "Invalid API key" startup problem and improves the UI.

IMPORTANT SUPABASE FIX
----------------------
In Admin -> Supabase Online Connection:
- Project URL can be pasted as either:
  https://xxxx.supabase.co
  OR
  SUPABASE_URL=https://xxxx.supabase.co
- Publishable key can be pasted as either:
  sb_publishable_...
  OR
  SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

The portal automatically strips the variable name and spaces.

DO NOT paste SUPABASE_SECRET_KEY.

IF THE OLD VERSION SAVED A BAD KEY
----------------------------------
Open Admin -> Supabase Online Connection -> Clear Saved Key.
Then paste the Project URL and Publishable key again.
Use Test Connection before Save & Reload Online.

GITHUB UPDATE
-------------
Replace these files in the GitHub repository:
- index.html
- styles.css
- app.js
- config.js
- supabase.sql

Keep all files in repository root.

AESTHETIC CHANGES
-----------------
- Smaller KPI cards
- Integrated Vertiv-style header logo/wordmark
- Cleaner dark neon dashboard
- Better spacing and compact tables
- Redesigned horizontal Issue Type chart
- Connection status indicator and non-blocking error banner
