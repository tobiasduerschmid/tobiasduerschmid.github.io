Object subclass: #SEBookStructuralGuard
    instanceVariableNames: ''
    classVariableNames: 'Queue OriginalTrigger Enumeration Slot ClassOf Copy Generated'
    poolDictionaries: '' category: 'SEBook-Runtime'!

!SEBookStructuralGuard class methodsFor: 'image preparation'!
enabled
    <primitive: 'primitiveStructuralEnabled' module: 'SEBookPlugin'>
    ^ false!
install
    self initialize.
    SystemChangeNotifier compile: 'trigger: event
    ^ SEBookStructuralGuard trigger: event for: self' classified: 'triggering'.
    RBRefactoryDefinitionChange compile: 'primitiveExecute
    definedClass := SEBookStructuralGuard active
        ifTrue: [SEBookStructuralGuard evaluateDefinition: self definition notifying: self controller]
        ifFalse: [self definitionClass compilerClass evaluate: self definition notifying: self controller logged: true]' classified: 'private'!
initialize
    OriginalTrigger := SystemChangeNotifier compiledMethodAt: #trigger:.
    Enumeration := Behavior compiledMethodAt: #allInstancesOrNil.
    Slot := Object compiledMethodAt: #instVarAt:.
    ClassOf := Object compiledMethodAt: #class.
    Copy := Object compiledMethodAt: #shallowCopy!
captureTrustedCode
    | methods literals |
    (Smalltalk includesKey: #SEBookStructuralTrustedCode) ifTrue: [self error: 'STRUCTURAL_ALREADY_SEALED'].
    literals := IdentityDictionary new.
    methods := OrderedCollection new.
    CompiledCode withAllSubclasses do: [:class | methods addAll: class allInstances].
    Smalltalk at: #SEBookStructuralTrustedCode put:
        (methods collect: [:method | {method. Copy valueWithReceiver: method arguments: #(). self literalRecordsFor: method cached: literals}]) asArray.
    self seal!
seal
    <primitive: 'primitiveStructuralSeal' module: 'SEBookPlugin'>
    self error: 'STRUCTURAL_SEAL_UNAVAILABLE'!
literalRecordsFor: method cached: cache
    | visited records visit |
    visited := IdentitySet new. records := OrderedCollection new.
    visit := [:literal |
        ((literal class ~~ SmallInteger and: [literal class ~~ Character]) and:
            [(literal class == Array or: [literal isString or: [literal class isBits]]) and: [(visited includes: literal) not]]) ifTrue: [
            visited add: literal. records add: (cache at: literal ifAbsentPut: [{literal. Copy valueWithReceiver: literal arguments: #()}]).
            literal class == Array ifTrue: [literal do: visit]]].
    method literals do: visit.
    ^ records asArray! !

!SEBookStructuralGuard class methodsFor: 'VM exclusion'!
begin: identity
    <primitive: 'primitiveStructuralBegin' module: 'SEBookPlugin'>
    self error: 'STRUCTURAL_BEGIN_UNAVAILABLE'!
end
    <primitive: 'primitiveStructuralEnd' module: 'SEBookPlugin'>
    self error: 'STRUCTURAL_END_UNAVAILABLE'!
abort
    <primitive: 'primitiveStructuralAbort' module: 'SEBookPlugin'>
    self error: 'STRUCTURAL_ABORT_UNAVAILABLE'!
abort: reason
    <primitive: 'primitiveStructuralAbortReason' module: 'SEBookPlugin'>
    self error: 'STRUCTURAL_ABORT_UNAVAILABLE'!
active
    <primitive: 'primitiveStructuralActive' module: 'SEBookPlugin'>
    ^ false!
admitDefinition: record
    <primitive: 'primitiveStructuralAdmitDefinition' module: 'SEBookPlugin'>
    self error: 'STRUCTURAL_DEFINITION_UNAVAILABLE'!
during: action layoutClasses: classes
    | answer succeeded events |
    self enabled ifFalse: [^ action value].
    self begin: (SEBookCheckpointRoots at: 4) structuralMutationIdentity.
    Queue := OrderedCollection new. Generated := OrderedCollection new. succeeded := false.
    [[self validateActivationsFor: classes. answer := action value. succeeded := true]
        on: Error do: [:error | self abort: error messageText]]
        ensure: [succeeded ifFalse: [self abort]. self end.
            events := Queue. Queue := nil. Generated := nil.
            events do: [:event | OriginalTrigger valueWithReceiver: SystemChangeNotifier uniqueInstance arguments: {event}]].
    ^ answer! !

!SEBookStructuralGuard class methodsFor: 'notification exclusion'!
trigger: event for: notifier
    Queue ifNotNil: [
        Queue size >= 8192 ifTrue: [self error: 'STRUCTURAL_NOTIFICATION_LIMIT'].
        Queue add: event. ^ self].
    ^ OriginalTrigger valueWithReceiver: notifier arguments: {event}! !

!SEBookStructuralGuard class methodsFor: 'applicability'!
validateActivationsFor: classes
    | affected representations count |
    classes isEmpty ifTrue: [^ self].
    affected := IdentitySet new.
    classes do: [:class | affected addAll: class withAllSubclasses].
    affected size > 256 ifTrue: [self error: 'STRUCTURAL_HIERARCHY_LIMIT'].
    affected do: [:class | (class isVariable or: [class isBits]) ifTrue: [self error: 'STRUCTURAL_CUSTOM_LAYOUT']].
    representations := IdentitySet new.
    {Context. BlockClosure} do: [:class | representations addAll: class withAllSubclasses].
    representations size > 256 ifTrue: [self error: 'STRUCTURAL_HIERARCHY_LIMIT'].
    count := 0.
    representations do: [:class | | instances |
        self validateRepresentation: class.
        instances := Enumeration valueWithReceiver: class arguments: #().
        instances ifNil: [self error: 'STRUCTURAL_ENUMERATION_FAILED'].
        instances do: [:activation | | receiver receiverClass |
            count := count + 1. count > 50000 ifTrue: [self error: 'STRUCTURAL_SCAN_LIMIT'].
            receiver := self activationReceiver: activation class: class.
            receiverClass := ClassOf valueWithReceiver: receiver arguments: #().
            (affected includes: receiverClass) ifTrue: [self error: 'STRUCTURAL_RETAINED_ACTIVATION']]]!
validateRepresentation: class
    | expected actual |
    expected := (class includesBehavior: Context)
        ifTrue: [#('sender' 'pc' 'stackp' 'method' 'closureOrNil' 'receiver')]
        ifFalse: [(class includesBehavior: FullBlockClosure)
            ifTrue: [#('outerContext' 'startpcOrMethod' 'numArgs' 'receiver')]
            ifFalse: [#('outerContext' 'startpcOrMethod' 'numArgs')]].
    actual := class allInstVarNames.
    (actual size >= expected size and: [(actual first: expected size) = expected])
        ifFalse: [self error: 'STRUCTURAL_UNKNOWN_REPRESENTATION']!
activationReceiver: activation class: class
    | outer outerClass |
    (class includesBehavior: Context) ifTrue: [^ Slot valueWithReceiver: activation arguments: #(6)].
    (class includesBehavior: FullBlockClosure) ifTrue: [^ Slot valueWithReceiver: activation arguments: #(4)].
    outer := Slot valueWithReceiver: activation arguments: #(1).
    outer ifNil: [^ nil].
    outerClass := ClassOf valueWithReceiver: outer arguments: #().
    (outerClass includesBehavior: Context) ifFalse: [self error: 'STRUCTURAL_UNKNOWN_REPRESENTATION'].
    self validateRepresentation: outerClass.
    ^ Slot valueWithReceiver: outer arguments: #(6)! !

!SEBookStructuralGuard class methodsFor: 'class definitions'!
validateDefinition: source
    | expression receiver metaclassReceiver |
    expression := RBParser parseExpression: source.
    expression isMessage ifFalse: [self error: 'STRUCTURAL_UNSUPPORTED_DEFINITION'].
    receiver := expression receiver.
    metaclassReceiver := receiver isMessage and: [receiver selector = #class and: [receiver arguments isEmpty]].
    metaclassReceiver ifTrue: [receiver := receiver receiver].
    (receiver isVariable and: [Smalltalk includesKey: receiver name asSymbol])
        ifFalse: [self error: 'STRUCTURAL_UNSUPPORTED_DEFINITION'].
    (#(#subclass:instanceVariableNames:classVariableNames:poolDictionaries:category:
       #instanceVariableNames:) includes: expression selector)
        ifFalse: [self error: 'STRUCTURAL_UNSUPPORTED_DEFINITION'].
    ((Smalltalk at: receiver name asSymbol) isBehavior and:
        [metaclassReceiver = (expression selector = #instanceVariableNames:)])
        ifFalse: [self error: 'STRUCTURAL_UNSUPPORTED_DEFINITION'].
    (expression arguments allSatisfy: [:argument | argument isLiteralNode and: [argument value isString]])
        ifFalse: [self error: 'STRUCTURAL_UNSUPPORTED_DEFINITION'].
    ^ expression!
evaluateDefinition: source notifying: requestor
    | method record |
    self validateDefinition: source.
    method := (Compiler new compileNoPattern: source in: UndefinedObject context: nil notifying: requestor
        ifFail: [self error: 'COMPILE_ERROR']) generate.
    record := {method. Copy valueWithReceiver: method arguments: #(). self literalRecordsFor: method cached: IdentityDictionary new}.
    Generated add: record. self admitDefinition: record.
    ^ method valueWithReceiver: nil arguments: #()!
acceptDefinition: source notifying: requestor
    | expression class classes superclass names |
    expression := self validateDefinition: source.
    self enabled ifFalse: [^ requestor evaluate: source].
    class := expression selector = #instanceVariableNames:
        ifTrue: [Smalltalk at: expression receiver receiver name asSymbol]
        ifFalse: [Smalltalk at: expression arguments first value asSymbol ifAbsent: [nil]].
    classes := OrderedCollection new.
    class ifNotNil: [expression selector = #instanceVariableNames:
        ifTrue: [names := expression arguments first value findTokens: ' '.
            names asArray = class class instVarNames ifFalse: [classes add: class class]]
        ifFalse: [superclass := Smalltalk at: expression receiver name asSymbol.
            names := expression arguments second value findTokens: ' '.
            (names asArray = class instVarNames and: [superclass == class superclass])
                ifFalse: [classes add: class].
            superclass == class superclass ifFalse: [classes add: class class]]].
    ^ self during: [self evaluateDefinition: source notifying: requestor] layoutClasses: classes! !
