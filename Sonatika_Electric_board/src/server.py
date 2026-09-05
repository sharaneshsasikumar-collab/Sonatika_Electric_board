from pathlib import Path
import shutil
import sys
import re


ROOT = Path(__file__).resolve().parents[1]


def resolve_path(rel_path: str) -> Path:
    p = (ROOT / rel_path).resolve()
    try:
        root_resolved = ROOT.resolve()
    except Exception:
        root_resolved = ROOT
    if not str(p).startswith(str(root_resolved)):
        raise ValueError("Path is outside the workspace root")
    return p


def read_file_cli():
    rel = input("File to read (relative to workspace): ").strip()
    try:
        p = resolve_path(rel)
    except ValueError as e:
        print(e)
        return
    if not p.exists():
        print("File does not exist.")
        return
    with p.open("r", encoding="utf-8", errors="replace") as f:
        for i, line in enumerate(f, 1):
            print(f"{i:4}: {line.rstrip()}")


def write_file_cli():
    rel = input("File to write (relative to workspace): ").strip()
    try:
        p = resolve_path(rel)
    except ValueError as e:
        print(e)
        return
    if p.exists():
        yn = input("File exists — overwrite? (y/N): ").strip().lower()
        if yn != "y":
            print("Aborted")
            return
    print("Enter content. End with a single line containing only .END")
    lines = []
    while True:
        line = input()
        if line == ".END":
            break
        lines.append(line)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines) + ("\n" if lines and not lines[-1].endswith("\n") else ""))
    print("Wrote file.")


def append_file_cli():
    rel = input("File to append (relative to workspace): ").strip()
    try:
        p = resolve_path(rel)
    except ValueError as e:
        print(e)
        return
    if not p.exists():
        yn = input("File does not exist — create? (y/N): ").strip().lower()
        if yn != "y":
            print("Aborted")
            return
    print("Enter content to append. End with a single line containing only .END")
    lines = []
    while True:
        line = input()
        if line == ".END":
            break
        lines.append(line)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        f.write("\n".join(lines) + ("\n" if lines and not lines[-1].endswith("\n") else ""))
    print("Appended to file.")


def update_file_cli():
    rel = input("File to update (relative to workspace): ").strip()
    try:
        p = resolve_path(rel)
    except ValueError as e:
        print(e)
        return
    if not p.exists():
        print("File does not exist.")
        return
    mode = input("Update by (1) replace text or (2) replace line number? Enter 1 or 2: ").strip()
    if mode == "1":
        find = input("Text to find: ")
        replace = input("Replacement text: ")
        text = p.read_text(encoding="utf-8")
        new_text = text.replace(find, replace)
        if new_text == text:
            print("No occurrences replaced.")
            return
        p.write_text(new_text, encoding="utf-8")
        print("Replacements done.")
    elif mode == "2":
        try:
            lineno = int(input("Line number to replace: ").strip())
        except ValueError:
            print("Invalid line number")
            return
        new_line = input("New line content: ")
        lines = p.read_text(encoding="utf-8").splitlines()
        if lineno < 1 or lineno > len(lines):
            print("Line number out of range")
            return
        lines[lineno - 1] = new_line
        p.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        print("Line updated.")
    else:
        print("Invalid mode")


def delete_file_cli():
    rel = input("File to delete (relative to workspace): ").strip()
    try:
        p = resolve_path(rel)
    except ValueError as e:
        print(e)
        return
    if not p.exists():
        print("File does not exist.")
        return
    yn = input(f"Delete {p.relative_to(ROOT)} ? (y/N): ").strip().lower()
    if yn != "y":
        print("Aborted")
        return
    if p.is_dir():
        shutil.rmtree(p)
    else:
        p.unlink()
    print("Deleted.")


def search_cli():
    pattern = input("Search pattern (regex): ").strip()
    relpath = input("Directory to search (relative, default '.'):").strip() or "."
    try:
        base = resolve_path(relpath)
    except ValueError as e:
        print(e)
        return
    try:
        cre = re.compile(pattern)
    except re.error as e:
        print("Invalid regex:", e)
        return
    for p in base.rglob("*"):
        if p.is_file():
            try:
                text = p.read_text(encoding="utf-8")
            except Exception:
                continue
            for i, line in enumerate(text.splitlines(), 1):
                if cre.search(line):
                    print(f"{p.relative_to(ROOT)}:{i}: {line.strip()}")


def main_menu():
    actions = {
        "1": ("Read", read_file_cli),
        "2": ("Write", write_file_cli),
        "3": ("Append", append_file_cli),
        "4": ("Update", update_file_cli),
        "5": ("Delete", delete_file_cli),
        "6": ("Search", search_cli),
        "7": ("Exit", None),
    }
    while True:
        print("\nFile Operations CLI — workspace root:", ROOT)
        for k, (label, _) in actions.items():
            print(f"{k}. {label}")
        choice = input("Choose an option: ").strip()
        if choice == "7":
            print("Exiting.")
            break
        action = actions.get(choice)
        if not action:
            print("Invalid choice")
            continue
        _, fn = action
        if fn:
            try:
                fn()
            except Exception as e:
                print("Error:", e)


if __name__ == "__main__":
    main_menu()
