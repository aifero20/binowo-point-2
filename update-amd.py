import sys
import re
from datetime import datetime

AMD_FILE = "AMD.md"

def read():
    with open(AMD_FILE, "r") as f:
        return f.read()

def write(content):
    with open(AMD_FILE, "w") as f:
        f.write(content)

def mark_phase_done(phase_num):
    content = read()
    for old, new in [
        ("- [ ] Phase " + phase_num, "- [x] Phase " + phase_num),
    ]:
        content = content.replace(old, new)
    write(content)
    print("OK: Phase " + phase_num + " marked done")

def add_table(table_entry):
    content = read()
    marker = "activity_logs             -> log aktivitas user"
    if table_entry not in content:
        content = content.replace(marker, marker + "\n" + table_entry)
        write(content)
        print("OK: Table added")
    else:
        print("SKIP: already exists")

def add_note(note):
    content = read()
    timestamp = datetime.now().strftime("%Y-%m-%d")
    marker = "## ATURAN WAJIB AI"
    new_section = "## CATATAN TERBARU (" + timestamp + ")\n" + note + "\n\n---\n\n"
    content = re.sub(r"## CATATAN TERBARU.*?---\n\n", "", content, flags=re.DOTALL)
    content = content.replace(marker, new_section + marker)
    write(content)
    print("OK: Note added")

def update_url(new_url):
    content = read()
    content = re.sub(r"Live:.*", "Live: " + new_url, content)
    write(content)
    print("OK: URL updated")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 update-amd.py phase N done | table TEXT | note TEXT | url TEXT")
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "phase" and len(sys.argv) >= 4 and sys.argv[3] == "done":
        mark_phase_done(sys.argv[2])
    elif cmd == "table" and len(sys.argv) >= 3:
        add_table(sys.argv[2])
    elif cmd == "note" and len(sys.argv) >= 3:
        add_note(sys.argv[2])
    elif cmd == "url" and len(sys.argv) >= 3:
        update_url(sys.argv[2])
    else:
        print("Usage: python3 update-amd.py phase N done | table TEXT | note TEXT | url TEXT")
