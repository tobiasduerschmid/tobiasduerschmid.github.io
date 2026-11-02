# AADL verification record

Verified **1 November 2026** on native macOS arm64. The three supplied models parse and instantiate with the downloaded official tool. Fresh latency and mode analyses produced the results below. **This record verifies native engine behavior; it does not establish that the models describe a safe physical vehicle.** Separate [browser-runtime evidence](runtime.md) records the implemented parser, instantiation, and latency path in CheerpJ.

## Tool and input identity

The reference artifact is [`osate-cli` 0.3.0, macOS arm64](https://github.com/osate/aadl-tooling/releases/tag/osate-cli-v0.3.0), released 29 September 2026. Its locally measured archive SHA-256 is:

```text
d11fa193e88f505240ac74b19ce0f33f43010c4a3350fd1b8f361a5fbc0bef5e
```

The executable reports `osate-cli 0.3.0`. Its embedded `org/osate/cli/version.properties` identifies the actual dependency baseline:

| Component | Embedded provenance |
| --- | --- |
| Language server | `0.3.0`, commit `895e0b9f61dbeb200362e4b25c66dc7fe634a80d` |
| OSATE | `2.21.0-SNAPSHOT`, commit `b8308b78f193a4f4d49e0cab6c777ae6f1154106` |
| Bundled Java used for verification | Temurin `21.0.12.1+1-LTS`, 64-bit arm64 |
| Host | macOS `26.6.2` |

These are the values read from the artifact, rather than an inference from the tooling README. The separately inspected grammar/property source was OSATE `2.20.0-RELEASE`; do not label these native runs as OSATE 2.20.0. The browser feasibility work must select and reproduce its own dependency closure. See the [research record](research.md) and [backend design](backend-design.md).

The unchanged repository examples used in the fresh baseline have these SHA-256 values:

| File | SHA-256 |
| --- | --- |
| [rover.aadl](examples/rover.aadl) | `67230c9d8f57b7bb3c87197fdcfb182fc29c8b37d2386871e196716b54614679` |
| [flow-budget.aadl](examples/flow-budget.aadl) | `1946bffe5109b4582246f62c30231ca809d2b5022925c04c8712cdb903a0e507` |
| [modes.aadl](examples/modes.aadl) | `461bc9548f2ef69acaf2956bb9811103beea962d33b7d45bd08908a1892aa352` |

## Fresh native baseline

Each source was checked without reported error diagnostics and instantiated once into a previously absent instance file. Inspection of the generated instances and reports established:

| Model/root | Observed result | Scope |
| --- | --- | --- |
| `Campus_Rover::Rover.single_cpu` | Two thread instances under `motion`, both with actual bindings resolving to `cpu`; complete semantic port connections; `speed_response` expands through the filter and controller flows. | Structural validation and instantiation. No schedulability or rover sensor-to-motor latency analysis was claimed. The chapter's 25% demand figure is hand arithmetic from the declared assumptions. |
| `Rover_Budget::Loop.budget` | Latency report: minimum **18 ms**, maximum **22 ms**; maximum satisfies the **25 ms** upper requirement, with **3 ms** margin. | Abstract declared budgets: sensor 4 ms, controller 8–12 ms, actuator 6 ms; connections explicitly contribute zero at this abstraction. |
| `Rover_Modes::Supervisory_Control.basic` | Mode-reachability output contains `manual` as initial, `automatic`, and the `engage`/`disengage` transitions between them. | Two reachable architectural configurations. This does not implement motor behavior or prove safe switching. |

The latency CSV identifies its settings as **asynchronous system; major partition frame; worst case as deadline; best case as empty queue; queuing latency enabled** (`AS-MF-DL-EQ-EQL`). Record these when comparing another engine/version; the present budget model contains no periodic thread architecture from which to derive sampling response.

## Isolated boundary and fault probes

Each row below used a **new workspace directory, unique client id, new server, and previously absent instance/report paths**. Source hashes were captured and remained unchanged through each successful analysis. Reports were checked for numeric totals, the actual requirement bound, and structured error diagnostics; exit status alone was not used as an oracle.

| Change from the budget model | Fresh result | Interpretation |
| --- | --- | --- |
| Set only the end-to-end maximum to **21 ms** | 18–22 ms; structured `FAILURE` and errors that 22 ms exceeds 21 ms. CLI still exits zero. | Requirement violated, by 1 ms. |
| Set only the maximum to **22 ms** | 18–22 ms; equality accepted, no error diagnostics. | Boundary satisfies the upper requirement. |
| Set only the maximum to **23 ms** | 18–22 ms; no error diagnostics. | Requirement satisfied, with 1 ms margin. |
| Express every time literal in equivalent microseconds, including the 25 ms bound | 18–22 ms and the same satisfaction result as baseline. The resulting CSV content matches the baseline CSV. | Unit normalization checked on this fixture. |
| Remove the controller flow's `Latency` association | **10–10 ms**, reported as satisfying 25 ms, without a warning/error. | **Incomplete educational contract, not acceptable requirement evidence.** See below. |
| Reverse the actuator's command feature to `out data port` | Diagnostics identify an invalid flow-sink feature and invalid connection direction. `check` exits zero. | The intended invalid model is diagnosed; no analysis was attempted. |
| Request `Rover_Budget::Missing.impl` | The tool reports that the implementation is not found, creates no instance, and exits zero. | Instantiation failed; no analysis was attempted. |

For the missing-latency probe, the exact removed text was `{Latency => 8 ms .. 12 ms;}` on the `control` flow of type `Rover_Budget::Controller`. All other budgets, links, and the end-to-end requirement remained intact. The fresh CSV assigned the controller a 0–0 ms contribution with method `no sampling/queuing latency`; the two remaining device contributions total 10 ms. This is observed behavior of this analysis on this incomplete abstract model, not a claim that all missing properties always default to zero.

The future lesson must require the declared controller budget or another explicitly accepted source of that contribution before interpreting a satisfied bound as assessment success. Missing required evidence must remain **incomplete/not checked**, even if the engine completes a numerical calculation and supplies only informational diagnostics. This completeness check is separate from syntax validation and from the engine's comparison of the values it did calculate.

## Stale-instance failure discovered during verification

An earlier exploratory sequence edited a file, issued `update`, and repeatedly instantiated the same root into the same instance URI in one server. After the first instantiation, subsequent attempts returned:

```text
Exception: A different resource with the URI 'file:///…/instances/flow-budget_Loop_budget_Instance.aaxl2' was already registered.
```

The command exited **zero**. Later `analyze-latency` commands successfully analyzed the already-existing instance: for example, after changing the source requirement to 21 ms, the stale report still compared against 22 ms. Therefore the old repeated-run outputs are **discarded as evidence for their edited source snapshots**. The boundary/unit/missing-property results in this document come only from the fresh isolated reruns above.

This finding has concrete integration consequences:

1. An instantiation exception invalidates the current operation even when the process exits zero. Never proceed to analyze a leftover instance merely because its file exists.
2. Tie each generated instance and report to the complete source/root/options/engine snapshot. A changed source revision must not inherit completion credit from an earlier instance.
3. A bridge must release/replace prior registered model resources correctly, or use a deliberately isolated resource set/runtime. Unique output names are useful for diagnosis; they are not a substitute for bounded resource lifecycle management.
4. Test repeated editing and re-instantiation explicitly before enabling a persistent browser session. Successful one-shot native runs do not establish incremental-session correctness.

No upstream bug fix is claimed here. These observations qualify the proposed integration contract and prevent this research from presenting stale output as a successful verification.

## Reproduction and evidence

The native runs used the bundled Java directly, with a temporary Java `user.home` and `OSATE_CLI_SERVER_LAUNCH=direct`. This kept session state outside the repository. For each fresh project, the command sequence was:

```text
<java> -Duser.home=<temporary-client-state> -jar <osate-cli.jar> <unique-id> init --timeout 45 <fresh-project>
<same-prefix> <unique-id> -p <returned-port> check <source.aadl>
<same-prefix> <unique-id> -p <returned-port> instantiate <source.aadl> <qualified-root>
<same-prefix> <unique-id> -p <returned-port> analyze-latency <new-instance.aaxl2>
<same-prefix> <unique-id> -p <returned-port> exit
```

`<same-prefix>` means the same Java executable, temporary `user.home`, and CLI JAR. The mode example used `analyze-modes <new-instance.aaxl2> --dot` in place of latency analysis. A project carried ordinary OSATE/Xtext `.project` metadata. Invalid-source and missing-root cases stopped before analysis. Each server was explicitly exited.

Temporary evidence is under `/tmp/sebook-aadl-research/isolated-verification-lxf_cop7/`: `results.json` records commands, exit codes, stdout/stderr, source hashes, and newly created instance hashes; `verified-results.json` records report totals and CSV hashes; each case retains its source, generated instance, and report. The temporary orchestration script is `/tmp/sebook-aadl-research/verify-isolated.py`. Earlier invalidated evidence is `/tmp/sebook-aadl-research/boundary-validation.json`. These scratch artifacts, binaries, logs, and generated reports are deliberately not repository deliverables and may be removed with temporary-file cleanup.

Not verified by this work: browser Java compatibility or performance; browser cancellation/resource limits; graphical rendering; browser accessibility; a production tutorial grader; bus-load analysis; schedulability; behavior/error annex verification; implementation conformance; or physical vehicle behavior. The separate static chapter/design preview does not change those limits.
