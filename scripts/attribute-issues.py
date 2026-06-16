#!/usr/bin/env python3
"""Retro-attribute the seeded Pac-Man backlog to its issuer, matching the
oodim pipeline's own convention (apps/web/.../tools/github.ts):

  • a `by:<slug>` label   → who FILED it (shows in the issues list)
  • a `[FirstName]` title  → same, in the title
  • a `_Filed by **Name** ..._` body footer

The backlog is the PM's product plan, so the issuer is Mara Okonkwo
(Studio Head & Lead Product, oodim Game). The IMPLEMENTER is assigned later
by routing per slice (Ivy got #1), and shows up as the PR author.

    GH_TOKEN=... python3 scripts/attribute-issues.py
"""
import json, os, urllib.request, urllib.error

REPO = "phynars/oodim-game"
API = f"https://api.github.com/repos/{REPO}"
TOK = os.environ["GH_TOKEN"]
AUTHOR = "Mara Okonkwo"
SLUG = "mara"
FOOTER = f"_Filed by **{AUTHOR}** (PM, oodim Game) — the product backlog. Implementer assigned per slice by routing._"

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method)
    r.add_header("Authorization", f"Bearer {TOK}")
    r.add_header("Accept", "application/vnd.github+json")
    r.add_header("X-GitHub-Api-Version", "2022-11-28")
    r.add_header("User-Agent", "oodim-attribution/1.0")
    if data: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)

def main():
    # by:mara label (matches the pipeline's auto-label).
    code, _ = req("POST", "/labels", {"name": f"by:{SLUG}", "color": "1d76db",
                  "description": f"Filed by {AUTHOR}"})
    print(f"label by:{SLUG}: {code}")

    code, issues = req("GET", "/issues?state=open&per_page=50")
    issues = [i for i in issues if not i.get("pull_request")]
    for i in sorted(issues, key=lambda x: x["number"]):
        n, title, bodytext = i["number"], i["title"], (i.get("body") or "")
        # Retitle: [Pac-Man] X  ->  [Mara] X  (convention is [FirstName]).
        new_title = title
        if title.startswith("[Pac-Man] "):
            new_title = "[Mara] " + title[len("[Pac-Man] "):]
        elif not title.startswith("[Mara]"):
            new_title = f"[Mara] {title}"
        # Append the Filed-by footer once.
        new_body = bodytext
        if FOOTER not in bodytext:
            new_body = bodytext.rstrip() + "\n\n---\n" + FOOTER
        req("PATCH", f"/issues/{n}", {"title": new_title, "body": new_body})
        req("POST", f"/issues/{n}/labels", {"labels": [f"by:{SLUG}"]})
        print(f"  #{n}  {new_title}")
    print("\nDone — backlog attributed to", AUTHOR)

if __name__ == "__main__":
    main()
