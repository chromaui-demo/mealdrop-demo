#!/usr/bin/env python3
"""Run an arbitrary GraphQL query. The escape hatch for anything unscripted.

    ./cq.py 'query($id: ID!) { project(id: $id) { name } }' '{"id": "665a..."}'
    ./cq.py --file query.graphql --vars vars.json
    echo 'query { ... }' | ./cq.py -
    ./cq.py '...' --paginate project.build.tests    # walk a Relay connection

Exits non-zero when the response carries an `errors` array. Note that a missing
object is returned as a bare `null` with NO errors entry, so a zero exit does not
by itself mean you got data — check the payload.
"""

from __future__ import annotations

import argparse
import json
import sys

from chromatic_api import ChromaticAPI, run_cli


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("query", nargs="?", help="query string, or '-' to read stdin")
    parser.add_argument("variables", nargs="?", default="{}", help="variables as JSON")
    parser.add_argument("--file", help="read the query from a file")
    parser.add_argument("--vars", help="read variables from a JSON file")
    parser.add_argument("--paginate", metavar="PATH",
                        help="walk the Relay connection at this dotted path "
                             "(query must take $first/$after and select pageInfo)")
    parser.add_argument("--page-size", type=int, default=50)
    args = parser.parse_args()

    if args.file:
        query = open(args.file).read()
    elif args.query == "-":
        query = sys.stdin.read()
    elif args.query:
        query = args.query
    else:
        parser.error("provide a query, --file, or '-' for stdin")

    variables = json.loads(open(args.vars).read()) if args.vars else json.loads(args.variables)

    api = ChromaticAPI()
    if args.paginate:
        nodes = api.paginate(query, variables, args.paginate, page_size=args.page_size)
        print(json.dumps(nodes, indent=2))
        return

    payload = api.raw_query(query, variables)
    print(json.dumps(payload, indent=2))
    if payload.get("errors"):
        sys.exit(1)


if __name__ == "__main__":
    run_cli(main)
