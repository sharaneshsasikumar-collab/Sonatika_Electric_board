# Electrical Building Generator

Small localhost web app for an electricity-board building connection and bill workflow.

## What Is Included

- Login demo: `admin` / `admin123`
- Consumer directory with edit/update flow
- Bill register and on-screen bill calculation
- New connection request submission
- Tariff slabs for residential, commercial, industrial, street light, public app, agriculture, and power plant categories
- Defaulter list from overdue bills
- Feedback form with simple special-character validation
- Expanded SQL schema and seed data in `data/schema.sql` and `data/seed.sql`
- Runtime JSON data store in `data/app-data.json`

## Folder Structure

```text
electric-building-generator/
  data/
    app-data.json
    schema.sql
    seed.sql
  docs/
  public/
    app.js
    index.html
    styles.css
  src/
    server.js
  package.json
  README.md
```

## Run Locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Use another port when needed:

```bash
PORT=3010 npm start
```

## Calculation Used

```text
Units Consumed = Current Reading - Previous Reading
Energy Charge = Units Consumed * Rate Per Unit
Tax = (Energy Charge + Fixed Charge) * Tax Percent
Total Amount = Energy Charge + Fixed Charge + Tax
```

The tariff slab is selected from the consumer connection type and consumed unit range.
