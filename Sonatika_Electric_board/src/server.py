from pathlib import Path
import sqlite3
import os


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DB_FILE = (ROOT / os.environ.get("SONATIKA_DB", "data/sonatika.db")).resolve()
SCHEMA_FILE = DATA_DIR / "schema.sql"
SEED_FILE = DATA_DIR / "seed.sql"


def get_connection():
    connection = sqlite3.connect(DB_FILE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def setup_database():
    if os.environ.get("DATABASE_URL"):
        raise RuntimeError("The Python terminal uses SQLite only. Use the web administrator portal for the hosted PostgreSQL database; refusing to write a separate local database.")
    production = os.environ.get("NODE_ENV") == "production" or os.environ.get("RENDER") == "true"
    if production and (not os.environ.get("SONATIKA_DB") or not DB_FILE.exists()):
        raise RuntimeError("Configure an existing persistent SONATIKA_DB before running the terminal in production.")
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as connection:
        initialized = connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Consumers'").fetchone()
        connection.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
        if not initialized and not production:
            # Legacy demo data includes orphan references. Seed only once.
            connection.execute("PRAGMA foreign_keys = OFF")
            connection.executescript(SEED_FILE.read_text(encoding="utf-8"))
            connection.execute("PRAGMA foreign_keys = ON")


def read_consumer():
    c_id = int(input("Enter consumer ID: "))
    with get_connection() as connection:
        consumer = connection.execute(
            "SELECT * FROM Consumers WHERE C_ID = ?",
            (c_id,),
        ).fetchone()

    if consumer is None:
        print("Consumer not found")
    else:
        print(dict(consumer))


def write_consumer():
    name = input("Enter consumer name: ")
    address = input("Enter address: ")
    phone = input("Enter phone: ")
    meter_id = input("Enter meter ID: ")
    connection_type = input("Enter connection type: ") or "Residential"

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
            print("Consumer added successfully")
        except sqlite3.IntegrityError:
            print("Meter ID already exists")


def append_bill():
    c_id = int(input("Enter consumer ID: "))
    bill_month = input("Enter bill month: ")
    previous_reading = float(input("Enter previous reading: "))
    current_reading = float(input("Enter current reading: "))

    if current_reading < previous_reading:
        print("Current reading cannot be less than previous reading")
        return

    units = current_reading - previous_reading

    with get_connection() as connection:
        consumer = connection.execute(
            "SELECT Connection_Type FROM Consumers WHERE C_ID = ?",
            (c_id,),
        ).fetchone()
        if consumer is None:
            print("Consumer not found")
            return

        tariff = connection.execute(
            """
            SELECT * FROM Tariff
            WHERE Connection_Type = ? AND ? BETWEEN Min_Units AND Max_Units
            LIMIT 1
            """,
            (consumer["Connection_Type"], units),
        ).fetchone()
        if tariff is None:
            print("No tariff available for these units")
            return

        energy_charge = units * tariff["Rate_Per_Unit"]
        total = energy_charge + tariff["Fixed_Charge"]
        total = total + (total * tariff["Tax_Percent"] / 100)

        connection.execute(
            """
            INSERT INTO Bill
                (C_ID, Bill_Month, Previous_Reading, Current_Reading,
                 Units_Consumed, Rate_Per_Unit, Total_Amt, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                c_id,
                bill_month,
                previous_reading,
                current_reading,
                units,
                tariff["Rate_Per_Unit"],
                round(total, 2),
                "Due",
            ),
        )
        print("Bill appended successfully")


def update_consumer():
    c_id = int(input("Enter consumer ID: "))
    new_name = input("Enter new name: ")

    with get_connection() as connection:
        result = connection.execute(
            "UPDATE Consumers SET Customer_Name = ? WHERE C_ID = ?",
            (new_name, c_id),
        )

    if result.rowcount == 0:
        print("Consumer not found")
    else:
        print("Name updated successfully")


def delete_consumer():
    c_id = int(input("Enter consumer ID to delete: "))

    with get_connection() as connection:
        connection.execute("DELETE FROM Bill WHERE C_ID = ?", (c_id,))
        result = connection.execute(
            "DELETE FROM Consumers WHERE C_ID = ?",
            (c_id,),
        )

    if result.rowcount == 0:
        print("Consumer not found")
    else:
        print("Consumer deleted successfully")


def search_consumer():
    text = input("Enter name, address, or meter ID to search: ")
    pattern = "%" + text + "%"

    with get_connection() as connection:
        consumers = connection.execute(
            """
            SELECT * FROM Consumers
            WHERE Customer_Name LIKE ? OR Address LIKE ? OR Meter_ID LIKE ?
            """,
            (pattern, pattern, pattern),
        ).fetchall()

    if not consumers:
        print("No consumer found")
    else:
        for consumer in consumers:
            print(dict(consumer))


def menu():
    while True:
        print("\n1. Read")
        print("2. Write")
        print("3. Append")
        print("4. Update")
        print("5. Delete")
        print("6. Search")
        print("7. Exit")

        choice = input("Enter your choice: ")

        if choice == "1":
            read_consumer()
        elif choice == "2":
            write_consumer()
        elif choice == "3":
            append_bill()
        elif choice == "4":
            update_consumer()
        elif choice == "5":
            delete_consumer()
        elif choice == "6":
            search_consumer()
        elif choice == "7":
            print("Program ended")
            break
        else:
            print("Invalid choice")


if __name__ == "__main__":
    setup_database()
    menu()

