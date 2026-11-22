#!/usr/bin/env python3
"""Record a reviewed batch of additions using two published catalogue snapshots."""

import argparse
import csv
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile

ROOT = Path(__file__).resolve().parents[1]
RELEASE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}(?:-r[0-9]+)?")
SOURCE = re.compile(
    r"https://github\.com/austinulrigg/austinulrigg\.github\.io/commit/[0-9a-f]{40}"
)
LIMIT = 6
MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024


def publication_time(value):
    try:
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if value.utcoffset() is not None:
            return value.astimezone(timezone.utc)
    except (ValueError, OverflowError):
        pass
    raise ValueError("publication timestamps need an ISO date, time, and UTC offset")


def checked_file(path, metadata):
    if path.stat().st_size != metadata["bytes"] or metadata["bytes"] > MAX_SNAPSHOT_BYTES:
        raise ValueError(f"{path}: unexpected archive size")
    data = path.read_bytes()
    if len(data) != metadata["bytes"] or hashlib.sha256(data).hexdigest() != metadata["sha256"]:
        raise ValueError(f"{path}: does not match its release manifest checksum")
    with gzip.GzipFile(fileobj=io.BytesIO(data)) as archive:
        contents = archive.read(MAX_SNAPSHOT_BYTES + 1)
    if len(contents) > MAX_SNAPSHOT_BYTES:
        raise ValueError(f"{path}: decompressed archive exceeds snapshot size limit")
    return contents


def load_release(directory, release):
    if not RELEASE.fullmatch(release):
        raise ValueError(f"invalid release ID: {release!r}")
    path = directory / release
    manifest = json.loads((path / "manifest.json").read_text(encoding="utf-8"))
    if manifest["release"] != release:
        raise ValueError(f"{path}: manifest release ID does not match directory")
    graph6 = checked_file(path / "graphs.g6.gz", manifest["files"]["graphs.g6.gz"])
    if hashlib.sha256(graph6).hexdigest() != manifest["graph6Sha256"]:
        raise ValueError(f"{path}: wrong uncompressed graph6 checksum")
    graphs = graph6.splitlines()
    params = checked_file(path / "parameters.csv.gz", manifest["files"]["parameters.csv.gz"])
    rows = list(csv.DictReader(io.StringIO(params.decode("utf-8"), newline="")))
    if not len(graphs) == len(rows) == manifest["count"] or len(set(graphs)) != len(graphs):
        raise ValueError(f"{path}: wrong row count or duplicate canonical graph6")
    result = {}
    for i, (graph, row) in enumerate(zip(graphs, rows), 1):
        minor = row.get("minor", row.get("minor_order_listed"))
        if not graph or row.get("id") != f"TO-{i:06d}" or minor not in {"0", "1"}:
            raise ValueError(f"{path}: invalid graph6 or parameter row {i}")
        result[graph] = minor == "1"
    return result, manifest["canonicalization"]


def public_names(values):
    names = [name.strip() for name in values]
    if any(not name for name in names) or len(set(names)) != len(names):
        raise ValueError("supply each public display name once")
    return names


def record_batch(args):
    if args.previous == args.release:
        raise ValueError("use the immediately preceding published release as --previous")
    if not SOURCE.fullmatch(args.source):
        raise ValueError("use the public catalogue's full GitHub release commit permalink")
    published = publication_time(args.published_at)
    names = public_names(args.credit)
    submitters = public_names(args.submitted_by)
    previous, old_canon = load_release(args.data, args.previous)
    current, new_canon = load_release(args.data, args.release)
    if old_canon != new_canon:
        raise ValueError("canonicalization changed; review or normalize both snapshots before comparing")
    additions = current.keys() - previous.keys()
    if not additions:
        print("No added graphs; the Recent Additions list was not changed.")
        return
    entry = {
        "release": args.release,
        "publishedAt": published.isoformat().replace("+00:00", "Z"),
        "added": len(additions),
        "minorAdded": sum(current[graph] for graph in additions),
        "creditedTo": names,
        "source": args.source,
    }
    if submitters:
        entry["submittedBy"] = submitters
    target = args.data / "recent-additions.json"
    contents = target.read_text(encoding="utf-8") if target.exists() else ""
    batches = json.loads(contents)["batches"] if contents else []
    for batch in batches:
        if batch["release"] != args.release:
            continue
        if all(batch.get(key) == value for key, value in entry.items()):
            print(f"{args.release}: verified existing entry ({entry['added']} added).")
            return
        raise ValueError(f"{args.release}: recorded information differs; review before correcting it")
    batches.append(entry)
    batches.sort(key=lambda batch: publication_time(batch["publishedAt"]), reverse=True)
    updated = json.dumps({"batches": batches[:LIMIT]}, indent=2, ensure_ascii=False) + "\n"
    if updated == contents:
        print(f"{args.release}: older than the last {LIMIT} batches; no change.")
        return
    # Replace only after all validation succeeds, without leaving a partial file.
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=target.parent, delete=False
    ) as handle:
        tmp = Path(handle.name)
        handle.write(updated)
    try:
        tmp.chmod(0o644)
        tmp.replace(target)
    finally:
        tmp.unlink(missing_ok=True)
    print(f"{args.release}: added {entry['added']} graphs ({entry['minorAdded']} minor-order).")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=ROOT / "data/toroidal")
    parser.add_argument("--previous", required=True, help="immediately preceding published release ID")
    parser.add_argument("--release", required=True, help="new verified release ID")
    parser.add_argument("--published-at", required=True, help="public release timestamp with UTC offset")
    parser.add_argument("--credit", action="append", required=True, help="public contributor display name; repeat as needed")
    parser.add_argument("--submitted-by", action="append", default=[], help="verified public submitter; repeat as needed")
    parser.add_argument("--source", required=True, help="full public GitHub release commit permalink")
    args = parser.parse_args()
    try:
        record_batch(args)
    except (EOFError, KeyError, OSError, ValueError) as err:
        parser.exit(1, f"error: {err}\n")


if __name__ == "__main__":
    main()
