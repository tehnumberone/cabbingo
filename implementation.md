# Cabbingo implementation plan

Tick a box when a step is done and note the commit. Work happens on `experiment`; merging to `main` deploys the site to GitHub Pages.

## Architecture

- **Frontend:** Angular on GitHub Pages (`https://tehnumberone.github.io/cabbingo/`)
- **API:** Cloudflare Worker `cabbingo` (`https://cabbingo.tehnumberone87.workers.dev`), source in `worker/src/index.ts`
- **Database:** Cloudflare D1 `cabbingo` (WEUR), schema in `worker/schema.sql`
  - `users`, `sessions`, `boards` (one JSON config per board), `progress` (one row per team + tile), `images`
- **Shared rules:** `src/app/models/bingo.ts` holds the board model, scoring and validation, used by both the app and the worker. Test: `cd worker && npm run check`
- **Deploy the worker:** `cd worker && npx wrangler deploy`

### Free-tier constraints

- Workers Free allows 10ms of CPU per request, so password hashing uses 10k PBKDF2 rounds. Each hash stores its own round count, so this can be raised later.
- Images are stored in D1 (max 1MB each, 500MB database) instead of R2.
- D1 allows at most 100 bound parameters per query, so a board is capped at 50 captains.

## Phase 0: Move to Cloudflare

- [x] Worker with D1 database, TempleOSRS proxy moved in from `cloudflare.js` (`eac8bc5`)
- [x] Shared model and scoring with test (`eac8bc5`)
- [x] Frontend reads and writes the worker; board picked with `?board=<id>`, refreshes every 30s (`eac8bc5`)
- [x] Remove Firebase: packages, environment files, `server.js`, deploy secret step, dev proxy (`eac8bc5`)
- [x] Import season 3 from the Firebase export as an archived board (`worker/migrate.ts`)
- [x] Restore main's board layout and styles (`eac8bc5`)

## Phase 1: Accounts, encrypted passwords, admin

- [x] Register / log in / log out API with hashed passwords (`eac8bc5`)
- [x] Admin flag: admins can edit or delete any board, and edit archived boards after pressing "Edit archived board" (`eac8bc5`, `fba9f64`)
- [x] `/login` page; login kept across refreshes and re-checked on startup (`1771d10`)
- [x] Team captains are accounts instead of team passwords; owner, admins and captains can update progress (`1771d10`)
- [x] Banner: account button, "Edit progress" only for users who can edit (`1771d10`)
- [ ] Admin page: list users, grant or revoke admin. Until then:
      `npx wrangler d1 execute cabbingo --remote --command "UPDATE users SET is_admin=1 WHERE username='name'"`

## Phase 2: Create and configure boards on the site

- [x] Create / update / delete board API with validation (`eac8bc5`)
- [x] Board list page at `/`: active boards and archive, "Create a bingo" when logged in, settings link for owner/admin (`b21e7da`)
- [x] Board page moved to `/board?board=<id>` with "All boards", "Edit progress" and "Board settings" buttons (`b21e7da`)
- [x] Board editor at `/manage-board` (new) and `/manage-board?board=<id>` (edit), owner and admins only: (`b21e7da`)
  - [x] Title, description, rules, start and end date
  - [x] Board size (3×3 to 10×10); growing adds placeholder tiles, shrinking keeps the first size² tiles
  - [x] Teams: name, players added one at a time (removable), captains picked from the players in a dropdown (a captain needs an account with the same name)
  - [x] TempleOSRS competition ID (optional)
  - [x] Row and column bonus, buy-in, donations
- [x] Delete board from the settings page (owner/admin); requires typing the exact bingo title, checked by the worker too (`b21e7da`, `fba9f64`)
- [x] Bingo description opens from a 16×16 info icon next to the title (board page and list) (`46c0e93`)

## Phase 3: Tiles and uploads

- [x] Image upload API: png/jpeg/gif/webp, max 1MB (`eac8bc5`)
- [x] Custom tile type: free-text criteria, ticked complete by hand (model, scoring, progress page) (`eac8bc5`)
- [x] Tile editor in board settings: pick a tile from a grid, edit title, description, rules, points, type, amount, criteria (`4552301`)
- [x] Upload tile icon and boss preview from the editor, or paste an image URL; type and 1MB checked before upload (`4552301`)
- [x] Per-item progress: a tile can list tracked items, captains enter a count per item, board shows the breakdown; tiles without items keep one "Obtained" count (`4552301`)
- [x] "Use existing" next to upload: pick from the shared library of uploaded images instead of uploading duplicates (`7b9837d`)
- [x] The picker also lists images boards already link to (wiki URLs, repo assets like `./assets/x.png`); unused links never appear, and the admin page still lists uploads only (`f997299`)
- [x] Admin page `/admin/images` (linked from the account page): thumbnails, uploader, date, size, which bingos use each image, delete with a warning when in use (`7b9837d`)

## Phase 4: Archive

- [x] Board counts as archived once the end date passes; worker refuses edits (admins excepted) (`eac8bc5`)
- [x] Anyone can view any board without logging in (`eac8bc5`)
- [x] Board list page shows the archive (`b21e7da`)
- [x] Archived bingos are read-only by default for everyone: no "Edit progress" button for non-admins, progress page says "Progress is locked", settings show a read-only notice instead of the form (`fba9f64`)
- [x] Admins unlock an archived bingo per visit with "Edit archived board" (progress and settings), with a warning while editing, to prevent misclicks (`fba9f64`)

## Rule formatting

- [x] BBCode-style markup for bingo and tile rules: `[color=green|red|orange]`, `[u]`, `[s]`, and `* ` for bullet lines; no colour = white (`cb92c7d`)
- [x] Rules render as text nodes, never as HTML, so nothing can be injected; unknown tags stay visible as plain text (`cb92c7d`)
- [x] Toolbar above both rule boxes (colours, underline, strikethrough, list) that wraps the selection, with a live preview (`cb92c7d`)
- [x] Season 3 rules converted to the new markup, so the board looks unchanged (`cb92c7d`)
- [x] Every formatting button toggles: pressing it again removes the tag, and another colour swaps it (`3c04270`)
- [x] "Clear formatting" button (selection, or the current line when nothing is selected) and six colours: green, red, orange, yellow, cyan, purple (`3c04270`)

## Phase 5: Flip tiles

- [x] Scoring: all-or-nothing (flipped side not done = 0 points) and keep (keeps original points); flipped side done = double points (`eac8bc5`)
- [x] Worker: only completed tiles can be flipped, flipped tiles can't be unflipped except by owner/admin (`eac8bc5`)
- [x] Settings: flipping off / all-or-nothing / keep points, and a flipped side per tile with all the same fields (title, type, amount, items, criteria, rules, images) (`f76b7b4`)
- [x] Progress page: "Flip tile" appears only once the front is done, warns what flipping costs and pays, then the row switches to the flipped side (`f76b7b4`)
- [x] Board: flipped tiles show the flipped side with an orange outline, the info box marks them, and scoring follows the flip mode (`f76b7b4`)

## Cleanup and follow-ups

Deploying is on hold (asked 2026-09-19): `experiment` is not merged, so the live site still runs the old Firebase build.
Everything below in this group has to wait for that deploy, in this order:

1. [x] Merged into `main` and deployed on 2026-09-19. The 28 commits were rewritten so none touches `.github/workflows/` (GitHub refuses that without the `workflow` token scope); the workflow itself was updated through GitHub's web editor. Original history kept on the local `backup-before-rewrite` branch.
2. [x] Old `steep-unit-c896` worker deleted; it returns 404 and nothing references it
3. [ ] Remove the `FIREBASE_DETAILS` GitHub secret (main's workflow still reads it) and shut down the Firebase project
4. [ ] Revoke the Firebase admin key (`cabbingo-db-firebase-adminsdk-…json` in Downloads)

- [ ] Assign captains to season 3 (archived, so an admin has to press "Edit archived board" first; optional)
- [x] Login and register throttled: 10 attempts per IP, then a 15 minute cooldown with the time left in the message; a successful login clears the counter. Counted in D1, since Cloudflare's rate limit binding is a no-op on this plan (`a498834`, `3c04270`)
- [x] Team MVP and member names: use the username when TempleOSRS returns a dashed slug as the capitalised name (`a498834`)
