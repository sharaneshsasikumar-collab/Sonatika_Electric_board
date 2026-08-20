# Student Electricity Bill App

Minimal plus-two student project using Python, SQLite, SQL, and basic HTML forms.

## Use Case

The app helps students understand a small electricity bill workflow:

- Add a consumer
- Calculate and save a bill from meter readings
- View consumers, bills, and tariff slabs
- Mark a bill as paid

## What Students Learn

- Python web server using the standard library
- SQLite database connection using `sqlite3`
- `CREATE TABLE`, `INSERT`, `SELECT`, `JOIN`, and `UPDATE`
- HTML forms with `GET` and `POST`
- Simple bill calculation

## Folder Structure

```text
Sonatika_Electric_board/
  data/
    schema.sql
    seed.sql
    sonatika.db       # created automatically when the app runs
  public/
    index.html
    styles.css
    app.js            # only a note; JavaScript is not required
  src/
    server.py
  package.json
```

## Run Locally

Use Python directly:

```bash
cd Sonatika_Electric_board
python3 src/server.py
```

Open:

```text
http://localhost:3000
```

You can also use npm if available:

```bash
cd Sonatika_Electric_board
npm start
```

## Bill Formula

```text
Units = Current Reading - Previous Reading
Energy Charge = Units * Rate Per Unit
Tax = (Energy Charge + Fixed Charge) * Tax Percent / 100
Total = Energy Charge + Fixed Charge + Tax
```

The rate is selected from the `Tariff` table based on connection type and units consumed.
