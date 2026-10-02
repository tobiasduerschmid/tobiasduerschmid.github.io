# Search and bounded screening log

Prepared 2 October 2026. Rebuild with `python3 data/build-screening.py` from this research directory; no network calls occur.

## What these counts mean

This is a bounded multi-backend literature search with purposive primary-source verification and citation tracing. It is not an exhaustive systematic review or a PRISMA selection flow. Backend totals overlap and measure different search universes; they must not be added together. A connector's reported total may describe its returned answer rather than an indexed database universe.

Captured **582 record appearances** across **42 successful operations**, plus **3 failed operations**. Identity deduplication yields **499 captured research candidates**. Adding annotated sources discovered through other logged routes gives **516 combined research records**: 37 included, 45 excluded at title level, and 434 deferred. The captured subset has 20 included, 45 excluded, and 434 deferred.

The source ledgers contain **41 research annotation entries**, **8 tutorial exemplars**, and **7 semantic authorities**. Tutorial and language-reference inspections are separate from research-paper screening. 64 supporting web query entries are retained in screening.json; their returned result counts were not saved and are not inferred.

## Search and citation operations

Exact saved query text and API parameters appear below. Where only a connector label survives, it is explicitly identified as a label. Detailed per-record provenance and request URLs are in `data/screening.json`. Direct OpenAlex searches are bounded by their saved page/per_page settings; citation expansion is bounded by the seeds and pages captured. A zero-result citation query remains a successful operation.

- **R001 — data/raw/consensus-askelle.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R002 — data/raw/consensus-hameer.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R003 — data/raw/consensus-haskelite.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R004 — data/raw/consensus-misconceptions-retry.json**
  - Query: `Haskell functional programming student misconceptions learning difficulties`.
  - Operation: search or lookup.
  - Captured: 10; indexed universe: not available; connector-reported total: 10; status: captured.
- **R005 — data/raw/consensus-misconceptions.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 0; indexed universe: not available; connector-reported total: not available; status: failed.
- **R006 — data/raw/consensus-nemeth.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R007 — data/raw/consensus-olmer.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R008 — data/raw/consensus-singer.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R009 — data/raw/consensus-teaching.json**
  - Query: `Haskell functional programming teaching automated feedback stepwise evaluation`.
  - Operation: search or lookup.
  - Captured: 10; indexed universe: not available; connector-reported total: 10; status: captured.
- **R010 — data/raw/consensus-tirronen.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R011 — data/raw/elicit-misconceptions.json**
  - Query: `What misconceptions and learning difficulties do students encounter in Haskell and functional programming?`.
  - Parameters: `{"query": "What misconceptions and learning difficulties do students encounter in Haskell and functional programming?", "maxResults": 15}`.
  - Captured: 0; indexed universe: not available; connector-reported total: not available; status: failed.
- **R012 — data/raw/elicit-teaching.json**
  - Query: `Which interventions improve students' understanding of Haskell or functional programming in digital tutorials?`.
  - Parameters: `{"query": "Which interventions improve students' understanding of Haskell or functional programming in digital tutorials?", "maxResults": 15}`.
  - Captured: 0; indexed universe: not available; connector-reported total: not available; status: failed.
- **R013 — data/raw/openalex-backward-tirronen.json**
  - Query: not saved.
  - Parameters: `{"per_page": "100", "filter": "to_publication_date:2026-10-02,openalex_id:W113668021|W145870745|W1492933792|W1575104101|W1584575784|W1590243920|W1595650974|W1597756446|W1598602490|W1965284074|W1967570611|W1976717124|W1977085035|W1984626495|W1993926093|W1995657937|W2006631720|W2009908982|W2013831574|W2015077407|W2015725579|W2032464227|W2050968492|W2051257341|W2074731714|W2079898461|W2086110922|W2095136535|W2098374496|W2099421759|W2101565274|W2102882897|W2114003275|W2116813111|W2133247167|W2143417137|W2153700707|W2157148654|W2158081248|W2163873997|W2163976959|W2165605851|W2170257749|W2201703831|W2479749570|W2913948868|W2998738573|W3212463983|W4230254879|W4230439518|W4241497207|W6629507618|W6635094594|W6644199023|W6682917993|W6812194501"}`.
  - Captured: 51; indexed universe: 51; connector-reported total: not available; status: captured.
- **R014 — data/raw/openalex-direct-haskell.json**
  - Query: `Haskell teaching`.
  - Parameters: `{"per_page": "30", "filter": "to_publication_date:2026-10-02", "search": "Haskell teaching"}`.
  - Captured: 30; indexed universe: 12616; connector-reported total: not available; status: captured.
- **R015 — data/raw/openalex-direct-misconceptions.json**
  - Query: `"functional programming" misconceptions`.
  - Parameters: `{"per_page": "30", "filter": "to_publication_date:2026-10-02", "search": "\"functional programming\" misconceptions"}`.
  - Captured: 30; indexed universe: 606; connector-reported total: not available; status: captured.
- **R016 — data/raw/openalex-direct-recent.json**
  - Query: `Haskell education`.
  - Parameters: `{"per_page": "30", "filter": "to_publication_date:2026-10-02,from_publication_date:2024-01-01", "search": "Haskell education"}`.
  - Captured: 30; indexed universe: 5773; connector-reported total: not available; status: captured.
- **R017 — data/raw/openalex-direct-seed.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R018 — data/raw/openalex-forward-tirronen.json**
  - Query: not saved.
  - Parameters: `{"per_page": "30", "filter": "to_publication_date:2026-10-02,cites:W2203258339", "sort": "publication_date:desc"}`.
  - Captured: 30; indexed universe: 56; connector-reported total: not available; status: captured.
- **R019 — data/raw/openalex-fp-education.json**
  - Query: `functional programming education`.
  - Parameters: `{"query": "functional programming education", "per_page": 25}`.
  - Captured: 17; indexed universe: not available; connector-reported total: not available; status: captured.
- **R020 — data/raw/openalex-haskell-misconceptions.json**
  - Query: `Haskell misconceptions students`.
  - Parameters: `{"query": "Haskell misconceptions students", "per_page": 25}`.
  - Captured: 22; indexed universe: not available; connector-reported total: not available; status: captured.
- **R021 — data/raw/openalex-haskell-teaching.json**
  - Query: `"Haskell" "teaching"`.
  - Parameters: `{"query": "\"Haskell\" \"teaching\"", "per_page": 25}`.
  - Captured: 18; indexed universe: not available; connector-reported total: not available; status: captured.
- **R022 — data/raw/openalex-seed-tirronen.json**
  - Query: not saved; connector label: “Seed record and citation network: Haskell beginners”.
  - Operation: get_open_access_work.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R023 — data/raw/scispace-interventions.json**
  - Query: `Which empirical studies evaluate digital tutors, automated feedback, or step-by-step evaluation tools for students learning Haskell or functional programming?`.
  - Operation: search or lookup.
  - Captured: 10; indexed universe: not available; connector-reported total: not available; status: captured.
- **R024 — data/raw/scispace-misconceptions.json**
  - Query: `What misconceptions and conceptual difficulties do university students encounter when learning Haskell and functional programming, including types, recursion, higher-order functions, laziness, and monadic IO?`.
  - Operation: search or lookup.
  - Captured: 10; indexed universe: not available; connector-reported total: not available; status: captured.
- **R025 — data/raw/snowball-askelle-backward.json**
  - Query: not saved.
  - Parameters: `{"filter": "openalex_id:W164716849|W173029385|W177779199|W207841007|W832120473|W1535989349|W1553992341|W1581084714|W1644672739|W1963817399|W1994736394|W1998875295|W2004496903|W2007798926|W2009103381|W2011607672|W2014127188|W2023427265|W2026060067|W2035392114|W2039113359|W2051257341|W2051339053|W2051379322|W2052363833|W2055227903|W2056693265|W2066312808|W2070405152|W2076039366|W2089172953|W2092909411|W2098614591|W2108323846|W2128065396|W2128407432|W2128886782|W2137390126|W2163640453|W2398506085|W2405971678|W4240127846|W6632344291|W6636105580|W6637745957|W6644479547|W6650399723|W6650565001|W6674689637|W6694706704|W6767099730|W6903420846|W7006241456|W7042839929,to_publication_date:2026-10-02", "per_page": "200", "sort": "publication_date:desc"}`.
  - Captured: 40; indexed universe: 40; connector-reported total: not available; status: captured.
- **R026 — data/raw/snowball-askelle-forward.json**
  - Query: not saved.
  - Parameters: `{"filter": "cites:W2260250034,to_publication_date:2026-10-02", "per_page": "200", "sort": "publication_date:desc"}`.
  - Captured: 98; indexed universe: 98; connector-reported total: not available; status: captured.
- **R027 — data/raw/snowball-chapman-backward.json**
  - Query: not saved.
  - Parameters: `{"filter": "openalex_id:W1521965716|W1556779599|W1964560776|W1990060255|W2002063893|W2002715165|W2015725579|W2082691724|W2088963212|W2141244172|W2163873997|W2165281830|W2203258339|W2209382110|W2326640142|W2502711386|W2524710492|W2530309120|W2533856174|W2593162797|W2751258960|W2916708654|W2963813626|W2964516878|W3010474812|W3036044545|W3041442631|W3047940318|W3194598500|W4298052160|W4392564540|W6794560212|W6800222300,to_publication_date:2026-10-02", "per_page": "200", "sort": "publication_date:desc"}`.
  - Captured: 31; indexed universe: 31; connector-reported total: not available; status: captured.
- **R028 — data/raw/snowball-chapman-forward.json**
  - Query: not saved.
  - Parameters: `{"filter": "cites:W4407110619,to_publication_date:2026-10-02", "per_page": "200", "sort": "publication_date:desc"}`.
  - Captured: 1; indexed universe: 1; connector-reported total: not available; status: captured.
- **R029 — data/raw/snowball-dale-singer-backward.json**
  - Query: not saved.
  - Parameters: `{"filter": "openalex_id:W1550086936|W1566251558|W1766934520|W1979290264|W2052608015|W2059954942|W2131314393|W2159702301|W2165558212|W2211502120|W2331393505|W2441389905|W2562534394|W2613616970|W2614482195|W2728031825|W2747657620|W2783794012|W2800917419|W2802054559|W2895037955|W2914473709|W2946961535|W3100867380|W4235471741|W4238978849|W4256206157,to_publication_date:2026-10-02", "per_page": "200", "sort": "publication_date:desc"}`.
  - Captured: 26; indexed universe: 26; connector-reported total: not available; status: captured.
- **R030 — data/raw/snowball-dale-singer-forward.json**
  - Query: not saved.
  - Parameters: `{"filter": "cites:W2956839016,to_publication_date:2026-10-02", "per_page": "200", "sort": "publication_date:desc"}`.
  - Captured: 15; indexed universe: 15; connector-reported total: not available; status: captured.
- **R031 — data/raw/snowball-expression-tutor-backward.json**
  - Query: not saved.
  - Parameters: `{"filter": "openalex_id:W1490584728|W1506127418|W1553992341|W1666348158|W1743041603|W1978948468|W2001152839|W2004843654|W2041037071|W2044101946|W2055608277|W2098374496|W2128065396|W2141591284|W2163873997|W2295866357|W2912949875|W2951639165|W2998738573|W4240127846|W4244488020|W4245969237|W6633827998|W6634436890,to_publication_date:2026-10-02", "per_page": "200", "sort": "publication_date:desc"}`.
  - Captured: 21; indexed universe: 21; connector-reported total: not available; status: captured.
- **R032 — data/raw/snowball-expression-tutor-forward.json**
  - Query: not saved.
  - Parameters: `{"filter": "cites:W2050152920,to_publication_date:2026-10-02", "per_page": "200", "sort": "publication_date:desc"}`.
  - Captured: 3; indexed universe: 3; connector-reported total: not available; status: captured.
- **R033 — data/raw/snowball-haskelite-backward.json**
  - Query: not saved.
  - Parameters: `{"filter": "openalex_id:W587099212|W1521965716|W1541318173|W1553992341|W1571471466|W1779102629|W1984964495|W2050152920|W2105045857|W2318815169|W2787993273|W2955963392|W4214487305|W4255736263|W4401668736|W4406257882|W6891556881,to_publication_date:2026-10-02", "per_page": "200", "sort": "publication_date:desc"}`.
  - Captured: 15; indexed universe: 15; connector-reported total: not available; status: captured.
- **R034 — data/raw/snowball-haskelite-forward.json**
  - Query: not saved.
  - Parameters: `{"filter": "cites:W4412890909,to_publication_date:2026-10-02", "per_page": "200", "sort": "publication_date:desc"}`.
  - Captured: 0; indexed universe: 0; connector-reported total: not available; status: captured.
- **R035 — data/raw/snowball-seed-askelle.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R036 — data/raw/snowball-seed-chapman.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R037 — data/raw/snowball-seed-dale-singer.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R038 — data/raw/snowball-seed-expression-tutor.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R039 — data/raw/snowball-seed-haskelite.json**
  - Query: not saved.
  - Operation: search or lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R040 — raw/misconceptions-sider-records.json / searches[0]**
  - Query: `functional programming learners recursive`.
  - Operation: search_open_access_works.
  - Captured: 23; indexed universe: not available; connector-reported total: not available; status: captured.
- **R041 — raw/misconceptions-sider-records.json / searches[1]**
  - Query: `information sources functional programming`.
  - Operation: search_open_access_works.
  - Captured: 23; indexed universe: not available; connector-reported total: not available; status: captured.
- **R042 — raw/misconceptions-sider-records.json / doi_lookups[0]**
  - Query: not saved; connector label: “Type errors and student repairs metadata”.
  - Operation: work lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R043 — raw/misconceptions-sider-records.json / doi_lookups[1]**
  - Query: not saved; connector label: “Teaching obstacles full-text locations”.
  - Operation: work lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R044 — raw/misconceptions-sider-records.json / doi_lookups[2]**
  - Query: not saved; connector label: “Assignment conception transfer evidence”.
  - Operation: work lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.
- **R045 — raw/misconceptions-sider-records.json / doi_lookups[3]**
  - Query: not saved; connector label: “Dys-functional student full-text locations”.
  - Operation: work lookup.
  - Captured: 1; indexed universe: not available; connector-reported total: not available; status: captured.

## Backend failures and access constraints

Both Elicit requests returned `api_access_denied`: the account plan did not include API access. No Elicit candidates were retrieved and no account upgrade was attempted. Their query strings and maxResults are reconstructed from retained actual tool-call history supplied by the parent; they are not present in the failure bodies. The three broad Sider query strings/per_page settings are preserved on the same basis. Every operation records this provenance.

The first Consensus misconceptions request was rate limited. The saved retry succeeded and returned ten papers. Both attempts are retained; the failed operation contributes no candidate records. Consensus paper lookups are distinguished from search outputs by their raw files. Publisher and repository access limits are recorded separately in the annotation ledgers and are not counted as bibliographic search failures.

## Deduplication and screening decisions

Records join first on normalized DOI, then explicit OpenAlex identity, then normalized title. Exact Consensus URL identities additionally join search/fetch duplicates. Parent-verified aliases reconcile the exact Olmer and Haskelite Consensus identities to their primary EPTCS DOIs; this also resolves two previously orphaned title-only search records. Records with equal titles and conflicting DOIs are retained for version checking. Alternate proceedings, preprint, and journal versions can remain separate. Metadata snippets and automated summaries serve as discovery leads, not verified study findings.

Included records match the annotated source ledgers or the parent's explicit inclusion list. Each retains annotation access level and claim class. Conservative exclusions apply only to titles explicitly outside the approved scope. All remaining leads are deferred for relevance/full-text appraisal; the ledger does not imply that every citation neighbour was read. Inclusion is not a uniform quality rating, and abstract-only sources remain marked at their actual access level.

The citation trace includes saved forward and backward requests for the misconceptions seed and subsequently captured Haskell tutor/teaching seeds. Only raw records present when this generator runs are counted. Missing references, indexing gaps, uncaptured later pages, English-language restrictions, semantic-search ranking, and purposive full-text selection limit coverage.

## Supporting web search queries

- notes/pedagogy-sources.json / Q01: `Sentance Waite Kallia PRIMM 2019 study 493 13 schools paper`; count not saved.
- notes/pedagogy-sources.json / Q02: `Margulieux Morrison Decker subgoal labeled worked examples introductory programming 2020 paper`; count not saved.
- notes/pedagogy-sources.json / Q03: `Roediger Karpicke 2006 test enhanced learning psychological science full text`; count not saved.
- notes/pedagogy-sources.json / Q04: `Cepeda 2008 spacing effects learning temporal ridgeline optimal retention full text`; count not saved.
- notes/pedagogy-sources.json / Q05: `Renkl Atkinson 2003 Structuring transition example study problem solving fading full text`; count not saved.
- notes/pedagogy-sources.json / Q06: `Becker 2016 effective compiler error message enhancement novice programming PDF`; count not saved.
- notes/pedagogy-sources.json / Q07: `Sorva 2013 notional machines introductory programming education PDF`; count not saved.
- notes/pedagogy-sources.json / Q08: `Tshukudu Cutts 2020 understanding conceptual transfer learning new programming languages PDF`; count not saved.
- notes/pedagogy-sources.json / Q09: `Roediger Karpicke 2006 01693 pdf karpicke`; count not saved.
- notes/pedagogy-sources.json / Q10: `Naps 2002 exploring role visualization engagement computer science education PDF`; count not saved.
- notes/pedagogy-sources.json / Q11: `Denny Luxton-Reilly Carpenter 2014 enhancing syntax error messages ineffective paper pdf`; count not saved.
- notes/pedagogy-sources.json / Q12: `Tshukudu Cutts 2020 conceptual transfer eprints Glasgow 70 Python Java full text`; count not saved.
- notes/pedagogy-sources.json / Q13: `"Test-enhanced learning" "pdf" site:karpicke.com`; count not saved.
- notes/pedagogy-sources.json / Q14: `"Teaching computer programming with PRIMM" pdf`; count not saved.
- notes/pedagogy-sources.json / Q15: `"Enhancing syntax error messages appears ineffectual" pdf`; count not saved.
- notes/pedagogy-sources.json / Q16: `"Sorva" "Notional machines" "pdf" aalto`; count not saved.
- notes/pedagogy-sources.json / Q17: `Roediger Karpicke 2006 Test Enhanced Learning pdf Purdue`; count not saved.
- notes/pedagogy-sources.json / Q18: `PRIMM 493 13 2019 Sentance Waite Kallia DOI full text kings repository`; count not saved.
- notes/pedagogy-sources.json / Q19: `Sorva Karavirta Malmi visual program simulation 2013 learning experiment 2010 article`; count not saved.
- notes/pedagogy-sources.json / Q20: `programming retrieval practice spacing experimental study computer science 2022 2023 2024`; count not saved.
- notes/pedagogy-sources.json / Q21: `"Teaching computer programming with PRIMM" "Sentance" full manuscript`; count not saved.
- notes/pedagogy-sources.json / Q22: `"A Spaced, Interleaved Retrieval Practice Tool" pdf`; count not saved.
- notes/pedagogy-sources.json / Q23: `"A Spaced, Interleaved Retrieval Practice Tool" authors`; count not saved.
- notes/pedagogy-sources.json / Q24: `"Students’ ways of experiencing visual program simulation" pdf sorva`; count not saved.
- notes/pedagogy-sources.json / Q25: `"A Spaced, Interleaved Retrieval Practice Tool" YeckehZaare Resnick Ericson pdf Michigan`; count not saved.
- notes/pedagogy-sources.json / Q26: `"Test-Enhanced Learning" "2006" site:learninglab.psych.purdue.edu/downloads/2006`; count not saved.
- notes/pedagogy-sources.json / Q27: `"Spacing Effects in Learning" "02209"`; count not saved.
- notes/pedagogy-sources.json / Q28: `"From Studying Examples to Solving Problems" Renkl Atkinson Maier 2000`; count not saved.
- notes/pedagogy-sources.json / Q29: `"Students ways experiencing visual program simulation" site:tandfonline.com/doi`; count not saved.
- notes/pedagogy-sources.json / Q30: `"Not the Silver Bullet" "3689554" authors`; count not saved.
- notes/pedagogy-sources.json / Q31: `"Spacing Effects in Learning" "Cepeda" DOI 2008`; count not saved.
- notes/pedagogy-sources.json / Q32: `"Counting days is a spacing incentive" "2025"`; count not saved.
- notes/snowball-misconceptions-sources.json / renggli2025mapfilter-Q1: `"Map, Filter, and Conquer"`; count not saved.
- notes/snowball-misconceptions-sources.json / tirronen2015workedtypes-Q1: `"Teaching types with a cognitively effective worked example format"`; count not saved.
- notes/snowball-misconceptions-sources.json / tirronen2015workedtypes-Q2: `"Teaching types with a cognitively" pdf`; count not saved.
- notes/snowball-misconceptions-sources.json / krishnamurthi2021behavioral-Q1: `"Developing Behavioral Concepts of Higher-Order Functions" pdf`; count not saved.
- notes/snowball-misconceptions-sources.json / rivera2024notations-Q1: `"Observations on the Design of Program Planning Notations for Students" pdf`; count not saved.
- notes/snowball-misconceptions-sources.json / tirronen2014typesgap-Q1: `"Tirronen" "misconceptions" "2014"`; count not saved.
- notes/snowball-misconceptions-sources.json / tirronen2014typesgap-Q2: `"Study on difficulties and misconceptions with modern type systems" pdf`; count not saved.
- notes/snowball-misconceptions-sources.json / tirronen2014typesgap-Q3: `"Study on difficulties and misconceptions" site:jyx.jyu.fi`; count not saved.
- notes/snowball-misconceptions-sources.json / nemeth2019errors-web: `"Investigating Compilation Errors of Students Learning Haskell" -"Németh" -"Nemeth" -"ResearchGate" -"arxiv" -"eptcs" -"dblp"`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q1: `"s40593-015-0080-x"`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q2: `"EPTCS.170.4"`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q3: `"FPTutor" Haskell 2023`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q4: `"Experiences of early assessment" references`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q5: `FPTutor functional programming tutor 2023`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q6: `"Evaluating Haskell expressions in a tutoring environment" arxiv`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q7: `"Ask-Elle" "FPTutor"`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q8: `"Evaluating Haskell expressions" "2023"`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q9: `"Teaching Introductory Functional Programming Using Haskelite" citations`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q10: `"Experiences of early assessment to teach functional programming" -site:cambridge.org -site:researchgate.net`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q11: `"FPTutor"`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q12: `"Ask-Elle" "2017" programming sketches`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q13: `"Ask-Elle" "Gerdes" filetype:pdf`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q14: `"Evaluating the Tracing of Recursion in the Substitution Notional Machine"`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q15: `"An Interactive Learning Environment for Program Design" 3759682`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q16: `"Teaching the art of functional programming using automated grading"`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q17: `"An Interactive Learning Environment for Program Design"`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q18: `"Trustworthy AI Feedback" Ask-Elle PDF`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q19: `"On teaching How to design programs" Ramsey pdf`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q20: `"Kouta Kumamoto" "Program Design"`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q21: `"3759682" pdf`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q22: `"Stepping OCaml" 2019 tutor`; count not saved.
- notes/snowball-tutors-sources.json / supplementary-Q23: `"On Teaching How to Design Programs" "data examples"`; count not saved.

## Supplementary citation queries preserved in annotation ledgers

These operations have saved query URLs and indexing counts in their annotation ledger, but no complete raw result set in data/raw. They are retained as separate coverage notes and are not added to the captured-record totals.

- `tirronen2015mistakes`: `https://api.openalex.org/works?filter=cites:W2203258339&per-page=100&select=id,title,doi,publication_year`; indexed count: 56; provenance: `notes/snowball-misconceptions-sources.json`.
- `nemeth2019errors`: `https://api.openalex.org/works?filter=cites:W2954564487&per-page=100&select=id,title,doi,publication_year,primary_location`; indexed count: 0; provenance: `notes/snowball-misconceptions-sources.json`.
- `rivera2022structural`: `https://api.openalex.org/works?filter=cites:W4293813222&per-page=100&select=id,title,doi,publication_year,primary_location`; indexed count: 3; provenance: `notes/snowball-misconceptions-sources.json`.
- `rivera2022planning`: `https://api.openalex.org/works?filter=cites:W4289731609&per-page=100&select=id,title,doi,publication_year,primary_location`; indexed count: 10; provenance: `notes/snowball-misconceptions-sources.json`.
