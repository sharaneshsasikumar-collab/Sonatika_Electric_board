from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
import html
import sqlite3


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PUBLIC_DIR = ROOT / "public"
DB_FILE = DATA_DIR / "sonatika.db"
SCHEMA_FILE = DATA_DIR / "schema.sql"
SEED_FILE = DATA_DIR / "seed.sql"
PORT = 3000
UNPAID_STATUS = (
    "if the bill is not paid then you connection will be disconnected/"
    "உங்கள் பில் செலுத்தப்படாவிட்டால் உங்கள் இணைப்பு துண்டிக்கப்படும்"
)


def get_connection():
    connection = sqlite3.connect(DB_FILE)
    connection.row_factory = sqlite3.Row
    return connection


def setup_database():
    DATA_DIR.mkdir(exist_ok=True)
    with get_connection() as connection:
        connection.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
        migrate_database(connection)
        consumer_count = connection.execute("SELECT COUNT(*) FROM Consumers").fetchone()[0]
        if consumer_count == 0:
            connection.executescript(SEED_FILE.read_text(encoding="utf-8"))


def migrate_database(connection):
    connection.execute("PRAGMA foreign_keys = OFF")

    consumer_columns = {
        row["name"] for row in connection.execute("PRAGMA table_info(Consumers)")
    }

    if "Address" not in consumer_columns:
        connection.execute("ALTER TABLE Consumers ADD COLUMN Address TEXT NOT NULL DEFAULT ''")
        consumer_columns.add("Address")

    if "Place" in consumer_columns:
        connection.execute(
            "UPDATE Consumers SET Address = Place WHERE Address = '' AND Place IS NOT NULL"
        )
        rebuild_consumers_table(connection)

    connection.execute(
        """
        UPDATE Bill
        SET Status = ?
        WHERE Status IN (
            'Due',
            'Not Paid Bill Please pay ,then connection will be disconnected.| கட்டணம் செலுத்தப்படவில்லை; தயவுசெய்து செலுத்தவும், இல்லையெனில் இணைப்பு துண்டிக்கப்படும்.'
        )
        """,
        (UNPAID_STATUS,),
    )

    bill_sql = table_sql(connection, "Bill")
    if "DEFAULT 'Due'" in bill_sql:
        rebuild_bill_table(connection)


def table_sql(connection, table_name):
    row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row["sql"] if row else ""


def rebuild_consumers_table(connection):
    connection.execute("DROP TABLE IF EXISTS Consumers_new")
    connection.execute(
        """
        CREATE TABLE Consumers_new (
            C_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Customer_Name TEXT NOT NULL,
            Address TEXT NOT NULL,
            Phone TEXT,
            Meter_ID TEXT NOT NULL UNIQUE,
            Connection_Type TEXT NOT NULL DEFAULT 'Residential'
        )
        """
    )
    connection.execute(
        """
        INSERT INTO Consumers_new
            (C_ID, Customer_Name, Address, Phone, Meter_ID, Connection_Type)
        SELECT
            C_ID,
            Customer_Name,
            COALESCE(NULLIF(Address, ''), Place, ''),
            Phone,
            Meter_ID,
            Connection_Type
        FROM Consumers
        """
    )
    connection.execute("DROP TABLE Consumers")
    connection.execute("ALTER TABLE Consumers_new RENAME TO Consumers")


def rebuild_bill_table(connection):
    connection.execute("DROP TABLE IF EXISTS Bill_new")
    connection.execute(
        """
        CREATE TABLE Bill_new (
            B_ID INTEGER PRIMARY KEY AUTOINCREMENT,
            C_ID varchar(7) NOT NULL,
            Bill_Month TEXT NOT NULL,
            Previous_Reading REAL NOT NULL,
            Current_Reading REAL NOT NULL,
            Units_Consumed REAL NOT NULL,
            Rate_Per_Unit REAL NOT NULL,
            Total_Amt REAL NOT NULL,
            Status TEXT NOT NULL DEFAULT 'if the bill is not paid then you connection will be disconnected/உங்கள் பில் செலுத்தப்படாவிட்டால் உங்கள் இணைப்பு துண்டிக்கப்படும்',
            FOREIGN KEY (C_ID) REFERENCES Consumers(C_ID)
        )
        """
    )
    connection.execute(
        """
        INSERT INTO Bill_new
            (B_ID, C_ID, Bill_Month, Previous_Reading, Current_Reading,
             Units_Consumed, Rate_Per_Unit, Total_Amt, Status)
        SELECT
            B_ID,
            C_ID,
            Bill_Month,
            Previous_Reading,
            Current_Reading,
            Units_Consumed,
            Rate_Per_Unit,
            Total_Amt,
            CASE WHEN Status = 'Due' THEN ? ELSE Status END
        FROM Bill
        """,
        (UNPAID_STATUS,),
    )
    connection.execute("DROP TABLE Bill")
    connection.execute("ALTER TABLE Bill_new RENAME TO Bill")


def money(value):
    return round(float(value), 2)


def format_money(value):
    return f"Rs. {money(value):,.2f}"


def esc(value):
    return html.escape(str(value or ""), quote=True)


def field(form, name):
    return form.get(name, [""])[0].strip()


def redirect(path="/", **query):
    location = path
    clean_query = {key: value for key, value in query.items() if value}
    if clean_query:
        location = f"{location}?{urlencode(clean_query)}"
    return location


def find_tariff(connection, connection_type, units):
    return connection.execute(
        """
        SELECT *
        FROM Tariff
        WHERE Connection_Type = ?
          AND ? BETWEEN Min_Units AND Max_Units
        LIMIT 1
        """,
        (connection_type, units),
    ).fetchone()


def add_consumer(form):
    name = field(form, "name")
    address = field(form, "address")
    phone = field(form, "phone")
    meter_id = field(form, "meter_id")
    connection_type = field(form, "connection_type") or "Residential"

    if not name or not address or not meter_id:
        return redirect("/", error="Name, address, and meter ID are required.")

    with get_connection() as connection:
        try:
            connection.execute(
                """
                INSERT INTO Consumers
                    (Customer_Name, Address, Phone, Meter_ID, Connection_Type)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, address, phone, meter_id, connection_type),
            )
        except sqlite3.IntegrityError:
            return redirect("/", error="Meter ID already exists.")

    return redirect("/", message="Consumer added successfully.")


def add_bill(form):
    consumer_id = field(form, "consumer_id")
    bill_month = field(form, "bill_month") or "Current Month"

    try:
        previous_reading = float(field(form, "previous_reading"))
        current_reading = float(field(form, "current_reading"))
    except ValueError:
        return redirect("/", error="Readings must be valid numbers.")

    if current_reading < previous_reading:
        return redirect("/", error="Current reading cannot be less than previous reading.")

    units = money(current_reading - previous_reading)

    with get_connection() as connection:
        consumer = connection.execute(
            "SELECT * FROM Consumers WHERE C_ID = ?",
            (consumer_id,),
        ).fetchone()
        if consumer is None:
            return redirect("/", error="Please select a valid consumer.")

        tariff = find_tariff(connection, consumer["Connection_Type"], units)
        if tariff is None:
            return redirect("/", error="No tariff is available for these units.")

        energy_charge = money(units * tariff["Rate_Per_Unit"])
        fixed_charge = money(tariff["Fixed_Charge"])
        tax = money((energy_charge + fixed_charge) * tariff["Tax_Percent"] / 100)
        total = money(energy_charge + fixed_charge + tax)

        connection.execute(
            """
            INSERT INTO Bill
                (C_ID, Bill_Month, Previous_Reading, Current_Reading, Units_Consumed,
                 Rate_Per_Unit, Total_Amt, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                consumer_id,
                bill_month,
                previous_reading,
                current_reading,
                units,
                tariff["Rate_Per_Unit"],
                total,
                UNPAID_STATUS,
            ),
        )

    return redirect("/", message=f"Bill saved. Units: {units}, Total: Rs. {total}")




def mark_paid(form):
    bill_id = field(form, "bill_id")
    with get_connection() as connection:
        connection.execute(
            "UPDATE Bill SET Status = 'Paid' WHERE B_ID = ?",
            (bill_id,),
        )
    return redirect("/", message="Bill marked as paid.")


def build_options(consumers):
    rows = []
    for consumer in consumers:
        label = f"{consumer['Customer_Name']} ({consumer['Meter_ID']})"
        rows.append(f"<option value='{consumer['C_ID']}'>{esc(label)}</option>")
    return "\n".join(rows)


def build_consumer_rows(consumers):
    if not consumers:
        return "<tr><td colspan='5'>No consumers yet.</td></tr>"

    rows = []
    for consumer in consumers:
        rows.append(
            "<tr>"
            f"<td>{consumer['C_ID']}</td>"
            f"<td>{esc(consumer['Customer_Name'])}</td>"
            f"<td>{esc(consumer['Address'])}</td>"
            f"<td>{esc(consumer['Meter_ID'])}</td>"
            f"<td>{esc(consumer['Connection_Type'])}</td>"
            "</tr>"
        )
    return "\n".join(rows)


def build_bill_rows(bills):
    if not bills:
        return "<tr><td colspan='8'>No bills generated yet.</td></tr>"

    rows = []
    for bill in bills:
        paid = bill["Status"] == "Paid"
        status_label = "Paid" if paid else "Pending"
        status_class = "paid" if paid else "pending"
        action = ""
        if not paid:
            action = (
                "<form method='post' action='/mark-paid'>"
                f"<input type='hidden' name='bill_id' value='{bill['B_ID']}'>"
                "<button type='submit'>Paid</button>"
                "</form>"
            )

        rows.append(
            "<tr>"
            f"<td>{bill['B_ID']}</td>"
            f"<td>{esc(bill['Customer_Name'])}</td>"
            f"<td>{esc(bill['Bill_Month'])}</td>"
            f"<td>{bill['Units_Consumed']}</td>"
            f"<td>Rs. {bill['Rate_Per_Unit']}</td>"
            f"<td>{format_money(bill['Total_Amt'])}</td>"
            f"<td><span class='status-pill {status_class}' title='{esc(bill['Status'])}'>{status_label}</span></td>"
            f"<td>{action}</td>"
            "</tr>"
        )
    return "\n".join(rows)


def build_tariff_rows(tariffs):
    rows = []
    for tariff in tariffs:
        rows.append(
            "<tr>"
            f"<td>{esc(tariff['Connection_Type'])}</td>"
            f"<td>{tariff['Min_Units']} - {tariff['Max_Units']}</td>"
            f"<td>Rs. {tariff['Rate_Per_Unit']}</td>"
            f"<td>Rs. {tariff['Fixed_Charge']}</td>"
            f"<td>{tariff['Tax_Percent']}%</td>"
            "</tr>"
        )
    return "\n".join(rows)


def render_page(query):
    with get_connection() as connection:
        consumers = connection.execute(
            "SELECT * FROM Consumers ORDER BY C_ID DESC"
        ).fetchall()
        bills = connection.execute(
            """
            SELECT Bill.*, Consumers.Customer_Name
            FROM Bill
            JOIN Consumers ON Consumers.C_ID = Bill.C_ID
            ORDER BY Bill.B_ID DESC
            """
        ).fetchall()
        tariffs = connection.execute(
            "SELECT * FROM Tariff ORDER BY Connection_Type, Min_Units"
        ).fetchall()

    total_consumers = len(consumers)
    generated_bills = len(bills)
    revenue_total = sum(float(bill["Total_Amt"]) for bill in bills)
    unpaid_bills = sum(1 for bill in bills if bill["Status"] != "Paid")

    template = (PUBLIC_DIR / "index.html").read_text(encoding="utf-8")
    message = query.get("message", [""])[0]
    error = query.get("error", [""])[0]
    notice_class = "error" if error else "success"
    notice = error or message

    return template.replace("{{notice_class}}", notice_class).replace(
        "{{notice}}", esc(notice)
    ).replace(
        "{{total_consumers}}", str(total_consumers)
    ).replace(
        "{{active_meters}}", str(total_consumers)
    ).replace(
        "{{generated_bills}}", str(generated_bills)
    ).replace(
        "{{revenue_total}}", format_money(revenue_total)
    ).replace(
        "{{unpaid_bills}}", str(unpaid_bills)
    ).replace(
        "{{consumer_options}}", build_options(consumers)
    ).replace(
        "{{consumer_rows}}", build_consumer_rows(consumers)
    ).replace(
        "{{bill_rows}}", build_bill_rows(bills)
    ).replace(
        "{{tariff_rows}}", build_tariff_rows(tariffs)
    )


class StudentProjectHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            body = render_page(parse_qs(parsed.query)).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/styles.css":
            body = (PUBLIC_DIR / "styles.css").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/css; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_error(404, "Page not found")

    def do_POST(self):
        size = int(self.headers.get("Content-Length", "0"))
        form = parse_qs(self.rfile.read(size).decode("utf-8"))

        if self.path == "/add-consumer":
            location = add_consumer(form)
        elif self.path == "/add-bill":
            location = add_bill(form)
        elif self.path == "/mark-paid":
            location = mark_paid(form)
        else:
            self.send_error(404, "Page not found")
            return

        self.send_response(303)
        self.send_header("Location", location)
        self.end_headers()


if __name__ == "__main__":
    setup_database()
    server = ThreadingHTTPServer(("localhost", PORT), StudentProjectHandler)
    print(f"Student electricity bill app running at http://localhost:{PORT}")
    server.serve_forever()
