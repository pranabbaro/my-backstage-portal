import re
fixture = """__metadata:
  version: 8

"@backstage/backend-plugin-api@npm:^1.4.0, @backstage/backend-plugin-api@npm:^1.4.1":
  version: 1.4.1
  resolution: "@backstage/backend-plugin-api@npm:1.4.1"
"""
lines = fixture.splitlines()
found = None
for i, line in enumerate(lines):
    if line.startswith((" ", "\t")):
        continue
    if "@backstage/backend-plugin-api@npm:" not in line:
        continue
    for j in range(i + 1, min(i + 12, len(lines))):
        nxt = lines[j]
        if nxt and not nxt.startswith((" ", "\t")):
            break
        m = re.match(r"\s+version:\s+\"?([^\"\s]+)\"?\s*$", nxt)
        if m:
            found = m.group(1)
            break
assert found == "1.4.1"
print("PASS: Yarn 4 lockfile resolver")
