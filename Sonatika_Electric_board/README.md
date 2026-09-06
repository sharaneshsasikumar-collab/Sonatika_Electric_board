# Sonatika Electricity Board

Class XII Computer Science final internal activity project using Python, SQLite, HTML, CSS and JavaScript.

The original Python and SQL files are preserved. The webpage is a separate presentation layer based on the supplied Figma designs:

- Landing page: Figma node `38:8`
- Consumer and administrator login: Figma node `38:84`
- Loading page: Figma node `60:4`
- Consumer dashboard: Figma node `38:119`
- Consumer bill payment flow: Figma node `38:1249`
- Payment confirmation and receipt: Figma node `38:1372`

## Run the webpage

Node.js 22.13 or newer is required. Install dependencies with `npm ci`. Local development uses SQLite; the Render deployment uses hosted PostgreSQL configured with `DATABASE_URL`.

```bash
npm ci
npm start
```

Open <http://localhost:3000>.

The sequence is: landing page → login → loading animation → role-based dashboard.

Consumers can sign in with their numeric consumer ID or meter ID. Sample meter IDs include `RES1001` and `COM2001`. After login, each consumer sees their own connection, consumption, and bill records. The My Connection page includes a meter-verified setting for correcting the consumer display name. An unpaid bill opens the secure demonstration payment flow and produces a printable payment confirmation receipt.

For the Class XII administrator demonstration, use administrator ID `ADMIN001` and password `SEB2026`. The authority dashboard provides access to the consumer and billing database, bill generation, tariff rates, and project information. Bill generation is available only in the administrator interface.

All Figma images are saved locally in `public/assets`.

## Run the original Python interface

```bash
python3 src/server.py
```

The Python menu provides Read, Write, Append, Update, Delete, Search and Exit operations for the local SQLite database. It honors `SONATIKA_DB`. It stops if `DATABASE_URL` is configured, so it cannot silently write records to a different database from the hosted website. Use the web administrator portal for hosted records.

## Check the webpage files

```bash
npm run check
```

This project is an educational demonstration. Payment marking changes only the sample database status and does not perform a real transaction.

## Persistent records on free Render hosting

Render's default filesystem is ephemeral: a redeploy or restart can replace the
SQLite file in the application directory with the committed sample database.
The browser previously kept a temporary list of generated bills, which could hide
missing server records until another device or a fresh page was used.

Keep the Render web service free and use a separate hosted PostgreSQL database.
[Neon's Free plan](https://neon.com/pricing) is one option within its usage limits.
[Render's filesystem documentation](https://render.com/docs/disks) explains why
local SQLite storage requires a persistent disk instead.

1. Create a free Neon project and copy its PostgreSQL connection string, keeping
   its SSL parameters. Do not put it in public JavaScript or commit it to Git.
2. Preserve the currently visible records before restarting or redeploying the
   old service. Save `/api/data` from the existing site as a private JSON backup,
   or back up its actual SQLite file. A copy of the database in Git can be older
   than the live records. Records already lost from ephemeral storage need an
   earlier backup or must be entered again.
3. In a local private `.env` file set `DATABASE_URL` to the connection string.
   From this project directory, run:

   ```bash
   npm ci
   node --env-file=.env scripts/import-postgres.mjs /absolute/path/to/live-backup.json
   ```

   The importer also accepts an existing `.db` file. It preserves consumer IDs,
   bill IDs, payment statuses, tariffs and readings. It runs in a transaction and
   refuses to overwrite any existing consumer, bill or reading records. Start
   with an empty destination database. The normal app startup creates tables and
   tariff definitions only; it never inserts sample customers or bills into
   PostgreSQL. Legacy orphan records are preserved during import.
4. In the existing Render service, configure:

   | Setting | Value |
   | --- | --- |
   | Root directory | `Sonatika_Electric_board` |
   | Build command | `npm ci --omit=dev` |
   | Start command | `npm start` |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | The same private PostgreSQL connection string |

   Remove any old `SONATIKA_DB` setting when using PostgreSQL. Deploy the updated
   code after the import and environment setup. The server binds to `0.0.0.0`
   and Render's `PORT`; phones use the public HTTPS URL.
5. Generate a test bill, open the same consumer on another phone, and confirm it
   appears. Record its payment and check that it moves from Unpaid to Paid.
   Restart the Render service and verify that the bill and receipt remain.

The `Bill` table is the authoritative record. `Unpaid_Bills` and `Paid_Bills` are
SQL views of that table, and the UI shows corresponding separate tables. Updating
payment status changes their membership without copying or deleting bills.
Transaction IDs, payment methods and dates are stored with the bill. Retrying a
payment preserves the original receipt. The UI reloads data on login, navigation,
window focus and every 30 seconds while viewing the dashboard or bill tables.

If `DATABASE_URL` is missing, production starts with the bundled SQLite database
so the website remains reachable. Render can reset new SQLite records after a
restart or deployment, so configure `DATABASE_URL` before relying on the billing
ledger for permanent records. Existing installations using a persistent SQLite
disk can set `SONATIKA_DB` to that database path.

Run `npm run check` and `npm test` for validation. Tests cover SQLite server
restarts and independent client requests, browser ledger behavior, and PostgreSQL
schema/import/query persistence using the PGlite PostgreSQL engine. They do not
provision a Neon account or verify the live Render deployment.
