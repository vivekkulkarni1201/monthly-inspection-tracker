MONTHLY INSPECTION TRACKING PORTAL
===================================

What is included
----------------
- Working responsive inspection dashboard
- Monthly KPIs:
  Total UPS Manufactured / Offered for Inspection / Completed / Delayed / Cancelled / Waiver
- Monthly graph: Manufactured vs Offered for Inspection
- Inspection-by-product-type chart
- Issue-type summary
- Editable inspection register with:
  Customer/Project, Qty, kVA, UPS Type, Engineer, Planned Date,
  Revised Date 1-5, Actual Date, Status, Issue Type, Issue at the Time, Remarks
- Admin masters:
  Authorized Engineers, UPS Types, Issue Types
- Monthly Total UPS Manufactured input
- Existing Excel history import
- Excel export
- Local demo mode
- Supabase realtime online mode

QUICK TEST
----------
Open index.html in Chrome/Edge.
It works immediately in LOCAL DEMO MODE using browser storage.

MAKE IT ALWAYS ONLINE / MULTI-USER
----------------------------------
1. Create a new Supabase project.
2. In Supabase -> SQL Editor, paste and run `supabase.sql`.
3. In Supabase -> Project Settings -> API, copy:
   - Project URL
   - anon/public key
4. Open the portal -> Admin -> Online Connection.
5. Paste URL + anon key -> Save & Reload.
6. Test that the footer says LIVE ONLINE MODE.
7. Deploy the whole folder to Netlify:
   - login to Netlify
   - Add new site -> Deploy manually
   - drag the `inspection_portal` folder or the ZIP
8. Share the Netlify URL with the team.

REALTIME
--------
When the Supabase connection is configured, inspection changes made by one user
are stored in the cloud and the other users refresh automatically.

IMPORTANT SECURITY NOTE
-----------------------
The supplied SQL uses a deliberately simple team policy: the anon key can read/write.
This keeps setup easy for a trusted internal team. For a public internet URL, add proper
Supabase Auth and restrictive RLS before sharing outside the organization.
