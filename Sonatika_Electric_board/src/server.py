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


def get_connection():
    connection = sqlite3.connect(DB_FILE)
    connection.row_factory = sqlite3.Row
    return connection


def setup_database():
    DATA_DIR.mkdir(exist_ok=True)
    with get_connection() as connection:
        connection.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
        consumer_count = connection.execute("SELECT COUNT(*) FROM Consumers").fetchone()[0]
        if consumer_count == 0:
            connection.executescript(SEED_FILE.read_text(encoding="utf-8"))


def money(value):
    return round(float(value), 2)


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
    place = field(form, "place")
    phone = field(form, "phone")
    meter_id = field(form, "meter_id")
    connection_type = field(form, "connection_type") or "Residential"

    if not name or not meter_id:
        return redirect("/", error="Name and meter ID are required.")

    with get_connection() as connection:
        try:
            connection.execute(
                """
                INSERT INTO Consumers
                    (Customer_Name, Place, Phone, Meter_ID, Connection_Type)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, place, phone, meter_id, connection_type),
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
                (C_ID, Bill_Month, Previous_Reading, Current_Reading,
                 Units_Consumed, Rate_Per_Unit, Total_Amt, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Due')
            """,
            (
                consumer_id,
                bill_month,
                previous_reading,
                current_reading,
                units,
                tariff["Rate_Per_Unit"],
                total,
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
            f"<td>{esc(consumer['Place'])}</td>"
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
        action = ""
        if bill["Status"] == "Due":
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
            f"<td>Rs. {bill['Total_Amt']}</td>"
            f"<td>{esc(bill['Status'])}</td>"
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

    template = (PUBLIC_DIR / "index.html").read_text(encoding="utf-8")
    message = query.get("message", [""])[0]
    error = query.get("error", [""])[0]
    notice_class = "error" if error else "success"
    notice = error or message

    return template.replace("{{notice_class}}", notice_class).replace(
        "{{notice}}", esc(notice)
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
