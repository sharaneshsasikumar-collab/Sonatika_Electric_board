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

Node.js 22.13 or newer is required. No npm packages need to be installed.

```bash
npm start
```

Open <http://localhost:3000>.

The sequence is: landing page → login → loading animation → role-based dashboard.

Consumers can sign in with their numeric consumer ID or meter ID. Sample meter IDs include `RES1001` and `COM2001`. After login, each consumer sees their own connection, consumption, and bill records. An unpaid bill opens the secure demonstration payment flow and produces a printable payment confirmation receipt.

For the Class XII administrator demonstration, use administrator ID `ADMIN001` and password `SEB2026`. The authority dashboard provides access to the consumer and billing database, bill generation, tariff rates, and project information. Bill generation is available only in the administrator interface.

All Figma images are saved locally in `public/assets`.

## Run the original Python interface

```bash
python3 src/server.py
```

The Python menu provides Read, Write, Append, Update, Delete, Search and Exit operations.

## Check the webpage files

```bash
npm run check
```

This project is an educational demonstration. Payment marking changes only the sample database status and does not perform a real transaction.
