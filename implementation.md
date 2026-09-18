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

- [x] Worker with D1 database, TempleOSRS proxy moved in from `cloudflare.js` (`35730bc`)
- [x] Shared model and scoring with test (`35730bc`)
- [x] Frontend reads and writes the worker; board picked with `?board=<id>`, refreshes every 30s (`35730bc`)
- [x] Remove Firebase: packages, environment files, `server.js`, deploy secret step, dev proxy (`35730bc`)
- [x] Import season 3 from the Firebase export as an archived board (`worker/migrate.ts`)
- [x] Restore main's board layout and styles (`35730bc`)

## Phase 1: Accounts, encrypted passwords, admin

- [x] Register / log in / log out API with hashed passwords (`35730bc`)
- [x] Admin flag: admins can edit or delete any board, and edit archived boards after pressing "Edit archived board" (`35730bc`, `1383616`)
- [x] `/login` page; login kept across refreshes and re-checked on startup (`9910b11`)
- [x] Team captains are accounts instead of team passwords; owner, admins and captains can update progress (`9910b11`)
- [x] Banner: account button, "Edit progress" only for users who can edit (`9910b11`)
- [ ] Admin page: list users, grant or revoke admin. Until then:
      `npx wrangler d1 execute cabbingo --remote --command "UPDATE users SET is_admin=1 WHERE username='name'"`

## Phase 2: Create and configure boards on the site

- [x] Create / update / delete board API with validation (`35730bc`)
- [x] Board list page at `/`: active boards and archive, "Create a bingo" when logged in, settings link for owner/admin (`121afe1`)
- [x] Board page moved to `/board?board=<id>` with "All boards", "Edit progress" and "Board settings" buttons (`121afe1`)
- [x] Board editor at `/manage-board` (new) and `/manage-board?board=<id>` (edit), owner and admins only: (`121afe1`)
  - [x] Title, description, rules, start and end date
  - [x] Board size (3×3 to 10×10); growing adds placeholder tiles, shrinking keeps the first size² tiles
  - [x] Teams: name, players added one at a time (removable), captains picked from the players in a dropdown (a captain needs an account with the same name)
  - [x] TempleOSRS competition ID (optional)
  - [x] Row and column bonus, buy-in, donations
- [x] Delete board from the settings page (owner/admin); requires typing the exact bingo title, checked by the worker too (`121afe1`, `1383616`)
- [x] Bingo description opens from a 16×16 info icon next to the title (board page and list) (`f8781b3`)

## Phase 3: Tiles and uploads

- [x] Image upload API: png/jpeg/gif/webp, max 1MB (`35730bc`)
- [x] Custom tile type: free-text criteria, ticked complete by hand (model, scoring, progress page) (`35730bc`)
- [x] Tile editor in board settings: pick a tile from a grid, edit title, description, rules, points, type, amount, criteria (`ed801b1`)
- [x] Upload tile icon and boss preview from the editor, or paste an image URL; type and 1MB checked before upload (`ed801b1`)
- [x] Per-item progress: a tile can list tracked items, captains enter a count per item, board shows the breakdown; tiles without items keep one "Obtained" count (`ed801b1`)
- [x] "Use existing" next to upload: pick from the shared library of uploaded images instead of uploading duplicates (`09509a0`)
- [x] Admin page `/admin/images` (linked from the account page): thumbnails, uploader, date, size, which bingos use each image, delete with a warning when in use (`09509a0`)

## Phase 4: Archive

- [x] Board counts as archived once the end date passes; worker refuses edits (admins excepted) (`35730bc`)
- [x] Anyone can view any board without logging in (`35730bc`)
- [x] Board list page shows the archive (`121afe1`)
- [x] Archived bingos are read-only by default for everyone: no "Edit progress" button for non-admins, progress page says "Progress is locked", settings show a read-only notice instead of the form (`1383616`)
- [x] Admins unlock an archived bingo per visit with "Edit archived board" (progress and settings), with a warning while editing, to prevent misclicks (`1383616`)

## Rule formatting

- [x] BBCode-style markup for bingo and tile rules: `[color=green|red|orange]`, `[u]`, `[s]`, and `* ` for bullet lines; no colour = white (`5de9423`)
- [x] Rules render as text nodes, never as HTML, so nothing can be injected; unknown tags stay visible as plain text (`5de9423`)
- [x] Toolbar above both rule boxes (colours, underline, strikethrough, list) that wraps the selection, with a live preview (`5de9423`)
- [x] Season 3 rules converted to the new markup, so the board looks unchanged (`5de9423`)
- [ ] Optional later: "clear formatting" button, more colours

## Phase 5: Flip tiles

- [x] Scoring: all-or-nothing (flipped side not done = 0 points) and keep (keeps original points); flipped side done = double points (`35730bc`)
- [x] Worker: only completed tiles can be flipped, flipped tiles can't be unflipped except by owner/admin (`35730bc`)
- [x] Settings: flipping off / all-or-nothing / keep points, and a flipped side per tile with all the same fields (title, type, amount, items, criteria, rules, images) (`6d786c0`)
- [x] Progress page: "Flip tile" appears only once the front is done, warns what flipping costs and pays, then the row switches to the flipped side (`6d786c0`)
- [x] Board: flipped tiles show the flipped side with an orange outline, the info box marks them, and scoring follows the flip mode (`6d786c0`)

## Cleanup and follow-ups

Deploying is on hold (asked 2026-09-19): `experiment` is not merged, so the live site still runs the old Firebase build.
Everything below in this group has to wait for that deploy, in this order:

1. [ ] Merge `experiment` into `main` and push (GitHub Actions rebuilds the GitHub Pages site)
2. [ ] Delete the old `steep-unit-c896` worker (the live site uses it until the deploy happens)
3. [ ] Remove the `FIREBASE_DETAILS` GitHub secret (main's workflow still reads it) and shut down the Firebase project
4. [ ] Revoke the Firebase admin key (`cabbingo-db-firebase-adminsdk-…json` in Downloads)

- [ ] Assign captains to season 3 (archived, so an admin has to press "Edit archived board" first; optional)
- [x] Login and register throttled to 10 attempts per IP per minute, counted in D1 (Cloudflare's rate limit binding is a no-op on this plan) (`a441771`)
- [x] Team MVP and member names: use the username when TempleOSRS returns a dashed slug as the capitalised name (`a441771`)
