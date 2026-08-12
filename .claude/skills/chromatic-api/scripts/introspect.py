#!/usr/bin/env python3
"""Explore the schema without hand-writing introspection queries.

    ./introspect.py                        # list every type
    ./introspect.py Test                   # fields + args of one type
    ./introspect.py --search a11y access   # types AND fields matching keywords
    ./introspect.py --implementors Build   # concrete types of an interface
    ./introspect.py --returning Accessibility   # every field returning a matching type

The schema is cached under ~/.cache/chromatic-api/ so repeated lookups are free.
Pass --refresh to re-fetch.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from chromatic_api import ChromaticAPI, run_cli

FULL_QUERY = """query {
  __schema {
    types {
      name kind description
      possibleTypes { name }
      interfaces { name }
      fields(includeDeprecated: true) {
        name description
        args { name type { ...TypeRef } }
        type { ...TypeRef }
      }
      inputFields { name type { ...TypeRef } }
      enumValues(includeDeprecated: true) { name }
    }
  }
}
fragment TypeRef on __Type {
  kind name
  ofType { kind name ofType { kind name ofType { kind name } } }
}"""


def cache_path() -> Path:
    directory = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "chromatic-api"
    directory.mkdir(parents=True, exist_ok=True)
    return directory / "schema.json"


def load_schema(api: ChromaticAPI, refresh: bool) -> list[dict]:
    path = cache_path()
    if path.is_file() and not refresh:
        return json.loads(path.read_text())["types"]
    types = api.query(FULL_QUERY)["__schema"]["types"]
    path.write_text(json.dumps({"types": types}))
    return types


def type_name(ref: dict | None) -> str:
    """Unwrap NON_NULL/LIST wrappers down to the named type."""
    while ref:
        if ref.get("name"):
            return ref["name"]
        ref = ref.get("ofType")
    return "?"


def describe(entry: dict) -> None:
    print(f"{entry['kind']} {entry['name']}")
    if entry.get("description"):
        print(f"  {entry['description']}")
    if entry.get("interfaces"):
        print(f"  implements: {', '.join(i['name'] for i in entry['interfaces'])}")
    if entry.get("possibleTypes"):
        print(f"  implemented by: {', '.join(p['name'] for p in entry['possibleTypes'])}")
    for field in entry.get("fields") or []:
        args = ", ".join(f"{a['name']}: {type_name(a['type'])}" for a in field["args"])
        print(f"    {field['name']}({args}): {type_name(field['type'])}")
    for field in entry.get("inputFields") or []:
        print(f"    {field['name']}: {type_name(field['type'])}")
    if entry.get("enumValues"):
        print(f"    values: {', '.join(v['name'] for v in entry['enumValues'])}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("type", nargs="?", help="type name to describe")
    parser.add_argument("--search", nargs="+", metavar="KW",
                        help="find types and fields whose name contains any keyword")
    parser.add_argument("--implementors", metavar="INTERFACE",
                        help="list concrete types of an interface")
    parser.add_argument("--returning", metavar="SUBSTR",
                        help="list fields whose return type name contains SUBSTR")
    parser.add_argument("--refresh", action="store_true", help="re-fetch the schema")
    args = parser.parse_args()

    types = load_schema(ChromaticAPI(), args.refresh)
    index = {t["name"]: t for t in types}
    public = [t for t in types if not t["name"].startswith("__")]

    if args.search:
        keywords = [k.lower() for k in args.search]
        print("--- types ---")
        for entry in public:
            if any(k in entry["name"].lower() for k in keywords):
                print(f"  {entry['kind']:12} {entry['name']}")
        print("--- fields ---")
        for entry in public:
            for field in entry.get("fields") or []:
                if any(k in field["name"].lower() for k in keywords):
                    print(f"  {entry['name']}.{field['name']}: {type_name(field['type'])}")
        return

    if args.implementors:
        entry = index.get(args.implementors)
        if not entry:
            raise SystemExit(f"error: no type named '{args.implementors}'")
        for possible in entry.get("possibleTypes") or []:
            print(possible["name"])
        return

    if args.returning:
        for entry in public:
            for field in entry.get("fields") or []:
                if args.returning.lower() in type_name(field["type"]).lower():
                    print(f"  {entry['name']}.{field['name']} -> {type_name(field['type'])}")
        return

    if args.type:
        entry = index.get(args.type)
        if not entry:
            close = [t["name"] for t in public if args.type.lower() in t["name"].lower()]
            hint = f" Did you mean: {', '.join(close[:8])}?" if close else ""
            raise SystemExit(f"error: no type named '{args.type}'.{hint}")
        describe(entry)
        return

    for entry in sorted(public, key=lambda t: (t["kind"], t["name"])):
        print(f"  {entry['kind']:12} {entry['name']}")


if __name__ == "__main__":
    run_cli(main)
