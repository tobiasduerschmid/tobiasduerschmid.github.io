#!/usr/bin/env python3
"""Rebuild the bounded local screening ledger; performs no network requests."""
import collections
import csv
import json
import pathlib
import re
import unicodedata

BASE = pathlib.Path(__file__).resolve().parent.parent
DATE = "2026-10-02"
EXTRA_DOIS = ["10.1007/s40593-015-0080-x", "10.4204/EPTCS.424.3",
              "10.4204/EPTCS.170.4", "10.1017/S0956796824000182",
              "10.25304/rlt.v27.2248", "10.5220/0009416404120419",
              "10.1017/S0956796803004805"]
HISTORY_REQUESTS = {
    "openalex-haskell-misconceptions.json": {"query": "Haskell misconceptions students", "per_page": 25},
    "openalex-fp-education.json": {"query": "functional programming education", "per_page": 25},
    "openalex-haskell-teaching.json": {"query": '"Haskell" "teaching"', "per_page": 25},
    "elicit-misconceptions.json": {"query": "What misconceptions and learning difficulties do students encounter in Haskell and functional programming?", "maxResults": 15},
    "elicit-teaching.json": {"query": "Which interventions improve students' understanding of Haskell or functional programming in digital tutorials?", "maxResults": 15},
}
VERIFIED_CONSENSUS_ALIASES = {
    "c2664e04658b5f8b9282f2ca16676f7a": "10.4204/eptcs.170.4",
    "ea5ae15b61975a3698ad026028480b22": "10.4204/eptcs.424.3",
}


def doi(value):
    if not isinstance(value, str):
        return None
    value = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", value.strip(), flags=re.I)
    return value.lower() if value.startswith("10.") else None


def title_key(value):
    value = unicodedata.normalize("NFKD", value or "").casefold()
    value = re.sub(r"[’'`\u0300-\u036f]", "", value)
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def unwrap(value):
    if value.get("structuredContent") and not value.get("isError"):
        return value["structuredContent"]
    for block in value.get("content", []):
        if block.get("type") == "text":
            try:
                return json.loads(block["text"])
            except (ValueError, TypeError):
                pass
    return value


appearances = []
queries = []
errors = []
ledgers = []
exemplars = []
authorities = []
supporting_queries = []
annotated_sources = []
supplementary_seed_searches = []


def add_record(paper, provenance, annotation=None):
    identifier = paper.get("id")
    oa = identifier if isinstance(identifier, str) and re.search(r"openalex.org/W\d+", identifier) else None
    d = doi(paper.get("doi"))
    if not d:
        d = doi(paper.get("pdf_url"))
    consensus_match = re.search(r"consensus\.app/.*?([a-f0-9]{32})(?:/|$)", paper.get("url") or "")
    if not d and consensus_match and consensus_match.group(1) in VERIFIED_CONSENSUS_ALIASES:
        d = VERIFIED_CONSENSUS_ALIASES[consensus_match.group(1)]
        provenance = dict(provenance, identifier_reconciliation="Parent-verified primary DOI alias for exact Consensus paper identity")
    appearance = {"title": paper.get("title") or paper.get("display_name"),
                  "doi": d, "openalex_id": oa,
                  "year": paper.get("publication_year") or paper.get("year") or (paper.get("date") or "")[:4] or None,
                  "provenance": provenance,
                  "url": paper.get("url") or paper.get("pdf_url") or paper.get("fulltext_url") or ("https://doi.org/" + d if d else oa),
                  "provider_record_id": identifier,
                  "consensus_identity": consensus_match.group(1) if consensus_match else None,
                  "annotation": annotation}
    if appearance["title"] or d or oa:
        appearances.append(appearance)


def read_result(path, raw, exact_query=None, operation=None, suffix=""):
    relative = str(path.relative_to(BASE))
    payload = unwrap(raw)
    qid = "R%03d" % (len(queries) + 1)
    response = raw.get("response", {})
    if response:
        payload = response
    parameters = raw.get("parameters", {})
    history = HISTORY_REQUESTS.get(path.name, {})
    query = exact_query or payload.get("query") or payload.get("searchTerm") or parameters.get("search") or history.get("query")
    papers = payload.get("results", payload.get("papers", []))
    if not papers and (payload.get("doi") or payload.get("title")):
        papers = [payload]
    is_error = raw.get("isError", False)
    label = payload.get("scholar_title")
    meta = payload.get("meta", {})
    entry = {"id": qid, "raw_file": relative, "raw_section": suffix or None,
             "exact_query": query, "query_status": "exact query reconstructed from retained tool-call history" if history else "saved exact query" if query else "parameters saved" if parameters else "exact query not saved",
             "connector_label": label, "operation": operation or payload.get("scholar_tool_name") or ("citation " + raw["direction"] if raw.get("direction") else "search or lookup"),
             "parameters": parameters or history or None, "request_url": raw.get("request_url"),
             "query_provenance": "retained actual tool-call history supplied by parent" if history else "saved raw payload or wrapper",
             "indexed_result_count": meta.get("count"),
             "connector_reported_total": payload.get("total_results"),
             "captured_records": 0 if is_error else len(papers),
             "seed": raw.get("seed"), "direction": raw.get("direction"),
             "status": "failed" if is_error else "captured"}
    queries.append(entry)
    if is_error:
        messages = [x.get("text", "") for x in raw.get("content", []) if x.get("type") == "text"]
        errors.append({"query_id": qid, "raw_file": relative, "messages": messages,
                       "error_code": payload.get("code") or payload.get("error_code")})
        return
    for rank, paper in enumerate(papers, 1):
        add_record(paper, {"kind": "captured_result", "query_id": qid, "raw_file": relative,
                           "raw_section": suffix or None, "rank": rank})


for path in sorted((BASE / "data/raw").glob("*.json")):
    read_result(path, json.loads(path.read_text()))
path = BASE / "raw/misconceptions-sider-records.json"
if path.exists():
    raw = json.loads(path.read_text())
    for index, item in enumerate(raw.get("searches", [])):
        result = item.get("result", {})
        if result.get("status") == "fulfilled":
            read_result(path, result["value"], item.get("query"), suffix="searches[%d]" % index)
    for index, result in enumerate(raw.get("doi_lookups", [])):
        if result.get("status") == "fulfilled":
            read_result(path, result["value"], operation="work lookup", suffix="doi_lookups[%d]" % index)

for path in sorted((BASE / "notes").glob("*sources.json")):
    raw = json.loads(path.read_text())
    relative = str(path.relative_to(BASE))
    for source in raw.get("sources", []):
        annotation = {"ledger": relative, "source_id": source.get("id"),
                      "decision": source.get("status") or source.get("screening_decision") or "include",
                      "access_level": source.get("access_level") or source.get("access"),
                      "claim_class": source.get("claim_class") or source.get("evidence_class")}
        add_record(source, {"kind": "annotated_source_ledger", "ledger": relative,
                            "source_id": source.get("id")}, annotation)
        ledgers.append(annotation)
        annotated_sources.append({"ledger": relative, "source": source})
        for index, query in enumerate(source.get("queries", [])):
            supporting_queries.append({"ledger": relative, "query": query if isinstance(query, dict) else {"id": str(source.get("id")) + "-Q" + str(index + 1), "query": query}})
    for source in raw.get("tutorials", []):
        exemplars.append({"ledger": relative, "source": source})
    for source in raw.get("semantic_authorities", []):
        authorities.append({"ledger": relative, "source": source})
    for query in raw.get("queries", []):
        supporting_queries.append({"ledger": relative, "query": query})
    for index, query in enumerate(raw.get("exact_supplementary_web_queries", [])):
        supporting_queries.append({"ledger": relative, "query": {"id": "supplementary-Q" + str(index + 1), "query": query}})
    for seed in raw.get("seed_searches", []):
        supplementary_seed_searches.append({"ledger": relative, "search": seed})
        if seed.get("additional_web_query"):
            supporting_queries.append({"ledger": relative, "query": {"id": seed.get("seed") + "-web", "query": seed["additional_web_query"]}})

for d in EXTRA_DOIS:
    add_record({"doi": d}, {"kind": "parent_requested_inclusion", "doi": doi(d)},
               {"ledger": None, "source_id": None, "decision": "include",
                "access_level": "see matched ledger; not independently inferred", "claim_class": None})

# Identity joins use DOI, then explicit OpenAlex ID, then normalized title.
# A title-only join never collapses records that already have conflicting DOIs.
parent = list(range(len(appearances)))


def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i


def join(a, b):
    parent[find(b)] = find(a)


for field in ["doi", "openalex_id", "consensus_identity"]:
    seen = {}
    for index, item in enumerate(appearances):
        if item[field]:
            if item[field] in seen:
                join(seen[item[field]], index)
            else:
                seen[item[field]] = index
title_groups = collections.defaultdict(list)
for index, item in enumerate(appearances):
    if item["title"]:
        title_groups[title_key(item["title"])].append(index)
ambiguous_titles = []
for key, indices in title_groups.items():
    roots = {find(i) for i in indices}
    known = {x["doi"] for j, x in enumerate(appearances) if find(j) in roots and x["doi"]}
    if len(known) <= 1:
        for index in indices[1:]:
            join(indices[0], index)
    elif len(roots) > 1:
        ambiguous_titles.append({"normalized_title": key, "dois": sorted(known),
                                 "note": "Retained separately because titles match but DOIs differ; versions may overlap."})

groups = collections.defaultdict(list)
for index, item in enumerate(appearances):
    groups[find(index)].append(item)

# Conservative title-level exclusions only; all uncertain citation neighbours remain deferred.
unrelated = [
    r"functional (?:genomics|brain|connectivity|disability|inhibitors|elements|annotation|profiling)",
    r"\b(?:genome|genomics|metagenomics|biomolecular|bioinformatics|microbial|protein.protein|saccharomyces|dementia|sphingomyelinase|respiratory distress|extracellular vesicles|fmri|mri data|talairach|physiology|medical students|childhood fever|self.injury|mass media campaigns|physical fitness|physical activity|active commuting|climate change|global warming|double pulsar|strong.field gravity|malaysian|patronage|second language learners|oral proficiency|l2 reading|applied linguistics|quantum espresso|qupath|snpEff|fieldtrip|miqe|imagej|mafft|blast2go|kegg|charMm)\b",
    r"\b(?:nonlinear optimization and optimal control|beacon openflow controller|econometrics of program evaluation)\b"
]
records = []
for items in groups.values():
    titles = list(dict.fromkeys(x["title"] for x in items if x["title"]))
    ds = sorted({x["doi"] for x in items if x["doi"]})
    oaids = sorted({x["openalex_id"] for x in items if x["openalex_id"]})
    annotations = [x["annotation"] for x in items if x["annotation"]]
    annotation_titles = [x["title"] for x in items if x["annotation"] and x["title"]]
    title = annotation_titles[0] if annotation_titles else titles[0] if titles else None
    if any(x["decision"].startswith("include") for x in annotations):
        decision = "included"
        reason = "Matched annotated source ledger" if any(x["ledger"] for x in annotations) else "Explicit parent inclusion; source appraisal must be consulted separately"
        screening_level = "source-ledger appraisal"
    elif title and any(re.search(pattern, title, re.I) for pattern in unrelated):
        decision = "excluded"
        reason = "Title explicitly concerns an unrelated domain or noneducational application; outside approved Haskell/programming-learning scope"
        screening_level = "title only"
    elif annotations:
        decision = "deferred"
        reason = "Annotated ledger retains this as borderline/full-text-needed: " + ", ".join(sorted({x["decision"] for x in annotations}))
        screening_level = "limited source-ledger appraisal"
    else:
        decision = "deferred"
        reason = "Captured lead without a matched annotated inclusion; relevance/appraisal or full text still needed"
        screening_level = "not substantively reviewed"
    raw_count = sum(x["provenance"]["kind"] == "captured_result" for x in items)
    records.append({"title": title, "title_variants": titles, "doi": ds[0] if len(ds) == 1 else None,
                    "doi_variants": ds, "openalex_ids": oaids, "year_variants": sorted({str(x["year"]) for x in items if x["year"]}),
                    "urls": list(dict.fromkeys(x["url"] for x in items if x["url"])),
                    "decision": decision, "reason": reason, "screening_level": screening_level,
                    "captured_appearances": raw_count, "captured_in_search_or_lookup": raw_count > 0,
                    "annotations": annotations, "provenance": [x["provenance"] for x in items]})
records.sort(key=lambda x: (x["decision"], title_key(x["title"]), x["doi"] or ""))
for index, record in enumerate(records, 1):
    record["id"] = "C%04d" % index
decisions = dict(collections.Counter(x["decision"] for x in records))
captured_decisions = dict(collections.Counter(x["decision"] for x in records if x["captured_in_search_or_lookup"]))
totals = {"raw_operations": len(queries), "successful_raw_operations": sum(x["status"] == "captured" for x in queries),
          "failed_raw_operations": len(errors), "captured_record_appearances": sum(x["captured_records"] for x in queries),
          "deduplicated_captured_research_records": sum(x["captured_in_search_or_lookup"] for x in records),
          "combined_research_records_including_ledger_only_sources": len(records),
          "decision_counts_combined": decisions, "decision_counts_captured": captured_decisions,
          "annotated_research_source_entries": len(ledgers),
          "annotated_research_inclusions": sum(r['decision'] == 'included' and any(a['ledger'] for a in r['annotations']) for r in records),
          "tutorial_exemplars": len(exemplars),
          "semantic_authorities": len(authorities), "supporting_web_query_log_entries": len(supporting_queries)}
output = {"generated": DATE, "scope": "Bounded captured candidates and purposively annotated sources; not a systematic review or PRISMA flow",
          "deduplication": "DOI (case-normalized), explicit OpenAlex ID, exact Consensus URL identity for search/fetch duplicates, then Unicode-normalized title; conflicting-DOI title matches retained separately",
          "screening_caveat": "Included means matched source annotation, not uniformly high-quality evidence. Excluded is conservative title-level out-of-scope screening. Deferred records have not been substantively appraised.",
          "totals": totals, "queries_and_operations": queries, "failed_operations": errors,
          "ambiguous_title_matches": ambiguous_titles, "records": records,
          "tutorial_exemplars": exemplars, "semantic_authorities": authorities,
          "supplementary_seed_searches": supplementary_seed_searches,
          "supporting_web_queries": supporting_queries}
(BASE / "data/screening.json").write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
with (BASE / "data/screening.csv").open("w", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=["id", "title", "doi", "decision", "screening_level", "captured_appearances", "reason"], lineterminator="\n")
    writer.writeheader()
    for record in records:
        writer.writerow({k: record[k] for k in writer.fieldnames})

lines = ["# Search and bounded screening log", "", "Prepared 2 October 2026. Rebuild with `python3 data/build-screening.py` from this research directory; no network calls occur.", "",
         "## What these counts mean", "",
         "This is a bounded multi-backend literature search with purposive primary-source verification and citation tracing. It is not an exhaustive systematic review or a PRISMA selection flow. Backend totals overlap and measure different search universes; they must not be added together. A connector's reported total may describe its returned answer rather than an indexed database universe.", "",
         f"Captured **{totals['captured_record_appearances']} record appearances** across **{totals['successful_raw_operations']} successful operations**, plus **{len(errors)} failed operations**. Identity deduplication yields **{totals['deduplicated_captured_research_records']} captured research candidates**. Adding annotated sources discovered through other logged routes gives **{len(records)} combined research records**: {decisions.get('included',0)} included, {decisions.get('excluded',0)} excluded at title level, and {decisions.get('deferred',0)} deferred. The captured subset has {captured_decisions.get('included',0)} included, {captured_decisions.get('excluded',0)} excluded, and {captured_decisions.get('deferred',0)} deferred.", "",
         f"The source ledgers contain **{len(ledgers)} research annotation entries**, **{len(exemplars)} tutorial exemplars**, and **{len(authorities)} semantic authorities**. Tutorial and language-reference inspections are separate from research-paper screening. {len(supporting_queries)} supporting web query entries are retained in screening.json; their returned result counts were not saved and are not inferred.", "",
         "## Search and citation operations", "",
         "Exact saved query text and API parameters appear below. Where only a connector label survives, it is explicitly identified as a label. Detailed per-record provenance and request URLs are in `data/screening.json`. Direct OpenAlex searches are bounded by their saved page/per_page settings; citation expansion is bounded by the seeds and pages captured. A zero-result citation query remains a successful operation.", ""]
for q in queries:
    lines += [f"- **{q['id']} — {q['raw_file']}" + (f" / {q['raw_section']}" if q['raw_section'] else "") + "**",
              "  - Query: " + ("`" + str(q['exact_query']).replace("`", "'") + "`" if q['exact_query'] else "not saved" + ("; connector label: “" + q['connector_label'] + "”" if q['connector_label'] else "")) + ".",
              "  - Parameters: `" + json.dumps(q['parameters'], ensure_ascii=False) + "`." if q['parameters'] else "  - Operation: " + q['operation'] + ".",
              f"  - Captured: {q['captured_records']}; indexed universe: {q['indexed_result_count'] if q['indexed_result_count'] is not None else 'not available'}; connector-reported total: {q['connector_reported_total'] if q['connector_reported_total'] is not None else 'not available'}; status: {q['status']}."]
lines += ["", "## Backend failures and access constraints", "",
          "Both Elicit requests returned `api_access_denied`: the account plan did not include API access. No Elicit candidates were retrieved and no account upgrade was attempted. Their query strings and maxResults are reconstructed from retained actual tool-call history supplied by the parent; they are not present in the failure bodies. The three broad Sider query strings/per_page settings are preserved on the same basis. Every operation records this provenance.", "",
          "The first Consensus misconceptions request was rate limited. The saved retry succeeded and returned ten papers. Both attempts are retained; the failed operation contributes no candidate records. Consensus paper lookups are distinguished from search outputs by their raw files. Publisher and repository access limits are recorded separately in the annotation ledgers and are not counted as bibliographic search failures.", "",
          "## Deduplication and screening decisions", "",
          "Records join first on normalized DOI, then explicit OpenAlex identity, then normalized title. Exact Consensus URL identities additionally join search/fetch duplicates. Parent-verified aliases reconcile the exact Olmer and Haskelite Consensus identities to their primary EPTCS DOIs; this also resolves two previously orphaned title-only search records. Records with equal titles and conflicting DOIs are retained for version checking. Alternate proceedings, preprint, and journal versions can remain separate. Metadata snippets and automated summaries serve as discovery leads, not verified study findings.", "",
          "Included records match the annotated source ledgers or the parent's explicit inclusion list. Each retains annotation access level and claim class. Conservative exclusions apply only to titles explicitly outside the approved scope. All remaining leads are deferred for relevance/full-text appraisal; the ledger does not imply that every citation neighbour was read. Inclusion is not a uniform quality rating, and abstract-only sources remain marked at their actual access level.", "",
          "The citation trace includes saved forward and backward requests for the misconceptions seed and subsequently captured Haskell tutor/teaching seeds. Only raw records present when this generator runs are counted. Missing references, indexing gaps, uncaptured later pages, English-language restrictions, semantic-search ranking, and purposive full-text selection limit coverage.", "",
          "## Supporting web search queries", ""]
for item in supporting_queries:
    query = item["query"]
    lines.append("- " + item["ledger"] + " / " + str(query.get("id", "")) + ": `" + str(query.get("query", query)).replace("`", "'") + "`; count not saved.")
lines += ["", "## Supplementary citation queries preserved in annotation ledgers", "", "These operations have saved query URLs and indexing counts in their annotation ledger, but no complete raw result set in data/raw. They are retained as separate coverage notes and are not added to the captured-record totals.", ""]
for item in supplementary_seed_searches:
    seed = item["search"]
    lines.append("- `" + seed.get("seed", "") + "`: `" + seed.get("forward_query", "not saved") + "`; indexed count: " + str(seed.get("api_meta_count", "not saved")) + "; provenance: `" + item["ledger"] + "`.")
(BASE / "memos/search-log.md").write_text("\n".join(lines) + "\n")


def brief(value, limit=20):
    """Return a bounded metadata preview; rich extractions stay in JSON."""
    if value is None:
        return "not recorded"
    if not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=False)
    words = value.split()
    return " ".join(words[:limit]) + (" …" if len(words) > limit else "")


def bib_escape(value):
    return str(value).replace("\\", "\\textbackslash{}").replace("&", "\\&").replace("%", "\\%").replace("_", "\\_").replace("#", "\\#")


def author_text(value, separator=", "):
    if isinstance(value, list):
        return separator.join(str(x) for x in value)
    return value or "not recorded"


def annotation_link(entry):
    source = entry["source"]
    ledger = "[" + entry["ledger"] + "](../" + entry["ledger"] + ")"
    if not source.get("note_id"):
        return ledger + " / `" + str(source.get("id")) + "`"
    note = BASE / "notes/snowball-tutors.md"
    heading = next(line[4:] for line in note.read_text().splitlines() if line.startswith("### " + source["note_id"] + " "))
    anchor = re.sub(r"[^\w\- ]", "", heading.lower()).replace(" ", "-")
    return "[Full annotation " + source["note_id"] + "](../notes/snowball-tutors.md#" + anchor + "); " + ledger


def write_annotated_database():
    """Export all annotated sources, preserving their original extraction schema."""
    destination = BASE / "output"
    destination.mkdir(exist_ok=True)
    database = {"generated": DATE, "research_sources": annotated_sources,
                "tutorial_exemplars": exemplars, "semantic_authorities": authorities,
                "note": "Rich extractions retain source-ledger provenance. Read screening.json for deduplicated discovery records; tutorial exemplars are not effectiveness studies."}
    (destination / "database.json").write_text(json.dumps(database, ensure_ascii=False, indent=2) + "\n")
    fields = ["record_type", "id", "title", "authors", "year", "doi", "url", "status", "claim_class", "access", "design", "population", "sample", "findings", "limitations", "ledger"]
    with (destination / "database.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for entry in annotated_sources:
            source = entry["source"]
            row = {k: source.get(k) for k in fields}
            row.update(record_type="research annotation", authors=author_text(source.get("authors")), ledger=entry["ledger"],
                       claim_class=source.get("claim_class") or source.get("evidence_class"),
                       access=source.get("access") or source.get("access_level"),
                       sample=source.get("sample") or source.get("n"))
            writer.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v for k, v in row.items()})
        for category, entries in [("tutorial exemplar", exemplars), ("semantic authority", authorities)]:
            for entry in entries:
                source = entry["source"]
                writer.writerow({"record_type": category, "id": source.get("id"), "title": source["title"],
                                 "authors": author_text(source.get("authors")), "year": source.get("year"),
                                 "url": source.get("url") or (source.get("urls") or [None])[0],
                                 "access": source.get("inspection"), "ledger": entry["ledger"]})
    bibliography = ["# Compact annotated bibliography", "", "Capped fragments are previews; consult the linked annotation for the complete appraisal. Access levels and evidence classes remain separate. Borderline records are retained as leads, not appraised inclusions. This is a purposive evidence base, not an exhaustive bibliography.", ""]
    bibtex = []
    used_keys = set()
    for entry in annotated_sources:
        source = entry["source"]
        key = re.sub(r"[^a-zA-Z0-9]", "", source.get("id") or title_key(source["title"])[:40])
        while key in used_keys:
            key += "x"
        used_keys.add(key)
        url = source.get("url") or source.get("full_text_url")
        label = f"[{source['title']}]({url})" if url else source["title"]
        bibliography += [f"- **{label}** — {author_text(source.get('authors'))} ({source.get('year', 'n.d.')}), `{key}`.",
                         "  - Evidence class: `" + str(source.get("claim_class") or source.get("evidence_class") or "not recorded") + "`.",
                         "  - Preview: " + (brief(source.get("findings"), 20) if source.get("findings") else "see " + annotation_link(entry)),
                         "  - Method preview: " + brief(source.get("design"), 12) + "; access: " + str(source.get("access") or source.get("access_level") or "not recorded") + ".",
                         "  - Source status: `" + str(source.get("status") or source.get("screening_decision") or "annotated inclusion") + "`.",
                         "  - Limits preview: " + (brief(source.get("limitations"), 12) if source.get("limitations") else "see linked full annotation"),
                         "  - Annotation: " + annotation_link(entry) + "."]
        bib_fields = {"title": source["title"], "author": author_text(source.get("authors"), " and "),
                      "year": source.get("year"), "doi": doi(source.get("doi")), "url": url,
                      "howpublished": source.get("venue"),
                      "note": "Access: " + str(source.get("access") or source.get("access_level") or "not recorded")}
        bibtex.append("@misc{" + key + ",\n" + ",\n".join("  " + field + " = {" + bib_escape(value) + "}" for field, value in bib_fields.items() if value) + "\n}")
    for category, entries in [("Tutorial exemplars", exemplars), ("Semantic authorities", authorities)]:
        bibliography += ["", "## " + category, ""]
        for entry in entries:
            source = entry["source"]
            url = source.get("url") or (source.get("urls") or [None])[0]
            bibliography.append("- " + ("[" + source["title"] + "](" + url + ")" if isinstance(url, str) else source["title"]) + "; inspected scope recorded in `" + entry["ledger"] + "`.")
            key = re.sub(r"[^a-zA-Z0-9]", "", source.get("id") or title_key(source["title"])[:40])
            while key in used_keys:
                key += "x"
            used_keys.add(key)
            bib_fields = {"title": source["title"], "author": author_text(source.get("authors"), " and "),
                          "year": source.get("year"), "url": url, "note": category + "; inspected scope in " + entry["ledger"]}
            bibtex.append("@misc{" + key + ",\n" + ",\n".join("  " + field + " = {" + bib_escape(value) + "}" for field, value in bib_fields.items() if value) + "\n}")
    (destination / "bibliography.md").write_text("\n".join(bibliography) + "\n")
    (destination / "bibliography.bib").write_text("\n\n".join(bibtex) + "\n")


write_annotated_database()
print(json.dumps(totals, indent=2))
