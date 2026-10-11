MONTHLY INSPECTION TRACKING PORTAL V2
======================================

This is the polished GitHub-ready version.

WHAT CHANGED
------------
- Dark neon dashboard styling closer to the approved mockup
- Left navigation sidebar
- Stronger KPI cards
- Cleaner chart cards and white data table
- Better Admin screen
- Same functional data logic as V1
- GitHub Pages compatible
- Supabase realtime ready
- Local demo fallback retained until Supabase is connected

HOW TO MAKE IT ONLINE
---------------------
1. Create a Supabase project.
2. Run supabase.sql in Supabase SQL Editor.
3. Copy Project URL and anon key.
4. Open the portal -> Admin -> Supabase Online Connection.
5. Paste both values -> Save & Reload Online.
6. Confirm bottom message says LIVE ONLINE MODE.
7. Upload/replace these files in your GitHub repository:
   index.html
   styles.css
   app.js
   config.js
   supabase.sql
8. Enable GitHub Pages from main / root.

IMPORTANT
---------
The supplied SQL uses a simple internal-team policy where the anon key can read/write.
Use it only for an internal/trusted team URL. Proper Supabase Auth can be added later.
