#!/usr/bin/env python3
"""
update-amd.py — Update AMD.md sections
Usage:
  python3 update-amd.py phase 6 done
  python3 update-amd.py table "nama_table → deskripsi"
  python3 update-amd.py note "catatan penting"
  python3 update-amd.py url "Live URL baru"
"""

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
    # Mark phase as done
    patterns = [
        (f"- [ ] Phase {phase_num}", f"- [x] Phase {phase_num}"),
        (f"- [ ] Phase {phase_num} —", f"- [x] Phase {phase_num} —"),
    ]
    for old, new in patterns:
        content = content.replace(old, new)
    write(content)
    print(f"OK: Phase {phase_num} marked done")

def add_table(table_entry):
    content = read()
    marker = "activity_logs             → log aktivitas user"
    if table_entry not in content:
        content = content.replace(
            marker,
            marker + f"
{table_entry}"
        )
        write(content)
        print(f"OK: Table added — {table_entry}")
    else:
        print(f"SKIP: already exists")

def add_note(note):
    content = read()
    timestamp = datetime.now().strftime("%Y-%m-%d")
    marker = "## ATURAN WAJIB AI"
    new_section = f"## CATATAN TERBARU ({timestamp})
{note}

---

"
    # Replace existing catatan or add new
    content = re.sub(r"## CATATAN TERBARU.*?---

", "", content, flags=re.DOTALL)
    content = content.replace(marker, new_section + marker)
    write(content)
    print(f"OK: Note added")

def update_url(new_url):
    content = read()
    content = re.sub(r"Live:.*", f"Live: {new_url}", content)
    write(content)
    print(f"OK: URL updated to {new_url}")

def add_phase(phase_num, description):
    content = read()
    marker = "- [ ] Phase 6"
    new_phase = f"- [ ] Phase {phase_num} — {description}"
    if f"Phase {phase_num}" not in content:
        content = content.replace(marker, marker + f"
{new_phase}")
        write(content)
        print(f"OK: Phase {phase_num} added")
    else:
        print(f"SKIP: Phase {phase_num} already exists")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
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
    elif cmd == "phase" and len(sys.argv) >= 4:
        add_phase(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
