# DeltaMagnus Hazard Hunt - auth, Employee IDs, quiz, walking inspector and percentage scoring

## First-time setup
1. Install Node 18+ and MongoDB (local) or create a MongoDB Atlas cluster.
2. `cp .env.example .env`, then set `MONGODB_URI` and a long random `JWT_SECRET`.
3. `npm install`
4. `npm run seed:admin` (creates the admin from ADMIN_* in `.env`)
5. `npm run seed:questions` (loads the 15-question quiz bank; safe to rerun)
6. `npm run check:ids` (confirms every model in the catalog has a game builder)
7. `npm start`, open http://localhost:3000

## Flow
Admin creates Employee IDs -> employee registers with an ID -> logs in -> welcome page (last 5 results) -> Start inspection -> 5-question quiz -> 3D inspection -> result screen -> back to welcome page.

## Company and IDs
Every account belongs to **DeltaMagnus** and has an ID. Employees get theirs from an admin-issued Employee ID. The admin gets `ADMIN_EMPLOYEE_ID` (default `ADM-001`) from `npm run seed:admin`, which also reserves it so it can't be issued to an employee. The company and ID appear on the register, welcome and admin pages, in the employee detail view and in the CSV export. Running `seed:admin` again adds the company and ID to an admin created by an earlier version.

## Playing: the walking inspector
The top-down orbit camera is gone. The employee controls a worker in the warehouse with a follow camera.
- **WASD** walk, **Shift** run, **mouse drag or arrow keys** turn the camera, **wheel** changes camera distance.
- Racks, vehicles and crates are solid; walls stop the player.
- Hotspots (hazards and look-alike safe objects) are inspected by standing close and pressing **E**, or by clicking the object within about 9 units. A "press E" prompt appears within about 4.5 units and does not say whether the object is a hazard or safe.
- Tune speeds, spawn point and ranges in `CONFIG.player` in `client/game-assets/js/config.js`.

## Randomised layouts
Every attempt gets its own layout, drawn by the server when the quiz is submitted and saved on the attempt (`layout`), so a reload shows the same scene.
- `server/lib/catalog.js` holds the hazard pool, the safe-object pool and the fixed floor **slots** (with tags `floor`, `aisle`, `near-rack`, `near-exit`, `wall`, `rack-top`). Building-tied objects (blocked exit, item on a rack) only fit their own slots.
- `server/lib/layout.js` draws 10 hazards and 5 safe objects: balanced difficulty (4 easy, 4 medium, 2 hard), at least one hazard per category, at least half new versus the employee's previous attempt (when the pool is big enough), objects 6+ units apart, none near the spawn point, and every object reachable on foot.
- The browser receives only `{id, model, x, y, z, rotY}`. Whether an object is a hazard, and its title and tip, come back from the server when it is inspected. Clicks on ids outside the attempt's layout are rejected.
- `npm run test:layout` runs 1,000 draws (real pool and a synthetic 20+8 pool) and checks every rule. `npm run check:ids` checks each catalog model has a builder in `client/game-assets/js/objects.js`.
- To add content: add a pool entry plus a builder, then run both checks. Never rename or remove an id that has been played.
- Attempts saved before this change have no layout; admin stats count them as the original fixed set.

## Certification and retake limits
A pass (60% or more) is a certificate, valid for 12 months from the date of the pass. All numbers live in `CERT` in `server/lib/certification.js`.
- **Certificate PDF** (name, company, Employee ID, score, grade, date issued, valid until, certificate number): employees download it from the welcome page, admins from the employee detail panel. Expired certificates are not issued; the employee retakes the inspection. Built with no dependencies in `server/lib/certificatePdf.js`.
- **Validity:** the certificate is stored on the passing attempt when it ends, so changing `validityMonths` later does not alter certificates already issued. Attempts that passed before this feature get a computed certificate dated from the day they finished.
- **Current certificate:** the employee's most recent passing attempt.
- **Admin dashboard:** a Certification section shows certified, expiring within 30 days, expired and not-yet-certified counts (active accounts), and lists everyone expiring or expired, soonest first. The employee table has a Certificate column. The CSV export adds certificate number and expiry.
- **Retake limits:** `maxAttemptsPerDay` (default 3) counts attempts whose quiz was submitted in any rolling 24 hours; the 4th is refused with the time it opens. `cooldownMinutes` (default 0, off) makes an employee wait after a failed attempt. Set either to 0 to turn it off.
- `npm run test:cert` checks expiry dates, the expiring-soon window, the retake limits and the PDF.

## Scoring (calculated on the server)
- 10 hazards, +10% each. 5 safe objects, -5% each (once per object). Score is 0-100%.
- Qualified at 60% or more. Ratings: S+ = 100%, A >= 85%, B >= 70%, C >= 60%, F below 60%.
- Time limit 2 minutes, measured by the server. Reloading the page resumes the same inspection and clock.
- Leaving mid-inspection ends the attempt with the score so far ("Left early"). There is no in-game restart: a new attempt means a new quiz.
- Tune the rules in `server/lib/inspection.js` (RULES) and, for display, `SCORING` in `client/game-assets/js/config.js`.

## Layout
- `server/` Express API, Mongoose models (User, EmployeeId, Question, Attempt), `lib/inspection.js` (scoring), seed scripts
- `client/views/` pages; `client/public/` shared CSS/JS; `client/game-assets/` the 3D game

## Admin portal
- Overview cards: employees, qualified employees, finished attempts, average score, attempt pass rate.
- Employee table with search (name, email or Employee ID). Select a row to see that employee's profile and their 5 most recent attempts, and to disable or re-enable the account.
- "Export all results (CSV)" downloads every finished attempt of every employee (not limited to 5).
- Most missed hazards, measured as "missed when it appeared" (with the difficulty tag next to it), and the Employee ID manager.

## Not done yet
Question-bank editor in the admin portal, password reset, email verification.
