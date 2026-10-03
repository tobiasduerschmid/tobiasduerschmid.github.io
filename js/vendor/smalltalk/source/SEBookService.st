Object subclass: #SEBookService
    instanceVariableNames: 'revision workspace inspector activeOperation requests limits generation browser changes transactions baselineId refactorings'
    classVariableNames: ''
    poolDictionaries: ''
    category: 'SEBook-Runtime'!

!SEBookService class methodsFor: 'image preparation'!
saveAndServe
    [self snapshotAndServe] forkAt: Processor userBackgroundPriority!
snapshotAndServe
    Smalltalk imageName: (FileDirectory default fullNameFor: 'sebook.image').
    Smalltalk snapshot: true andQuit: true.
    self new serve! !

!SEBookService methodsFor: 'initialization'!
initialize
    super initialize.
    revision := 0.
    workspace := SEBookWorkspace new. inspector := SEBookInspector new.
    requests := OrderedCollection new. browser := SEBookBrowser new.
    transactions := SEBookTransactions new service: self.
    refactorings := SEBookRefactorings new! !

!SEBookService methodsFor: 'transport primitives'!
nextRequest
    <primitive: 'primitiveNextRequest' module: 'SEBookPlugin'>
    ^ nil!
reply: aString
    <primitive: 'primitiveReply' module: 'SEBookPlugin'>
    ^ self! !

!SEBookService methodsFor: 'service'!
serve
    | configuration |
    configuration := SEBookJSON jsonFromString: self configuration.
    baselineId := configuration at: 'baselineId'.
    limits := configuration at: 'limits'. generation := configuration at: 'sessionId'.
    inspector configure: limits generation: generation.
    browser pageLimit: (limits at: 'pageSize').
    SEBookCheckpointRoots at: 4 put: self.
    SEBookStructuralGuard enabled ifTrue: [SEBookStructuralGuard install; captureTrustedCode].
    Smalltalk at: #Transcript put: SEBookTranscript new.
    Utilities authorName: 'SEBook learner'; authorInitials: 'sebook'.
    self send: (Dictionary new at: 'ready' put: true; yourself).
    [ | request |
      request := self nextRequest.
      request ifNotNil: [requests add: (SEBookJSON jsonFromString: request utf8Decoded)].
      (activeOperation isNil and: [requests notEmpty]) ifTrue: [
          request := requests removeFirst.
          (request at: 'operation') = 'checkpoint'
            ifTrue: [self checkpoint: request. request := nil]
            ifFalse: [
              activeOperation := [
                  [self answer: request] ensure: [activeOperation := nil]
              ] newProcess.
              activeOperation priority: Processor userBackgroundPriority.
              activeOperation resume]].
      (activeOperation isNil and: [transactions isPending not and: [changes notNil and: [changes isDirty]]]) ifTrue: [self reconcileBackground].
      (Delay forMilliseconds: 5) wait
    ] repeat!
configuration
    <primitive: 'primitiveConfiguration' module: 'SEBookPlugin'>
    ^ '{}'!
answer: request
    | response |
    self beginRequest: (request at: 'requestId').
    response := Dictionary new
        at: 'version' put: 1;
        at: 'sessionId' put: (request at: 'sessionId');
        at: 'requestId' put: (request at: 'requestId');
        at: 'revision' put: revision;
        yourself.
    [ (request at: 'operation') = 'prepareMutation' ifTrue: [self reconcileBackground].
      ((#('commitMutation' 'mutationStatus' 'abortMutation') includes: (request at: 'operation'))
        or: [(request at: 'expectedRevision') = revision])
        ifFalse: [self error: 'STALE_REVISION'].
      response at: 'result' put: (self performOperation: (request at: 'operation') payload: (request at: 'payload'))
    ] on: Error do: [:error |
        response at: 'error' put: ((error respondsTo: #runtimeDetails) ifTrue: [error runtimeDetails] ifFalse: [Dictionary new
            at: 'code' put: ((#('STALE_REVISION' 'STALE_HANDLE' 'PRECONDITION_FAILED') includes: error messageText)
                ifTrue: [error messageText] ifFalse: ['RECOVERED_FAILURE']);
            at: 'message' put: error description;
            yourself])].
    response at: 'revision' put: revision.
    self send: response!
beginRequest: identity
    <primitive: 'primitiveBeginRequest' module: 'SEBookPlugin'>
    ^ self!
performOperation: operation payload: payload
    (SEBookStructuralGuard enabled not and: [
        (#('refactoringCatalog' 'prepareRefactoring' 'cancelRefactoring') includes: operation) or: [
        operation = 'prepareMutation' and: [#('applyRefactoring' 'undoRefactoring' 'redoRefactoring') includes: (payload at: 'action')]]])
        ifTrue: [self refactoringUnavailable].
    (transactions isPending and: [(#('checkpoint' 'commitMutation' 'mutationStatus' 'abortMutation') includes: operation) not])
        ifTrue: [self error: 'PRECONDITION_FAILED'].
    operation = 'prepareMutation' ifTrue: [^ transactions prepare: payload revision: revision].
    operation = 'commitMutation' ifTrue: [^ transactions commit: payload].
    operation = 'abortMutation' ifTrue: [^ transactions abort: payload].
    operation = 'mutationStatus' ifTrue: [^ transactions status: payload].
    operation = 'exportSourceState' ifTrue: [^ changes portableState: baselineId].
    operation = 'exportChanges' ifTrue: [^ changes bundle].
    operation = 'replayChanges' ifTrue: [self replayChanges: (payload at: 'changes'). ^ nil].
    operation = 'info' ifTrue: [^ self info].
    operation = 'evaluate' ifTrue: [^ self evaluate: payload].
    operation = 'loadProgram' ifTrue: [^ self loadProgram: payload].
    operation = 'inspect' ifTrue: [^ inspector inspect: payload].
    operation = 'releaseHandles' ifTrue: [^ inspector release: payload].
    operation = 'refactoringCatalog' ifTrue: [^ refactorings catalog: (payload at: 'target')].
    operation = 'prepareRefactoring' ifTrue: [^ refactorings prepare: payload revision: revision].
    operation = 'cancelRefactoring' ifTrue: [^ refactorings cancel: (payload at: 'token')].
    operation = 'refactoringHistory' ifTrue: [^ refactorings history].
    operation = 'browse' ifTrue: [^ browser browse: payload revision: revision].
    operation = 'checkpoint' ifTrue: [^ Dictionary new at: 'nonce' put: (payload at: 'nonce'); yourself].
    operation = 'barrier' ifTrue: [^ Dictionary new at: 'idle' put: true; yourself].
    self error: 'Unsupported operation: ', operation!
refactoringUnavailable
    SEBookRuntimeError signalDetails: (Dictionary new
        at: 'code' put: 'REFRACTORING_UNAVAILABLE';
        at: 'message' put: 'Refactoring is disabled in this distribution and reserved for a later release.'; yourself)!
send: anObject
    | text |
    text := String streamContents: [:stream | SEBookJSON jsonObj: anObject on: stream].
    self reply: text utf8Encoded! !

!SEBookService methodsFor: 'system information'!
info
    | rbVersion hasCompiler hasSources |
    rbVersion := ((ConfigurationOfRefactoringBrowser >> #version31:) pragmaAt: #version:imports:) argumentAt: 1.
    hasCompiler := (Smalltalk includesKey: #Compiler) and: [(Compiler evaluate: '6 * 7') = 42].
    hasSources := (SourceFiles at: 1) notNil and: [
        ((Object sourceCodeAt: #yourself) asString includesSubstring: 'Answer self.') and: [
        (RBParser parseExpression: '6 * 7') notNil]].
    ^ Dictionary new
        at: 'features' put: (Dictionary new at: 'refactorings' put: SEBookStructuralGuard enabled; yourself);
        at: 'imageBuild' put: (Smalltalk lastUpdateString findTokens: '#') last asInteger;
        at: 'refactoringBrowser' put: rbVersion;
        at: 'hasCompiler' put: hasCompiler;
        at: 'hasSystemSources' put: hasSources;
        at: 'hasSpellingDictionary' put: (FileDirectory default fileExists: 'rb-spelling.dat');
        at: 'objectMethodSource' put: (Object sourceCodeAt: #yourself) asString;
        at: 'packageVersions' put: ((MCWorkingCopy allManagers select: [:copy | (copy package name beginsWith: 'AST-') or: [copy package name beginsWith: 'Refactoring-']]) collect: [:copy | copy ancestry ancestors first name]) asArray;
        yourself! !

!SEBookService methodsFor: 'execution'!
evaluate: payload
    | evaluator result |
    evaluator := (payload at: 'bindings') = 'workspace' ifTrue: [workspace] ifFalse: [SEBookWorkspace new].
    result := Dictionary new at: 'value' put: nil; at: 'error' put: nil; at: 'codeChanges' put: nil; yourself.
    [result at: 'value' put: (inspector summary: (evaluator evaluate: (payload at: 'source')))]
        on: Error do: [:error |
            result at: 'error' put: (evaluator diagnostic ifNil: [Dictionary new
                at: 'code' put: 'EVALUATION_ERROR'; at: 'message' put: error description; yourself])].
    (self reconcileChanges) ifTrue: [result at: 'codeChanges' put: changes bundle].
    result at: 'history' put: refactorings history.
    ^ result!
loadProgram: payload
    | program |
    changes ifNotNil: [changes dispose]. changes := nil.
    (payload at: 'captureChanges' ifAbsent: [true]) ifTrue: [changes := SEBookChanges new].
    program := payload at: 'program'.
    browser sourceReader: changes.
    self installFiles: (String streamContents: [:stream | SEBookJSON jsonObj: program on: stream]) utf8Encoded.
    (program at: 'files') do: [:file |
        (file at: 'kind') = 'source' ifTrue: [
            (file at: 'format') = 'doit'
                ifTrue: [self evaluateFile: file]
                ifFalse: [self fileIn: (file at: 'path')]]].
    changes ifNotNil: [changes establishBaseline].
    ((program at: 'changes') at: 'source') isEmpty ifFalse: [self fileIn: '/.sebook-changes.st'. changes ifNotNil: [changes reconcile]].
    revision := program at: 'revision'.
    refactorings sourceReader: changes generation: generation.
    ^ nil!
evaluateFile: file
    | diagnostic |
    [workspace evaluate: (file at: 'content')] on: Error do: [:error |
        workspace diagnostic ifNil: [error pass].
        diagnostic := workspace diagnostic copy.
        diagnostic at: 'location' put: ((diagnostic at: 'location') copy
            at: 'path' put: (file at: 'path'); yourself).
        SEBookRuntimeError signalDetails: diagnostic]!
installFiles: bytes
    <primitive: 'primitiveInstallFiles' module: 'SEBookPlugin'>
    self error: 'PRECONDITION_FAILED'!
fileIn: path
    | text sourceStream |
    text := FileStream readOnlyFileNamed: path do: [:stream | stream contents].
    sourceStream := SEBookSourceStream on: text.
    sourceStream path: path.
    [sourceStream fileIn] on: SyntaxErrorNotification do: [:error |
        SEBookRuntimeError signalDetails: (sourceStream syntaxDetails: error)]! !

!SEBookService methodsFor: 'checkpoint continuation'!
captureCheckpoint
    <primitive: 'primitiveCaptureCheckpoint' module: 'SEBookPlugin'>
    self error: 'PRECONDITION_FAILED'!
checkpoint: request
    (request at: 'expectedRevision') = revision ifFalse: [^ self answer: request].
    self captureCheckpoint ifTrue: [
        requests removeAll. activeOperation := nil.
        generation := (SEBookJSON jsonFromString: self configuration) at: 'sessionId'.
        inspector configure: limits generation: generation.
        refactorings generation: generation.
        self send: (Dictionary new at: 'ready' put: true;
            at: 'revision' put: revision; at: 'checkpointNonce' put: (SEBookCheckpointRoots at: 2); yourself)
    ] ifFalse: [self answer: request]! !

!SEBookService methodsFor: 'source mutations'!
reconcileBackground
    self reconcileChanges ifTrue: [self send: (Dictionary new at: 'sessionId' put: generation;
        at: 'requestId' put: nil; at: 'revision' put: revision; at: 'type' put: 'codeChanged';
        at: 'payload' put: (Dictionary new at: 'changes' put: changes bundle; at: 'history' put: refactorings history; yourself); yourself)]!
reconcileChanges
    changes ifNil: [^ false].
    changes reconcile ifFalse: [^ false].
    refactorings ordinarySourceAccepted.
    revision := revision + 1.
    ^ true!
classFor: target
    | class |
    class := Smalltalk at: (target at: 'className') asSymbol ifAbsent: [self error: 'PRECONDITION_FAILED'].
    ^ (target at: 'side' ifAbsent: ['instance']) = 'class' ifTrue: [class class] ifFalse: [class]!
applyMutation: payload
    | action params target |
    action := payload at: 'action'. params := payload at: 'params'.
    target := params at: 'target' ifAbsent: [nil].
    action = 'restoreVersion' ifTrue: [action := 'accept', (target at: 'kind') capitalized].
    action = 'createPackage' ifTrue: [SystemOrganization addCategory: (params at: 'name')].
    action = 'acceptMethod' ifTrue: [workspace acceptMethod: (params at: 'source')
        in: (self classFor: target) protocol: (params at: 'protocol' ifAbsent: ['as yet unclassified'])].
    action = 'acceptClass' ifTrue: [[SEBookStructuralGuard acceptDefinition: (params at: 'source') notifying: workspace] on: Error do: [:error |
        workspace diagnostic ifNotNil: [SEBookRuntimeError signalDetails: workspace diagnostic]. error pass]].
    action = 'acceptComment' ifTrue: [(self classFor: target) theNonMetaClass comment: (params at: 'source')].
    action = 'acceptFile' ifTrue: [self acceptFile: (params at: 'file'). ^ nil].
    (SEBookStructuralGuard enabled not and: [#('applyRefactoring' 'undoRefactoring' 'redoRefactoring') includes: action])
        ifTrue: [self refactoringUnavailable].
    action = 'applyRefactoring' ifTrue: [refactorings apply: (params at: 'token') revision: revision].
    action = 'undoRefactoring' ifTrue: [refactorings undo].
    action = 'redoRefactoring' ifTrue: [refactorings redo].
    action = 'replaceProgram' ifTrue: [self error: 'PRECONDITION_FAILED'].
    changes reconcile.
    (#('applyRefactoring' 'undoRefactoring' 'redoRefactoring') includes: action)
        ifFalse: [refactorings ordinarySourceAccepted].
    revision := revision + 1.
    ^ Dictionary new at: 'revision' put: revision; at: 'changes' put: changes bundle; at: 'history' put: refactorings history; yourself!
acceptFile: file
    self installFiles: (String streamContents: [:stream | SEBookJSON jsonObj:
        (Dictionary new at: 'files' put: (Array with: file); at: 'changes' put: (Dictionary new at: 'source' put: ''; yourself); yourself) on: stream]) utf8Encoded.
    (file at: 'kind') = 'source' ifTrue: [
        (file at: 'format') = 'doit' ifTrue: [self evaluateFile: file] ifFalse: [self fileIn: (file at: 'path')]]!
replayChanges: bundle
    self acceptFile: (Dictionary new at: 'path' put: '/.sebook-replay.st'; at: 'kind' put: 'source';
        at: 'format' put: 'filein'; at: 'content' put: (bundle at: 'source'); yourself).
    changes reconcile! !

!SEBookService methodsFor: 'raw file rebase'!
finalizeFileMutation: payload baseline: portable
    changes ensureNoConflictsWith: portable identity: baselineId.
    changes rebaseTo: portable identity: baselineId.
    refactorings ordinarySourceAccepted.
    revision := revision + 1.
    ^ Dictionary new at: 'revision' put: revision; at: 'changes' put: changes bundle; at: 'history' put: refactorings history; yourself! !

!SEBookService methodsFor: 'structural exclusion identity'!
structuralMutationIdentity
    ^ transactions structuralMutationIdentity! !
