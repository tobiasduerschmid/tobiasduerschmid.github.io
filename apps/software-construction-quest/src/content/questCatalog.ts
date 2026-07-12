import type { DistrictDefinition, QuestDefinition } from '../domain/types';

export const QUESTS = [
  {
    id: 'story-forge',
    districtId: 'briefing-bay',
    sequence: 1,
    title: 'Stakeholder Story Forge',
    shortTitle: 'Story Forge',
    briefing:
      'A learner wants the quest to resume after a browser restart. Separate the observable need from the implementation and make success testable.',
    objectives: [
      'Distinguish a requirement from an implementation decision.',
      'Choose objective Given/When/Then acceptance criteria.',
    ],
    prerequisiteQuestIds: [],
    challenge: {
      id: 'story-forge-acceptance',
      kind: 'choice',
      phase: 'predict',
      title: 'Make the saved-progress story testable',
      prompt: 'Which acceptance criterion best specifies the learner-visible behavior?',
      context:
        'Story: As a learner, I want my completed missions restored so that I can continue where I stopped.',
      hint: 'The criterion should name a starting state, an action, and an observable result without prescribing a storage technology.',
      successFeedback:
        'This criterion specifies observable behavior and a clear boundary while leaving the implementation open.',
      correctOptionId: 'observable',
      options: [
        {
          id: 'local-storage',
          label: 'The app stores progress in localStorage as JSON.',
          feedback:
            'That is an implementation decision. A different storage mechanism could satisfy the same learner need.',
        },
        {
          id: 'observable',
          label:
            'Given two completed missions, when the learner closes and reopens the quest, then both missions are still marked complete.',
          feedback: 'This states an observable starting condition, action, and result.',
        },
        {
          id: 'fast',
          label: 'The progress loads quickly and reliably.',
          feedback:
            '“Quickly” and “reliably” need measurable boundaries before they can guide implementation or testing.',
        },
      ],
      reflectionPrompt: 'How could you extend this criterion to cover corrupted saved data?',
    },
    deepPracticeUrl: '/SEBook/requirements',
    lectureSources: [{ file: 'L01_Intro.pdf', pages: '55-68' }],
  },
  {
    id: 'pipeworks-control',
    districtId: 'automation-works',
    sequence: 2,
    title: 'Pipeworks Control Room',
    shortTitle: 'Pipeworks',
    briefing:
      'A service log contains repeated error lines. Build a text-stream pipeline that groups identical error lines before counting them.',
    objectives: [
      'Compose commands through standard input and standard output.',
      'Order transformations so adjacent duplicate counting is correct.',
    ],
    prerequisiteQuestIds: ['story-forge'],
    challenge: {
      id: 'pipeworks-command',
      kind: 'text-entry',
      phase: 'repair',
      title: 'Build the error-count pipeline',
      prompt:
        'Enter one pipeline that selects lines containing ERROR, sorts identical lines together, and counts each distinct line.',
      context: 'Input file: server.log\nAvailable commands: grep, sort, uniq -c',
      answerLabel: 'Shell pipeline',
      acceptedAnswers: [
        'grep ERROR server.log | sort | uniq -c',
        'grep "ERROR" server.log | sort | uniq -c',
        "grep 'ERROR' server.log | sort | uniq -c",
      ],
      incorrectFeedback:
        'The pipeline must filter first, sort identical lines next to one another, and only then count adjacent duplicates.',
      hint: '`uniq -c` counts adjacent duplicates, so its input must be sorted first.',
      successFeedback:
        'The pipeline composes three focused tools, and each stage establishes the precondition required by the next.',
      reflectionPrompt:
        'How would you preserve error messages from the pipeline itself on a separate channel?',
    },
    deepPracticeUrl: '/SEBook/tools/shell-tutorial',
    lectureSources: [{ file: 'L2-ShellScripting.pdf', pages: '12-15, 22-29' }],
  },
  {
    id: 'encoding-rescue',
    districtId: 'automation-works',
    sequence: 3,
    title: 'Mojibake Rescue',
    shortTitle: 'Encoding Rescue',
    briefing:
      'Student names arrived as bytes encoded with UTF-8, but one service interpreted those bytes with a different character encoding.',
    objectives: [
      'Distinguish bytes from characters.',
      'Diagnose an encoding mismatch from its partial symptoms.',
    ],
    prerequisiteQuestIds: ['pipeworks-control'],
    challenge: {
      id: 'encoding-root-cause',
      kind: 'choice',
      phase: 'explain',
      title: 'Explain why only some characters broke',
      prompt:
        'Why can the ASCII letters in “Dürschmid” remain readable while “ü” turns into “Ã¼”?',
      context: 'Original: Dürschmid\nDisplayed: DÃ¼rschmid',
      hint: 'Compare how many bytes common ASCII characters and “ü” use in UTF-8.',
      successFeedback:
        'ASCII byte values map identically in both encodings, while the multi-byte UTF-8 sequence for “ü” is misread as separate characters.',
      reflectionPrompt:
        'What metadata or boundary contract would prevent this mismatch?',
      correctOptionId: 'shared-ascii',
      options: [
        {
          id: 'font',
          label: 'The display font contains letters but no ü glyph.',
          feedback:
            'A missing glyph normally renders as a replacement box. “Ã¼” is evidence that valid bytes were decoded with the wrong encoding.',
        },
        {
          id: 'shared-ascii',
          label:
            'ASCII byte values agree across the encodings, but the UTF-8 bytes for ü are decoded as separate characters.',
          feedback: 'This explains both the preserved letters and the characteristic mojibake.',
        },
        {
          id: 'corruption',
          label: 'The network randomly changed one character during transfer.',
          feedback:
            'Random corruption would not consistently produce the same well-formed “Ã¼” sequence.',
        },
      ],
    },
    deepPracticeUrl: '/SEBook/tools/shell',
    lectureSources: [{ file: 'L2-ShellScripting.pdf', pages: '16-20' }],
  },
  {
    id: 'python-type-shifter',
    districtId: 'automation-works',
    sequence: 4,
    title: 'Python Type-Shifter Bug Hunt',
    shortTitle: 'Python Bug Hunt',
    briefing:
      'A telemetry parser rebinding the same name to incompatible object types fails only when a rare record arrives.',
    objectives: [
      'Reason about names, objects, and dynamic typing.',
      'Choose a repair that preserves valid input handling.',
    ],
    prerequisiteQuestIds: ['encoding-rescue'],
    challenge: {
      id: 'python-rebinding',
      kind: 'choice',
      phase: 'repair',
      title: 'Repair the rebinding failure',
      prompt: 'Which change most clearly preserves the two distinct concepts in this function?',
      context:
        'reading = "21.5"\nreading = float(reading)\nif reading > 20:\n    reading = {"value": reading, "alert": True}\nreturn reading + 1',
      hint: 'Track what the name `reading` means at each line and what contract the return expression assumes.',
      successFeedback:
        'Separate names preserve the mental model and keep the numeric return contract explicit.',
      reflectionPrompt:
        'What type annotation or test would expose the original contract violation earlier?',
      correctOptionId: 'separate-concepts',
      options: [
        {
          id: 'try-catch',
          label: 'Wrap the return expression in a broad exception handler.',
          feedback:
            'Catching the failure hides the contradictory data shape without restoring a clear return contract.',
        },
        {
          id: 'separate-concepts',
          label:
            'Keep `numeric_reading` as a number and create a separate `alert_record` only where a record is needed.',
          feedback:
            'This gives each concept one stable meaning and lets the function keep an explicit numeric return contract.',
        },
        {
          id: 'stringify',
          label: 'Convert every intermediate value to a string.',
          feedback:
            'That avoids one type error by discarding numeric semantics needed for comparison and arithmetic.',
        },
      ],
    },
    deepPracticeUrl: '/SEBook/tools/python-tutorial',
    lectureSources: [{ file: 'L3-PythonScripting.pdf', pages: '21-34' }],
  },
  {
    id: 'git-snapshot-lab',
    districtId: 'history-network',
    sequence: 5,
    title: 'Time Stone Snapshot Lab',
    shortTitle: 'Git Snapshots',
    briefing:
      'A file was staged, edited again, and then committed. Reconstruct which version exists in each Git location.',
    objectives: [
      'Distinguish working tree, staging area, local history, and remote history.',
      'Predict the snapshot produced by a commit.',
    ],
    prerequisiteQuestIds: ['story-forge'],
    challenge: {
      id: 'git-state-matching',
      kind: 'matching',
      phase: 'predict',
      title: 'Locate each version',
      prompt:
        'A learner stages version B, edits the file to version C, and commits without staging again. Match each location to the version it now contains.',
      hint: 'A commit records the staging-area snapshot, not every current working-tree edit.',
      successFeedback:
        'The commit captures B, the working tree keeps C, and the remote remains unchanged until a push.',
      reflectionPrompt:
        'What would `git status` need to report after this commit?',
      prompts: [
        { id: 'working', label: 'Working tree', correctChoiceId: 'version-c' },
        { id: 'local', label: 'New local commit', correctChoiceId: 'version-b' },
        { id: 'remote', label: 'Remote branch', correctChoiceId: 'version-a' },
      ],
      choices: [
        { id: 'version-a', label: 'Version A, the previously pushed content' },
        { id: 'version-b', label: 'Version B, the staged content' },
        { id: 'version-c', label: 'Version C, the latest unstaged edit' },
      ],
      incorrectFeedback:
        'Remember that staging copies a version into the next-snapshot area. Later edits do not replace it automatically.',
    },
    deepPracticeUrl: '/SEBook/tools/git-tutorial',
    lectureSources: [{ file: 'L4-VersionControlGit.pdf', pages: '8-22' }],
  },
  {
    id: 'packet-courier',
    districtId: 'history-network',
    sequence: 6,
    title: 'Packet Courier Arena',
    shortTitle: 'Packet Courier',
    briefing:
      'A multiplayer campus game uses different communication needs. Match each message class to the transport behavior its requirements justify.',
    objectives: [
      'Distinguish latency, throughput, reliability, ordering, and freshness.',
      'Select transport behavior from consequences rather than slogans.',
    ],
    prerequisiteQuestIds: ['python-type-shifter'],
    challenge: {
      id: 'transport-matching',
      kind: 'matching',
      phase: 'transfer',
      title: 'Route each message class',
      prompt: 'Choose the best default transport for each requirement.',
      hint: 'Ask whether a late old message is useful and whether loss can be tolerated or repaired.',
      successFeedback:
        'Fresh position updates tolerate loss, while chat and file bytes need reliable ordered delivery.',
      reflectionPrompt:
        'What application-level recovery could change one of these choices?',
      prompts: [
        { id: 'position', label: 'Frequent player positions; newer updates supersede old ones', correctChoiceId: 'udp' },
        { id: 'chat', label: 'Chat messages that must arrive once and in order', correctChoiceId: 'tcp' },
        { id: 'asset', label: 'A downloadable level file that must be byte-perfect', correctChoiceId: 'tcp' },
      ],
      choices: [
        { id: 'tcp', label: 'TCP: reliable, ordered byte stream' },
        { id: 'udp', label: 'UDP: message delivery without built-in reliability or ordering' },
      ],
      incorrectFeedback:
        'Reconsider the cost of a missing message, the usefulness of late data, and whether order is part of the requirement.',
    },
    deepPracticeUrl: '/SEBook/tools/nodejs',
    lectureSources: [{ file: 'L5-ClientServerNodeJS.pdf', pages: '6-20, 22-39' }],
  },
  {
    id: 'event-loop-reactor',
    districtId: 'history-network',
    sequence: 7,
    title: 'Event-Loop Reactor',
    shortTitle: 'Event Loop',
    briefing:
      'A Node service schedules a timer and a resolved promise. Predict the observable order before running it.',
    objectives: [
      'Reason about synchronous work, microtasks, and timer callbacks.',
      'Explain why scheduling work does not block following statements.',
    ],
    prerequisiteQuestIds: ['packet-courier'],
    challenge: {
      id: 'event-loop-order',
      kind: 'ordering',
      phase: 'predict',
      title: 'Order the console output',
      prompt: 'Move the output lines into the order in which they appear.',
      context:
        'console.log("Start");\nsetTimeout(() => console.log("Timer"), 0);\nPromise.resolve().then(() => console.log("Promise"));\nconsole.log("End");',
      hint: 'Synchronous statements finish first. Promise reactions run before the next timer task.',
      successFeedback:
        'The current stack prints Start and End, the promise microtask runs next, and the timer callback runs afterward.',
      reflectionPrompt:
        'Why does a zero-millisecond timer not run immediately?',
      items: [
        { id: 'timer', label: 'Timer' },
        { id: 'start', label: 'Start' },
        { id: 'promise', label: 'Promise' },
        { id: 'end', label: 'End' },
      ],
      correctOrder: ['start', 'end', 'promise', 'timer'],
      incorrectFeedback:
        'Separate the current call stack from queued microtasks and timer tasks, then order the queues.',
    },
    deepPracticeUrl: '/SEBook/tools/nodejs-tutorial',
    lectureSources: [{ file: 'L5-ClientServerNodeJS.pdf', pages: '44-55' }],
  },
  {
    id: 'react-state-workshop',
    districtId: 'interface-modeling',
    sequence: 8,
    title: 'React State Workshop',
    shortTitle: 'React State',
    briefing:
      'A search field and results list need one consistent source of truth across sibling components.',
    objectives: [
      'Identify minimal state and its owner.',
      'Keep domain behavior independent of presentation components.',
    ],
    prerequisiteQuestIds: ['event-loop-reactor'],
    challenge: {
      id: 'react-state-owner',
      kind: 'choice',
      phase: 'repair',
      title: 'Choose the state owner',
      prompt:
        'SearchInput and ResultsList are siblings. Both need the current query. Where should the query state live?',
      hint: 'Choose the nearest common owner that must coordinate both children.',
      successFeedback:
        'The common parent owns the single source of truth, passes the value down, and receives changes through a callback.',
      reflectionPrompt:
        'Which values can be derived from the query instead of stored as additional state?',
      correctOptionId: 'common-parent',
      options: [
        {
          id: 'duplicate',
          label: 'Store a separate query state in both children.',
          feedback:
            'Duplicated state can diverge and requires synchronization that the component tree does not need.',
        },
        {
          id: 'common-parent',
          label: 'Store the query in their nearest common parent and pass props down.',
          feedback: 'This gives both children one coordinated source of truth.',
        },
        {
          id: 'dom',
          label: 'Read the input directly from the DOM whenever ResultsList renders.',
          feedback:
            'Imperative DOM reads bypass React data flow and make behavior harder to reason about and test.',
        },
      ],
    },
    deepPracticeUrl: '/SEBook/tools/react-tutorial',
    lectureSources: [{ file: 'L6-UI_Dev_React.pdf', pages: '20-41' }],
  },
  {
    id: 'observer-signal-grid',
    districtId: 'interface-modeling',
    sequence: 9,
    title: 'Observer Signal Grid',
    shortTitle: 'Observer Grid',
    briefing:
      'A screen receives every update twice after navigating away and back. Identify the lifecycle repairs that preserve decoupling.',
    objectives: [
      'Apply Observer registration and notification roles.',
      'Diagnose duplicate subscriptions and lifecycle leaks.',
    ],
    prerequisiteQuestIds: ['react-state-workshop'],
    challenge: {
      id: 'observer-lifecycle',
      kind: 'select-many',
      phase: 'repair',
      title: 'Stop duplicate notifications',
      prompt: 'Select every change required for a robust repair.',
      hint: 'A correct subscription needs both a unique registration and a matching cleanup path.',
      successFeedback:
        'Idempotent registration plus lifecycle cleanup restores one notification per observer without coupling the subject to a screen type.',
      reflectionPrompt:
        'What debugging cost does event-based decoupling introduce even after this repair?',
      correctOptionIds: ['deduplicate', 'unsubscribe'],
      incompleteFeedback:
        'The repair must prevent duplicate registration and remove the observer when its lifetime ends.',
      options: [
        { id: 'deduplicate', label: 'Prevent the same observer from being registered twice.', feedback: '' },
        { id: 'unsubscribe', label: 'Unsubscribe when the screen unmounts or leaves the workflow.', feedback: '' },
        { id: 'subject-knows-ui', label: 'Make the subject import and update this screen directly.', feedback: '' },
        { id: 'ignore-second', label: 'Have the screen ignore every second notification.', feedback: '' },
      ],
    },
    deepPracticeUrl: '/SEBook/designprinciples/soc',
    lectureSources: [{ file: 'L6-UI_Dev_React.pdf', pages: '8-16' }],
  },
  {
    id: 'model-lens-observatory',
    districtId: 'interface-modeling',
    sequence: 10,
    title: 'Model Lens Observatory',
    shortTitle: 'Model Lenses',
    briefing:
      'Architecture reviewers ask four different questions. Choose the model view that makes each answer visible without claiming one diagram shows everything.',
    objectives: [
      'Select a model view for a specific design question.',
      'Distinguish structural, data, interaction, and behavioral views.',
    ],
    prerequisiteQuestIds: ['observer-signal-grid'],
    challenge: {
      id: 'model-view-matching',
      kind: 'matching',
      phase: 'transfer',
      title: 'Aim the right modeling lens',
      prompt: 'Match each reviewer question to the most direct model view.',
      hint: 'Ask whether the question is about ownership, persistent relationships, messages over time, or state transitions.',
      successFeedback:
        'Each view answers a different family of questions; together they provide complementary evidence.',
      reflectionPrompt:
        'Which facts would need to agree across more than one of these views?',
      prompts: [
        { id: 'ownership', label: 'Which object owns and composes each collaborator?', correctChoiceId: 'class' },
        { id: 'persistent', label: 'How do students and courses relate in stored data?', correctChoiceId: 'data' },
        { id: 'messages', label: 'In what order do client and server messages occur?', correctChoiceId: 'sequence' },
        { id: 'lifecycle', label: 'Which transitions can move an order from pending to shipped?', correctChoiceId: 'state' },
      ],
      choices: [
        { id: 'class', label: 'Class or module view' },
        { id: 'data', label: 'Entity-relationship data view' },
        { id: 'sequence', label: 'Sequence interaction view' },
        { id: 'state', label: 'State-machine behavioral view' },
      ],
      incorrectFeedback:
        'Choose the view whose primary notation directly represents the relationship or time dimension in the question.',
    },
    deepPracticeUrl: '/SEBook/designprinciples',
    lectureSources: [{ file: 'L7-ModelingDesignPrinciples.pdf', pages: '8-20' }],
  },
  {
    id: 'solid-surgery',
    districtId: 'interface-modeling',
    sequence: 11,
    title: 'SOLID Surgery',
    shortTitle: 'SOLID Surgery',
    briefing:
      'A Square subtype silently violates a Rectangle client that sets width and height independently.',
    objectives: [
      'Evaluate behavioral substitutability rather than inheritance syntax.',
      'Choose a design that preserves explicit contracts.',
    ],
    prerequisiteQuestIds: ['model-lens-observatory'],
    challenge: {
      id: 'lsp-repair',
      kind: 'choice',
      phase: 'explain',
      title: 'Repair the substitutability failure',
      prompt: 'Which redesign best addresses the broken client contract?',
      hint: 'The client expects width and height to vary independently. A subtype must preserve that behavior.',
      successFeedback:
        'Separate immutable shape concepts avoid claiming a behavioral subtype relationship that the contracts cannot support.',
      reflectionPrompt:
        'What client test provides the smallest counterexample to the original inheritance design?',
      correctOptionId: 'separate-shapes',
      options: [
        {
          id: 'override-more',
          label: 'Override both setters in Square so each changes both dimensions.',
          feedback:
            'That preserves square geometry but still violates Rectangle clients that require independent dimensions.',
        },
        {
          id: 'separate-shapes',
          label: 'Model Rectangle and Square as separate shapes behind a smaller common area contract.',
          feedback:
            'This keeps only genuinely shared behavior in the abstraction and removes the false subtype promise.',
        },
        {
          id: 'document',
          label: 'Document that Rectangle setters behave differently for Square.',
          feedback:
            'Documentation exposes the violation but does not restore substitutability for existing clients.',
        },
      ],
    },
    deepPracticeUrl: '/SEBook/designprinciples/solid',
    lectureSources: [{ file: 'L7-ModelingDesignPrinciples.pdf', pages: '22-29' }],
  },
  {
    id: 'query-refinery',
    districtId: 'data-reliability',
    sequence: 12,
    title: 'Query Refinery',
    shortTitle: 'Query Refinery',
    briefing:
      'Find the names of students enrolled in CS 35L by composing relational operations in a useful order.',
    objectives: [
      'Distinguish join, selection, projection, and duplicate elimination.',
      'Translate a natural-language question into relational operations.',
    ],
    prerequisiteQuestIds: ['model-lens-observatory'],
    challenge: {
      id: 'query-operation-order',
      kind: 'ordering',
      phase: 'repair',
      title: 'Assemble the relational pipeline',
      prompt: 'Arrange the operations into a correct and reasonably selective pipeline.',
      hint: 'First connect enrollment rows to courses, then restrict the course, then connect students, and finally select the requested column.',
      successFeedback:
        'The joins establish the relationships, early selection removes unrelated courses, and projection returns only the requested names.',
      reflectionPrompt:
        'Where might duplicate elimination be needed if a student can have repeated enrollment records?',
      items: [
        { id: 'project', label: 'Project the student name column' },
        { id: 'join-course', label: 'Join enrollments with courses using the course key' },
        { id: 'join-student', label: 'Join the remaining rows with students using the student key' },
        { id: 'select', label: 'Select rows whose course code is CS 35L' },
      ],
      correctOrder: ['join-course', 'select', 'join-student', 'project'],
      incorrectFeedback:
        'Build the required relationships before reading their attributes, and filter unrelated course rows before the final projection.',
    },
    deepPracticeUrl: '/SEBook/tools/sql-tutorial',
    lectureSources: [{ file: 'L8_Data_Management.pdf', pages: '4-16' }],
  },
  {
    id: 'transaction-blackout',
    districtId: 'data-reliability',
    sequence: 13,
    title: 'Transaction Blackout',
    shortTitle: 'Transactions',
    briefing:
      'A power failure can occur between debiting one account and crediting another.',
    objectives: [
      'Define a semantic transaction boundary.',
      'Connect failure behavior to atomicity and consistency.',
    ],
    prerequisiteQuestIds: ['query-refinery'],
    challenge: {
      id: 'transfer-boundary',
      kind: 'choice',
      phase: 'repair',
      title: 'Protect the transfer invariant',
      prompt: 'Which transaction boundary preserves the total balance through a crash?',
      hint: 'The debit and credit are one business operation even though they are two statements.',
      successFeedback:
        'One transaction makes the transfer all-or-nothing and preserves the cross-account invariant after recovery.',
      reflectionPrompt:
        'Which concurrent behavior would require an isolation decision in addition to atomicity?',
      correctOptionId: 'both',
      options: [
        { id: 'debit', label: 'Commit immediately after the debit.', feedback: 'A crash after this commit can permanently remove money before the credit occurs.' },
        { id: 'both', label: 'Commit the debit and credit together as one transaction.', feedback: 'This treats the business transfer as the atomic unit.' },
        { id: 'credit', label: 'Commit only the credit and retry the debit later.', feedback: 'A crash or retry can create money or apply one side more than once.' },
      ],
    },
    deepPracticeUrl: '/SEBook/systems/data_management',
    lectureSources: [{ file: 'L8_Data_Management.pdf', pages: '17-26' }],
  },
  {
    id: 'test-architect',
    districtId: 'data-reliability',
    sequence: 14,
    title: 'Test Architect Arena',
    shortTitle: 'Test Architect',
    briefing:
      'A discount function is green under a weak test suite. Build evidence that would catch boundary and contract regressions.',
    objectives: [
      'Choose partitions and boundary values systematically.',
      'Prefer strong behavior-focused oracles over implementation checks.',
    ],
    prerequisiteQuestIds: ['story-forge', 'transaction-blackout'],
    challenge: {
      id: 'test-evidence-set',
      kind: 'select-many',
      phase: 'explain',
      title: 'Select the meaningful evidence',
      prompt:
        'A student discount applies when age is at most 25. Select every test that belongs in the smallest useful regression set.',
      hint: 'Probe both sides of the transition and assert the exact behavior promised by the public function.',
      successFeedback:
        'The set pins the last eligible and first ineligible ages with exact public outcomes, catching an off-by-one regression.',
      reflectionPrompt:
        'Which additional partition would you add if malformed ages are part of the public contract?',
      correctOptionIds: ['age-25', 'age-26'],
      incompleteFeedback:
        'The useful set needs exact assertions immediately on both sides of the eligibility boundary, without pinning private helpers.',
      options: [
        { id: 'age-25', label: 'Age 25 returns the exact discounted price.', feedback: '' },
        { id: 'age-26', label: 'Age 26 returns the exact regular price.', feedback: '' },
        { id: 'not-null', label: 'Age 20 returns a value that is not null.', feedback: '' },
        { id: 'helper-call', label: 'The private `calculateDiscount` helper is called once.', feedback: '' },
      ],
    },
    deepPracticeUrl: '/SEBook/testing/testing-foundations-tutorial',
    lectureSources: [{ file: 'L9_Testing.pdf', pages: '9-47, 48-64' }],
  },
  {
    id: 'bug-detective',
    districtId: 'data-reliability',
    sequence: 15,
    title: 'Bug Detective Time Loop',
    shortTitle: 'Bug Detective',
    briefing:
      'A production calculation fails intermittently. Restore a hypothesis-driven debugging sequence instead of editing at random.',
    objectives: [
      'Move from reproducible failure to fault localization.',
      'Verify the repair with a regression test and traceable change.',
    ],
    prerequisiteQuestIds: ['test-architect'],
    challenge: {
      id: 'debugging-order',
      kind: 'ordering',
      phase: 'repair',
      title: 'Order the investigation',
      prompt: 'Arrange the major debugging actions into a defensible workflow.',
      hint: 'Evidence precedes repair, and a verified fix needs a test that reproduces the original failure.',
      successFeedback:
        'The workflow establishes reproducibility, minimizes the case, tests a hypothesis, repairs the fault, and prevents recurrence.',
      reflectionPrompt:
        'At which step would a conditional breakpoint provide the most value?',
      items: [
        { id: 'repair', label: 'Make the smallest causal repair' },
        { id: 'reproduce', label: 'Reproduce the failure in a controlled environment' },
        { id: 'regression', label: 'Keep the reproduction as a regression test' },
        { id: 'hypothesis', label: 'Form and test a fault hypothesis with logs or a debugger' },
        { id: 'minimize', label: 'Minimize the failing input and conditions' },
      ],
      correctOrder: ['reproduce', 'minimize', 'hypothesis', 'repair', 'regression'],
      incorrectFeedback:
        'Do not repair before you can reproduce and localize the failure; do not stop before the original case becomes permanent evidence.',
    },
    deepPracticeUrl: '/SEBook/development_practices/debugging',
    lectureSources: [{ file: 'L10_Debugging_git.pdf', pages: '4-28' }],
  },
  {
    id: 'git-recovery-heist',
    districtId: 'data-reliability',
    sequence: 16,
    title: 'Git Recovery Heist',
    shortTitle: 'Git Recovery',
    briefing:
      'A bad commit is already on a shared branch. Remove its effect without erasing teammates’ later history.',
    objectives: [
      'Distinguish history-preserving and history-rewriting operations.',
      'Choose a recovery operation from collaboration risk.',
    ],
    prerequisiteQuestIds: ['bug-detective', 'git-snapshot-lab'],
    challenge: {
      id: 'git-public-recovery',
      kind: 'choice',
      phase: 'transfer',
      title: 'Protect shared history',
      prompt: 'Which operation should be the default repair for the published bad commit?',
      hint: 'The branch is shared and later valid commits must retain their identities.',
      successFeedback:
        'Revert records a new inverse change while preserving the public graph and later commits.',
      reflectionPrompt:
        'When would an interactive rebase be appropriate instead?',
      correctOptionId: 'revert',
      options: [
        { id: 'reset', label: 'Reset the branch hard to the parent and force-push.', feedback: 'That rewrites shared history and can discard teammates’ reachable commits.' },
        { id: 'revert', label: 'Revert the bad commit and push the new inverse commit.', feedback: 'This preserves the shared history while removing the bad effect.' },
        { id: 'stash', label: 'Stash the working tree.', feedback: 'Stash protects uncommitted local changes; it does not undo a published commit.' },
      ],
    },
    deepPracticeUrl: '/SEBook/tools/git-advanced-tutorial',
    lectureSources: [{ file: 'L10_Debugging_git.pdf', pages: '30-45' }],
  },
  {
    id: 'castle-breach',
    districtId: 'security-supply',
    sequence: 17,
    title: 'Castle Breach Simulator',
    shortTitle: 'Castle Breach',
    briefing:
      'A login query concatenates untrusted input into executable SQL. Repair the boundary and reduce the compromised account’s blast radius.',
    objectives: [
      'Separate code from untrusted data.',
      'Apply explicit trust boundaries and least privilege.',
    ],
    prerequisiteQuestIds: ['query-refinery', 'event-loop-reactor'],
    challenge: {
      id: 'sql-injection-defense',
      kind: 'select-many',
      phase: 'repair',
      title: 'Close the injection path',
      prompt: 'Select every defense required for this repair.',
      hint: 'Prevent input from becoming SQL syntax, then constrain what the application identity can do if another defect remains.',
      successFeedback:
        'Parameterized queries preserve the code/data boundary, and least privilege limits the consequences of a future breach.',
      reflectionPrompt:
        'Which confidentiality, integrity, and availability harms could the original account permissions enable?',
      correctOptionIds: ['parameterize', 'least-privilege'],
      incompleteFeedback:
        'A complete repair removes string-concatenated SQL and reduces the database identity’s authority.',
      options: [
        { id: 'parameterize', label: 'Use a parameterized query or prepared statement.', feedback: '' },
        { id: 'least-privilege', label: 'Give the application account only the required table operations.', feedback: '' },
        { id: 'blacklist', label: 'Delete apostrophes from every input string.', feedback: '' },
        { id: 'hide-query', label: 'Obfuscate the query text in the client bundle.', feedback: '' },
      ],
    },
    deepPracticeUrl: '/SEBook/systems/security',
    lectureSources: [{ file: 'L11_Security.pdf', pages: '3-20, 31-35' }],
  },
  {
    id: 'dependency-bazaar',
    districtId: 'security-supply',
    sequence: 18,
    title: 'Dependency Bazaar',
    shortTitle: 'Dependency Bazaar',
    briefing:
      'Choose a scheduling package whose download count is high but whose maintenance, transitive graph, and fit are uncertain.',
    objectives: [
      'Evaluate reuse with context, maintenance, compatibility, and change cost.',
      'Balance reproducibility with a deliberate update path.',
    ],
    prerequisiteQuestIds: ['castle-breach'],
    challenge: {
      id: 'reuse-evidence',
      kind: 'select-many',
      phase: 'explain',
      title: 'Request the decision evidence',
      prompt: 'Select every evidence source needed before adopting the package.',
      hint: 'Popularity is only one signal. Include fit, maintenance, indirect dependencies, and exit cost.',
      successFeedback:
        'The evidence covers current fit, stewardship, supply-chain exposure, and the future cost of updating or leaving.',
      reflectionPrompt:
        'Which uncertain decision could be delayed behind an adapter?',
      correctOptionIds: ['fit', 'maintenance', 'transitive', 'exit'],
      incompleteFeedback:
        'The decision still lacks evidence about at least one of context fit, stewardship, transitive risk, or migration cost.',
      options: [
        { id: 'fit', label: 'Prototype the required scheduling edge cases and integration contract.', feedback: '' },
        { id: 'maintenance', label: 'Inspect release history, open issues, security response, and maintainers.', feedback: '' },
        { id: 'transitive', label: 'Trace transitive dependencies, licenses, and advisories.', feedback: '' },
        { id: 'exit', label: 'Estimate update, replacement, and lock-in costs.', feedback: '' },
        { id: 'stars-only', label: 'Use repository stars as the sole health criterion.', feedback: '' },
      ],
    },
    deepPracticeUrl: '/SEBook/designprinciples/reuse',
    lectureSources: [{ file: 'L12_Reuse.pdf', pages: '2-28' }],
  },
  {
    id: 'memory-dungeon',
    districtId: 'security-supply',
    sequence: 19,
    title: 'C Memory Dungeon',
    shortTitle: 'Memory Dungeon',
    briefing:
      'A native telemetry module owns heap memory and a file handle. Match each acquisition or contract to its required counterpart.',
    objectives: [
      'Reason about explicit resource lifetime and pointer contracts.',
      'Distinguish compilation, runtime ownership, and API constraints.',
    ],
    prerequisiteQuestIds: ['python-type-shifter'],
    challenge: {
      id: 'c-resource-matching',
      kind: 'matching',
      phase: 'repair',
      title: 'Close every resource lifetime',
      prompt: 'Match each C operation or type contract to its required interpretation.',
      hint: 'Ownership follows successful acquisition, and each declaration constrains a different side of pointer access.',
      successFeedback:
        'Each acquired resource has one clear release, and the pointer contracts distinguish data mutability from pointer rebinding.',
      reflectionPrompt:
        'What test or sanitizer would reveal an early return that skips one release?',
      prompts: [
        { id: 'malloc', label: 'Successful `malloc` owned by this function', correctChoiceId: 'free' },
        { id: 'fopen', label: 'Successful `fopen` owned by this function', correctChoiceId: 'fclose' },
        { id: 'pointer-const-data', label: '`const char *name`', correctChoiceId: 'data-readonly' },
        { id: 'const-pointer', label: '`char * const buffer`', correctChoiceId: 'pointer-fixed' },
      ],
      choices: [
        { id: 'free', label: 'Release exactly once with `free` after the final use' },
        { id: 'fclose', label: 'Close with `fclose` on every exit path' },
        { id: 'data-readonly', label: 'Characters are read-only through this pointer' },
        { id: 'pointer-fixed', label: 'The pointer cannot be rebound after initialization' },
      ],
      incorrectFeedback:
        'Trace ownership separately for heap and file resources, then read `const` relative to the pointer declarator.',
    },
    deepPracticeUrl: '/SEBook/tools/make',
    lectureSources: [{ file: 'L13_C_Make.pdf', pages: '2-16' }],
  },
  {
    id: 'build-factory',
    districtId: 'security-supply',
    sequence: 20,
    title: 'Bruin Build Factory',
    shortTitle: 'Build Factory',
    briefing:
      'Repair the dependency order from source files to an executable so Make can rebuild only what changed.',
    objectives: [
      'Model build prerequisites as a dependency graph.',
      'Distinguish compilation from linking.',
    ],
    prerequisiteQuestIds: ['memory-dungeon'],
    challenge: {
      id: 'make-dependency-order',
      kind: 'ordering',
      phase: 'repair',
      title: 'Assemble the build path',
      prompt: 'Arrange the artifacts from source input to final runnable output.',
      hint: 'Compilation produces object files. Linking combines objects and libraries into the executable.',
      successFeedback:
        'The dependency path lets Make compare timestamps and rerun only the compilation and linking steps affected by a change.',
      reflectionPrompt:
        'If only `utils.c` changes, which nodes should rebuild and which should remain untouched?',
      items: [
        { id: 'executable', label: 'Executable' },
        { id: 'source', label: 'C source and included headers' },
        { id: 'link', label: 'Link objects and required libraries' },
        { id: 'object', label: 'Compile to object files' },
      ],
      correctOrder: ['source', 'object', 'link', 'executable'],
      incorrectFeedback:
        'Separate the compiler’s source-to-object job from the linker’s object-to-executable job.',
    },
    deepPracticeUrl: '/SEBook/tools/makefile-tutorial',
    lectureSources: [{ file: 'L13_C_Make.pdf', pages: '13, 18-31' }],
  },
  {
    id: 'ai-intern-command',
    districtId: 'security-supply',
    sequence: 21,
    title: 'AI Intern Command Center',
    shortTitle: 'AI Intern',
    briefing:
      'A coding agent produced a plausible patch for an authentication bug. Keep human responsibility for the specification and evidence.',
    objectives: [
      'Delegate only bounded, verifiable work.',
      'Close the explainability gap through review, tests, and modification.',
    ],
    prerequisiteQuestIds: ['test-architect', 'castle-breach', 'dependency-bazaar'],
    challenge: {
      id: 'ai-verification-controls',
      kind: 'select-many',
      phase: 'explain',
      title: 'Supervise the generated patch',
      prompt: 'Select every required control before accepting the patch.',
      hint: 'Fluent code and agent-generated tests are not independent evidence. The human must understand and challenge both.',
      successFeedback:
        'The workflow keeps the task bounded, makes the behavior explicit, independently probes the patch, and requires transferable understanding.',
      reflectionPrompt:
        'Which lower-risk subtask could safely be delegated after this review?',
      correctOptionIds: ['scope', 'explain', 'independent-tests', 'variant'],
      incompleteFeedback:
        'Acceptance still lacks one of the necessary controls: bounded scope, explanation, independent behavioral evidence, or transfer through modification.',
      options: [
        { id: 'scope', label: 'Check that the patch stayed inside the requested files and behavior.', feedback: '' },
        { id: 'explain', label: 'Explain every changed behavior and security assumption.', feedback: '' },
        { id: 'independent-tests', label: 'Add or review adversarial tests from the human-owned contract.', feedback: '' },
        { id: 'variant', label: 'Modify the solution for a related requirement without asking the agent to redo it.', feedback: '' },
        { id: 'agent-confidence', label: 'Accept it if the agent reports high confidence.', feedback: '' },
      ],
    },
    deepPracticeUrl: '/SEBook/development_practices/genAI',
    lectureSources: [{ file: 'L14_Gen_AI.pdf', pages: '5-34' }],
  },
  {
    id: 'api-treaty-table',
    districtId: 'architecture-council',
    sequence: 22,
    title: 'API Treaty Table',
    shortTitle: 'API Treaty',
    briefing:
      'Independent travel systems exchange schema-valid booking messages but disagree about units, side effects, and provider-specific fields.',
    objectives: [
      'Distinguish structural compatibility from shared semantics.',
      'Localize translation while documenting observable behavior.',
    ],
    prerequisiteQuestIds: ['packet-courier', 'transaction-blackout', 'castle-breach'],
    challenge: {
      id: 'api-mismatch-matching',
      kind: 'matching',
      phase: 'transfer',
      title: 'Route each interoperability mismatch',
      prompt: 'Match each problem to the mechanism that most directly addresses it.',
      hint: 'Schemas address shape. Semantic contracts address meaning. Adapters localize provider-specific translation.',
      successFeedback:
        'The treaty separates structural validation, semantic meaning, and localized translation instead of asking one mechanism to solve everything.',
      reflectionPrompt:
        'Which semantic disagreement cannot be repaired until the organizations choose a shared meaning?',
      prompts: [
        { id: 'missing-field', label: 'A required passenger identifier is absent', correctChoiceId: 'schema' },
        { id: 'units', label: 'One provider sends newtons and another expects pound-force', correctChoiceId: 'semantic' },
        { id: 'provider-shape', label: 'One airline nests baggage options under a proprietary field', correctChoiceId: 'adapter' },
        { id: 'side-effect', label: 'Clients do not know whether a retry creates a second booking', correctChoiceId: 'semantic' },
      ],
      choices: [
        { id: 'schema', label: 'Shared structural schema validation' },
        { id: 'semantic', label: 'Explicit semantic contract with units, effects, and errors' },
        { id: 'adapter', label: 'Provider adapter plus integration tests' },
      ],
      incorrectFeedback:
        'Do not ask structural validation to establish meaning or an adapter to invent semantics that no participant has defined.',
    },
    deepPracticeUrl: '/SEBook/quality_attributes/interoperability',
    lectureSources: [
      { file: 'L15_Interoperability.pdf', pages: '8-40' },
      { file: 'L17_Code_Comprehension_API_Design.pdf', pages: '19-48' },
    ],
  },
  {
    id: 'interface-iceberg',
    districtId: 'architecture-council',
    sequence: 23,
    title: 'Interface Iceberg',
    shortTitle: 'Interface Iceberg',
    briefing:
      'Checkout, refunds, and wallet code all import one payment provider directly. A likely provider change now touches the entire system.',
    objectives: [
      'Hide volatile design decisions behind a stable contract.',
      'Evaluate module depth, cohesion, and change impact.',
    ],
    prerequisiteQuestIds: ['dependency-bazaar', 'api-treaty-table'],
    challenge: {
      id: 'deep-module-choice',
      kind: 'choice',
      phase: 'repair',
      title: 'Localize payment volatility',
      prompt: 'Which boundary most directly reduces the provider-change blast radius?',
      hint: 'The stable application concepts are authorize, refund, and transfer—not the provider’s request objects.',
      successFeedback:
        'An application-owned payment gateway presents a small domain contract while one adapter contains provider-specific details.',
      reflectionPrompt:
        'Which provider behavior must remain visible because callers genuinely depend on it?',
      correctOptionId: 'gateway',
      options: [
        { id: 'gateway', label: 'Define a domain payment gateway and isolate the provider in one adapter.', feedback: 'This makes dependencies point toward the stable application contract.' },
        { id: 'utils', label: 'Copy provider helper calls into a shared `paymentUtils` file.', feedback: 'A shared file centralizes syntax but still exposes provider-shaped details to every caller.' },
        { id: 'micro-wrappers', label: 'Create one one-line wrapper module for every provider method.', feedback: 'Many shallow wrappers preserve the provider interface and add navigation cost without hiding the volatile decision.' },
      ],
    },
    deepPracticeUrl: '/SEBook/designprinciples/information-hiding-tutorial',
    lectureSources: [
      { file: 'L15_ManagingComplexity.pdf', pages: '3-40' },
      { file: 'L16_ManagingComplexity.pdf', pages: '3-40' },
    ],
  },
  {
    id: 'beacon-refactoring',
    districtId: 'architecture-council',
    sequence: 24,
    title: 'False Beacon Refactoring Lab',
    shortTitle: 'False Beacons',
    briefing:
      'A misleading name and nested control flow send readers toward the wrong hypothesis about a discount rule.',
    objectives: [
      'Use truthful names and guard clauses to reduce cognitive load.',
      'Preserve observable behavior under tests while refactoring.',
    ],
    prerequisiteQuestIds: ['interface-iceberg', 'test-architect'],
    challenge: {
      id: 'clean-code-refactor',
      kind: 'choice',
      phase: 'repair',
      title: 'Restore the code’s truthful shape',
      prompt: 'Which first refactoring most improves comprehension without changing behavior?',
      context:
        'function applyBonus(user) {\n  if (user.active) {\n    if (user.balance > 0) {\n      if (!user.suspended) return user.balance * 0.1;\n    }\n  }\n  return 0;\n}',
      hint: 'Expose disqualifying conditions early so the normal calculation is no longer buried.',
      successFeedback:
        'Guard clauses name the invalid cases and leave the bonus calculation as the visible normal path.',
      reflectionPrompt:
        'Which contract-focused tests would let you perform this refactor safely?',
      correctOptionId: 'guards',
      options: [
        { id: 'comment', label: 'Add a comment above every `if` that repeats its condition.', feedback: 'Literal comments add reading load without clarifying intent or structure.' },
        { id: 'guards', label: 'Replace the nesting with named guard clauses for inactive, nonpositive, and suspended users.', feedback: 'This makes disqualifying cases explicit and reveals the normal path.' },
        { id: 'short-names', label: 'Rename `user` to `u` and `balance` to `b` to shorten the function.', feedback: 'Shorter tokens reduce characters but remove useful domain meaning.' },
      ],
    },
    deepPracticeUrl: '/SEBook/development_practices/code_comprehension',
    lectureSources: [
      { file: 'L17_CleanCode.pdf', pages: '7-38' },
      { file: 'L17_Code_Comprehension_API_Design.pdf', pages: '2-18' },
    ],
  },
  {
    id: 'review-control-room',
    districtId: 'architecture-council',
    sequence: 25,
    title: 'Pull Request Control Room',
    shortTitle: 'Review Control',
    briefing:
      'A large change contains one contract defect, several style preferences, and an undocumented semantic side effect. Prioritize the review finding that protects users and future maintainers.',
    objectives: [
      'Give specific, evidence-linked review feedback.',
      'Prioritize contracts, maintainability, and knowledge transfer over noise.',
    ],
    prerequisiteQuestIds: ['beacon-refactoring'],
    challenge: {
      id: 'review-comment-value',
      kind: 'choice',
      phase: 'explain',
      title: 'Choose the highest-value review comment',
      prompt: 'Which comment should block this booking API change?',
      hint: 'Look for a user-visible contract risk with a reproducible counterexample and a concrete repair direction.',
      successFeedback:
        'The comment names the violated contract, supplies a counterexample, and proposes evidence that will prevent recurrence.',
      reflectionPrompt:
        'Which remaining comments could be automated or left as nonblocking suggestions?',
      correctOptionId: 'contract',
      options: [
        { id: 'spacing', label: '“Please align the object literals vertically; I prefer this style.”', feedback: 'This is a subjective style preference with no demonstrated risk and is better handled by formatting automation.' },
        { id: 'contract', label: '“Retrying after a timeout creates a second booking. Add an idempotency key and a test that repeats the same request.”', feedback: 'This links a concrete failure to the public contract and a regression oracle.' },
        { id: 'rename-all', label: '“Rename every local variable so the patch looks cleaner.”', feedback: 'Some naming feedback may help, but a blanket request is unspecific and does not address the known contract defect.' },
      ],
    },
    deepPracticeUrl: '/SEBook/development_practices/modern_code_review',
    lectureSources: [{ file: 'L18_Code_Review.pdf', pages: '2-46' }],
  },
  {
    id: 'process-architect',
    districtId: 'architecture-council',
    sequence: 26,
    title: 'Risk-Driven Process Architect',
    shortTitle: 'Process Architect',
    briefing:
      'Four teams face different failure costs, uncertainty, and reversibility. Tailor process and upfront design to the risk instead of applying one ideology everywhere.',
    objectives: [
      'Compare iterative, plan-driven, and risk-driven practices.',
      'Decide expensive-to-change risks early while deferring reversible choices.',
    ],
    prerequisiteQuestIds: ['interface-iceberg', 'review-control-room'],
    challenge: {
      id: 'process-context-matching',
      kind: 'matching',
      phase: 'transfer',
      title: 'Tailor the process',
      prompt: 'Match each project context to the strongest starting emphasis.',
      hint: 'Use failure cost, requirement uncertainty, and reversibility—not organization prestige—as the decision criteria.',
      successFeedback:
        'The process changes with the dominant risk: rapid learning for reversible uncertainty, and deeper assurance for irreversible high-consequence choices.',
      reflectionPrompt:
        'Which practices should all four teams share even though their planning balance differs?',
      prompts: [
        { id: 'startup', label: 'A reversible social prototype with uncertain user demand', correctChoiceId: 'iterative' },
        { id: 'spacecraft', label: 'A flight-control interface whose hardware cannot be repaired after launch', correctChoiceId: 'assurance' },
        { id: 'platform', label: 'A growing platform with uncertain scale and a few costly architecture risks', correctChoiceId: 'risk-driven' },
      ],
      choices: [
        { id: 'iterative', label: 'Short experiments and frequent user feedback' },
        { id: 'assurance', label: 'Extensive hazard analysis, verification, and planned evidence' },
        { id: 'risk-driven', label: 'Iterate broadly while addressing the hardest-to-change risks early' },
      ],
      incorrectFeedback:
        'Re-evaluate the cost of failure, the cost of changing course later, and how much uncertainty each iteration can safely resolve.',
    },
    deepPracticeUrl: '/SEBook/process',
    lectureSources: [
      { file: 'L18_Process.pdf', pages: '2-37' },
      { file: 'L19_Process.pdf', pages: '2-37' },
    ],
  },
  {
    id: 'coupled-crisis',
    districtId: 'integration-core',
    sequence: 27,
    title: 'Final Boss: The Coupled Crisis',
    shortTitle: 'Coupled Crisis',
    briefing:
      'A reused booking adapter interprets the wrong units, accepts injectable input, has weak tests, and was deployed in one oversized change. Restore the system in a defensible order.',
    objectives: [
      'Integrate containment, reproduction, testing, modular repair, review, and learning.',
      'Justify intervention order from risk and evidence.',
    ],
    prerequisiteQuestIds: [
      'api-treaty-table',
      'interface-iceberg',
      'review-control-room',
      'process-architect',
    ],
    challenge: {
      id: 'coupled-crisis-order',
      kind: 'ordering',
      phase: 'transfer',
      title: 'Lead the incident response',
      prompt: 'Arrange the response into a safe evidence-driven sequence.',
      hint: 'First reduce ongoing harm. Then establish reproducible evidence before repairing and redeploying.',
      successFeedback:
        'The response contains harm, builds a reproducible oracle, repairs the fault behind a boundary, reviews and deploys safely, then captures organizational learning.',
      reflectionPrompt:
        'Which earlier design choice most reduced the eventual repair blast radius?',
      items: [
        { id: 'postmortem', label: 'Document causes, trade-offs, and prevention work in a blameless review' },
        { id: 'contain', label: 'Contain active harm and reduce the compromised component’s privileges' },
        { id: 'repair', label: 'Repair units, input handling, and adapter behavior behind the stable contract' },
        { id: 'reproduce', label: 'Reproduce the failures and encode strong regression and integration tests' },
        { id: 'deploy', label: 'Review a small patch and deploy it with rollback evidence' },
      ],
      correctOrder: ['contain', 'reproduce', 'repair', 'deploy', 'postmortem'],
      incorrectFeedback:
        'Contain current damage before investigation, require a reproducible oracle before the repair, and capture learning only after safe restoration.',
    },
    lectureSources: [
      { file: 'L19_Summary.pdf', pages: '3-34' },
      { file: 'L20_Summary.pdf', pages: '1-37' },
    ],
    isCapstone: true,
  },
] as const satisfies readonly QuestDefinition[];

export const DISTRICTS = [
  {
    id: 'briefing-bay',
    title: 'Briefing Bay',
    description: 'Requirements, acceptance evidence, and the learner’s mission contract.',
    questIds: ['story-forge'],
  },
  {
    id: 'automation-works',
    title: 'Automation Works',
    description: 'Text streams, encodings, shell composition, and Python reasoning.',
    questIds: ['pipeworks-control', 'encoding-rescue', 'python-type-shifter'],
  },
  {
    id: 'history-network',
    title: 'History and Network Nexus',
    description: 'Git state, protocol trade-offs, and asynchronous execution.',
    questIds: ['git-snapshot-lab', 'packet-courier', 'event-loop-reactor'],
  },
  {
    id: 'interface-modeling',
    title: 'Interface and Modeling Studio',
    description: 'React data flow, Observer lifecycles, model views, and design principles.',
    questIds: ['react-state-workshop', 'observer-signal-grid', 'model-lens-observatory', 'solid-surgery'],
  },
  {
    id: 'data-reliability',
    title: 'Data and Reliability Vault',
    description: 'Relational reasoning, transactions, testing, debugging, and Git recovery.',
    questIds: ['query-refinery', 'transaction-blackout', 'test-architect', 'bug-detective', 'git-recovery-heist'],
  },
  {
    id: 'security-supply',
    title: 'Security and Supply Forge',
    description: 'Trust boundaries, reuse, C resources, Make dependencies, and responsible AI use.',
    questIds: ['castle-breach', 'dependency-bazaar', 'memory-dungeon', 'build-factory', 'ai-intern-command'],
  },
  {
    id: 'architecture-council',
    title: 'Architecture Council',
    description: 'Interoperability, information hiding, comprehension, review, and process choices.',
    questIds: ['api-treaty-table', 'interface-iceberg', 'beacon-refactoring', 'review-control-room', 'process-architect'],
  },
  {
    id: 'integration-core',
    title: 'Integration Core',
    description: 'A cumulative incident that requires the whole software-construction toolkit.',
    questIds: ['coupled-crisis'],
  },
] as const satisfies readonly DistrictDefinition[];

export const QUEST_BY_ID: ReadonlyMap<string, QuestDefinition> = new Map(
  QUESTS.map((quest) => [quest.id, quest]),
);
export const DISTRICT_BY_ID: ReadonlyMap<string, DistrictDefinition> = new Map(
  DISTRICTS.map((district) => [district.id, district]),
);
export const CAPSTONE_REQUIRED_QUESTS = 20;
