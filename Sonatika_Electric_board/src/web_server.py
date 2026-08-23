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
        if connection.execute("SELECT COUNT(*) FROM Consumers").fetchone()[0] == 0:
            connection.executescript(SEED_FILE.read_text(encoding="utf-8"))


def value(form, name):
    return form.get(name, [""])[0].strip()


def redirect(message="", error=""):
    query = urlencode({key: text for key, text in {
        "message": message,
        "error": error,
    }.items() if text})
    return "/" + ("?" + query if query else "")


def add_consumer(form):
    name = value(form, "name")
    address = value(form, "address")
    phone = value(form, "phone")
    meter_id = value(form, "meter_id")
    connection_type = value(form, "connection_type") or "Residential"

    if not name or not address or not meter_id:
        return redirect(error="Name, address, and meter ID are required.")

    try:
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO Consumers
                    (Customer_Name, Address, Phone, Meter_ID, Connection_Type)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, address, phone, meter_id, connection_type),
            )
    except sqlite3.IntegrityError:
        return redirect(error="Meter ID already exists.")

    return redirect(message="Consumer added successfully.")


def add_bill(form):
    consumer_id = value(form, "consumer_id")
    bill_month = value(form, "bill_month") or "Current Month"
    previous_reading = float(value(form, "previous_reading"))
    current_reading = float(value(form, "current_reading"))

    if current_reading < previous_reading:
        return redirect(error="Current reading cannot be less than previous reading.")

    units = current_reading - previous_reading
    with get_connection() as connection:
        consumer = connection.execute(
            "SELECT Connection_Type FROM Consumers WHERE C_ID = ?",
            (consumer_id,),
        ).fetchone()
        if consumer is None:
            return redirect(error="Please select a valid consumer.")

        tariff = connection.execute(
            """
            SELECT * FROM Tariff
            WHERE Connection_Type = ? AND ? BETWEEN Min_Units AND Max_Units
            LIMIT 1
            """,
            (consumer["Connection_Type"], units),
        ).fetchone()
        if tariff is None:
            return redirect(error="No tariff is available for these units.")

        charge = units * tariff["Rate_Per_Unit"] + tariff["Fixed_Charge"]
        total = round(charge + charge * tariff["Tax_Percent"] / 100, 2)
        connection.execute(
            """
            INSERT INTO Bill
                (C_ID, Bill_Month, Previous_Reading, Current_Reading,
                 Units_Consumed, Rate_Per_Unit, Total_Amt, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (consumer_id, bill_month, previous_reading, current_reading,
             units, tariff["Rate_Per_Unit"], total, "Due"),
        )

    return redirect(message=f"Bill saved. Total: Rs. {total}")


def update_bill_status(form):
    bill_id = value(form, "bill_id")
    with get_connection() as connection:
        connection.execute("UPDATE Bill SET Status = 'Paid' WHERE B_ID = ?", (bill_id,))
    return redirect(message="Bill marked as paid.")


def delete_consumer(form):
    consumer_id = value(form, "d_id")
    with get_connection() as connection:
        connection.execute("DELETE FROM Bill WHERE C_ID = ?", (consumer_id,))
        connection.execute("DELETE FROM Consumers WHERE C_ID = ?", (consumer_id,))
    return redirect(message="Consumer deleted successfully.")


def render_page(query):
    with get_connection() as connection:
        consumers = connection.execute("SELECT * FROM Consumers ORDER BY C_ID DESC").fetchall()
        bills = connection.execute(
            """
            SELECT Bill.*, Consumers.Customer_Name
            FROM Bill JOIN Consumers ON Consumers.C_ID = Bill.C_ID
            ORDER BY Bill.B_ID DESC
            """
        ).fetchall()
        tariffs = connection.execute("SELECT * FROM Tariff ORDER BY Connection_Type, Min_Units").fetchall()

    def esc(item):
        return html.escape(str(item or ""), quote=True)

    options = "\n".join(
        f"<option value='{row['C_ID']}'>{esc(row['Customer_Name'])} ({esc(row['Meter_ID'])})</option>"
        for row in consumers
    )
    consumer_rows = "\n".join(
        f"<tr><td>{row['C_ID']}</td><td>{esc(row['Customer_Name'])}</td>"
        f"<td>{esc(row['Address'])}</td><td>{esc(row['Meter_ID'])}</td>"
        f"<td>{esc(row['Connection_Type'])}</td></tr>"
        for row in consumers
    ) or "<tr><td colspan='5'>No consumers yet.</td></tr>"
    bill_rows = "\n".join(
        f"<tr><td>{row['B_ID']}</td><td>{esc(row['Customer_Name'])}</td>"
        f"<td>{esc(row['Bill_Month'])}</td><td>{row['Units_Consumed']}</td>"
        f"<td>Rs. {row['Rate_Per_Unit']}</td><td>Rs. {row['Total_Amt']}</td>"
        f"<td>{esc(row['Status'])}</td><td></td></tr>"
        for row in bills
    ) or "<tr><td colspan='8'>No bills generated yet.</td></tr>"
    tariff_rows = "\n".join(
        f"<tr><td>{esc(row['Connection_Type'])}</td><td>{row['Min_Units']} - {row['Max_Units']}</td>"
        f"<td>Rs. {row['Rate_Per_Unit']}</td><td>Rs. {row['Fixed_Charge']}</td>"
        f"<td>{row['Tax_Percent']}%</td></tr>"
        for row in tariffs
    )

    template = (PUBLIC_DIR / "index.html").read_text(encoding="utf-8")
    replacements = {
        "{{notice_class}}": "error" if query.get("error") else "success",
        "{{notice}}": esc(query.get("error", query.get("message", ""))),
        "{{total_consumers}}": str(len(consumers)),
        "{{active_meters}}": str(len(consumers)),
        "{{generated_bills}}": str(len(bills)),
        "{{revenue_total}}": "Rs. " + format(sum(float(row['Total_Amt']) for row in bills), ",.2f"),
        "{{unpaid_bills}}": str(sum(row["Status"] != "Paid" for row in bills)),
        "{{consumer_options}}": options,
        "{{consumer_rows}}": consumer_rows,
        "{{bill_rows}}": bill_rows,
        "{{tariff_rows}}": tariff_rows,
    }
    for marker, replacement in replacements.items():
        template = template.replace(marker, replacement)
    return template


class WebHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            body = render_page(parse_qs(parsed.query)).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif parsed.path == "/styles.css":
            body = (PUBLIC_DIR / "styles.css").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/css")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404, "Page not found")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        form = parse_qs(self.rfile.read(length).decode("utf-8"))
        if self.path == "/add-consumer":
            location = add_consumer(form)
        elif self.path == "/add-bill":
            location = add_bill(form)
        elif self.path == "/mark-paid":
            location = update_bill_status(form)
        elif self.path == "/delete-consumer":
            location = delete_consumer(form)
        else:
            self.send_error(404, "Page not found")
            return
        self.send_response(303)
        self.send_header("Location", location)
        self.end_headers()


if __name__ == "__main__":
    setup_database()
    print("Web interface running at http://localhost:3000")
    ThreadingHTTPServer(("localhost", PORT), WebHandler).serve_forever()
