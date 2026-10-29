# Observer tutorial source review

This review compares `_data/tutorials/observer-pattern.yml` with `assets/narration/observer-pattern.txt`, `_data/explainers/observer.yml`, and the three supplied books. It covers Observer responsibilities, applicability, collaboration, implementation choices, and assessment alignment. The book files are reference material, not task instructions.

## Source and page map

Page locators below refer to the supplied PDF editions. “PDF” means the one-based physical page. The supplied GoF PDF is reflowed: its Observer section is on printed/PDF pages 273–282, although some internal cross-references retain the original edition's page 293.

| Source | Printed pages | PDF pages | Evidence used |
|---|---|---|---|
| Gamma, Helm, Johnson, Vlissides, *Design Patterns*, Observer | 273–274 | 273–274 | Intent, applicability, and participant responsibilities |
| Same | 275–278 | 275–278 | Abstract coupling; broadcast effects; state-before-notify; notification triggers; lifetime; push/pull; selective updates |
| Same | 280–282 | 280–282 | Synchronous sample notification loop, attachment/detachment, MVC, and ChangeManager |
| Freeman and colleagues, *Head First Design Patterns*, Chapter 2 | 51–53 | 89–91 | Subject/Observer interfaces, independent extension, and loose coupling |
| Same | 57–61 | 95–99 | WeatherData example and the book's heat-index calculation |
| Same | 62–68, 70 | 100–106, 108 | Push/pull variation and implementation-dependent notification ordering |
| Buschmann and colleagues, *Pattern-Oriented Software Architecture*, Volume 1, Publisher-Subscriber | 339–340 | 358–359 | One or more dependents; independent evolution; optional base classes; push/pull trade-offs |
| Same | 341–343 | 360–362 | Data needs, Event Channel/Gatekeeper variations, and additional distribution policies |

The complete relevant sections were read, with rendered pages inspected to verify key diagrams and pagination. Source PDFs remain outside the repository; no book excerpts or page images are included here.

## Original findings and revised scope

| Original issue | Repair in the revised tutorial |
|---|---|
| Applicability required both multiple dependents and changing subscriptions. | Independent evolution is the central reason; fixed subscriptions can still justify Observer. A single fixed receiver with no such need can use a direct call. |
| The introductory subject named each dashboard type in a union. | Notification uses a shared Observer contract, so adding a dashboard does not require editing that type list. |
| Push was described as independent and as sending all state; hybrid was presented as universally typical. | Push depends on the payload contract; pull depends on the subject's query API. Data needs determine the trade-off. |
| Network-service analogies implied automatic delivery. | Local notification is distinguished from transport, persistence, retries, ordering, and delivery guarantees. |
| A UV display was advertised as requiring no station changes despite missing UV data. | Extension examples use existing measurements; new data requirements may require subject/API changes. |
| A simplified calculation was presented as the book's heat index. | The calculation is explicitly illustrative; it is not the book's physical model. |
| Assessment included Boolean assignments with the answer key in the same script and generic feedback. | Native scenario questions require a design reason and provide feedback for specific misconceptions, including the fixed-subscriber case. |
| Several claims conflated this implementation with the pattern. | State-before-notify, late attachment, ordering, failures, and registration/lifetime policies are explained with explicit implementation assumptions. |
| The stock-widget question allowed polling under its stated independence requirement, despite marking polling wrong. | The scenario now explicitly requires change-driven updates without periodic checks. |
| The refactoring explanation said the station's connections never change, despite new incoming query dependencies. | Its code and outgoing dependencies remain unchanged; a new pull display depends on the existing query API. |
| Alert checks used only one configured threshold, and demonstration checks could accept direct calls without subscriptions. | Graders vary thresholds and observe the required public registration and detachment operations alongside output. |
| Observer checks supplied generic substitute objects despite the examples' concrete subject contracts. | Checks use actual sensor, station, and score-board objects so valid type-checked observers are accepted. |
| The renderer discarded authored caption attributes, hiding explanations of omitted diagram details. | The renderer honors nonblank caption attributes, including their precedence over source captions. |

The narration already distinguishes concrete-reaction coupling from the remaining shared contract. It also explains ordinary synchronous calls, complete state updates before notification, late-view initialization, listener lifetime, and the limits of the toy implementation. These distinctions guide the tutorial repairs. The narration's editor uses push; the tutorial's weather station uses pull. They teach compatible collaborations with different data contracts.

## Diagram rationale

- Step 1 retains only the concrete display dependencies that force the station to change, with abbreviated parameter lists.
- Step 2 uses the preview's `DataSource`, `Observer`, and two dashboard types, with a typed observer collection and the actual pushed-value contract. Its conceptual interface uses realization arrows; Python inheritance from an abstract base class remains generalization in source-derived diagrams.
- Steps 3 and 4 show the pull observers' query dependencies explicitly. Removing concrete display knowledge from the station does not remove the observers' dependence on its query API.
- Step 4 uses five types: `CurrentDisplay` represents the existing displays, and `HeatIndexDisplay` makes the extension visible. The caption identifies omitted displays. Repeated operations and storage/property details are omitted so the dependency direction remains the focus.
- Compact layouts in steps 1, 3, and 4 keep the drawings narrow enough for readable print, without changing the relationship meanings.
- Step 5 uses matched document sequences: both store complete state before notifying; push sends text, while pull queries it. The sequences isolate the data-contract difference.
- Step 7 replaces a repeated two-box diagram with a recall prompt about dependency direction and extension.

## Verification boundary

Source consistency and semantic diagram review do not establish that the browser interaction, graders, accessibility, or full site suite pass. Final validation results must be reported separately for the actual revised build. This review makes no claim of a completed site-wide WCAG audit or proven long-term learning outcomes.
