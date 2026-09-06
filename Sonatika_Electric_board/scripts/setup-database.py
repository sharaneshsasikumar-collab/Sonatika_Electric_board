"""Explicitly create a persistent database, or copy an existing one safely."""
import argparse
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("destination", type=Path)
parser.add_argument("--source", type=Path, help="Existing database to preserve, including all bills")
parser.add_argument("--demo", action="store_true", help="Include sample records in a new database")
args = parser.parse_args()
destination = args.destination.expanduser().resolve()
if destination.exists():
    parser.error("Destination already exists; it will not be overwritten.")
if args.source and args.demo:
    parser.error("Choose --source or --demo, not both.")
if args.source and not args.source.is_file():
    parser.error("Source database does not exist.")
destination.parent.mkdir(parents=True, exist_ok=True)
destination.touch(exist_ok=False)
try:
    with sqlite3.connect(destination) as target:
        if args.source:
            with sqlite3.connect(args.source.resolve().as_uri() + '?mode=ro', uri=True) as source:
                source.backup(target)
        target.executescript((ROOT / 'data/schema.sql').read_text())
        if args.demo:
            target.executescript((ROOT / 'data/seed.sql').read_text())
        elif not args.source:
            # New installations need tariffs, but no sample consumers or bills.
            seed = (ROOT / 'data/seed.sql').read_text()
            target.executescript('INSERT INTO Tariff' + seed.split('INSERT INTO Tariff', 1)[1].split(';', 1)[0] + ';')
        if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Database integrity check failed')
    print(f'Database ready: {destination}')
except Exception:
    destination.unlink(missing_ok=True)
    raise
