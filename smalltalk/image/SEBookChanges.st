ChangeSet subclass: #SEBookCodeChangeSet
    instanceVariableNames: 'sourceClasses sourceReader stagingDefinitions' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookCodeChangeSet methodsFor: 'native export compatibility'!
fileOutOn: stream
    "Stage inherited storage, install methods, remove obsolete methods, then finalize roots first."
    | list classes traits |
    traits := self changedClasses select: [:each | each isTrait].
    classes := self changedClasses select: [:each | each isBehavior].
    list := OrderedCollection new
        addAll: (self class traitsOrder: traits asOrderedCollection);
        addAll: (self class superclassOrder: classes asOrderedCollection); yourself.
    self fileOutRemovedClassVariablesOn: stream.
    self fileOutClassVariableRelocations: classes on: stream.
    list do: [:class | self fileOutClassDefinition: class on: stream].
    list do: [:class | self fileOutChangesFor: class on: stream].
    list reverseDo: [:class | self fileOutPSFor: class on: stream].
    list do: [:class | | record |
        record := changeRecords at: class name ifAbsent: [nil].
        (record notNil and: [((record includesChangeType: #change) or: [record includesChangeType: #add])
            and: [class definition ~= (self stagingDefinitionFor: class)]]) ifTrue: [
                stream nextChunkPut: class definition; cr]].
    self classRemoves sort do: [:name | stream nextChunkPut: 'Smalltalk removeClassNamed: #', name; cr]!
fileOutRemovedClassVariablesOn: stream
    "Removed classes still exist at replay start. Release their pools before an ancestor gains a variable."
    self classRemoves do: [:name | | record definition |
        record := changeRecords at: name ifAbsent: [nil].
        (record notNil and: [record priorDefinition notNil]) ifTrue: [
            definition := RBRefactoryDefinitionChange definition: record priorDefinition.
            (definition isKindOf: RBAddClassChange) ifTrue: [
                definition classVariableNames do: [:variable |
                    stream nextChunkPut: name, ' removeClassVarName: ', variable asString storeString; cr]]]]!
fileOutClassVariableRelocations: classes on: stream
    "Native class variables cannot be duplicated in a subclass while being pulled upward."
    classes do: [:class | | record oldNames sourceName |
        class isMeta ifFalse: [
            record := changeRecords at: class name ifAbsent: [nil].
            (record notNil and: [record priorDefinition notNil]) ifTrue: [
                oldNames := (RBAddClassChange definition: record priorDefinition) classVariableNames.
                sourceName := (record includesChangeType: #rename) ifTrue: [self oldNameFor: class] ifFalse: [class name].
                oldNames do: [:name |
                    ((class classVarNames includes: name asSymbol) not and: [
                        class allSuperclasses anySatisfy: [:parent | parent classVarNames includes: name asSymbol]]) ifTrue: [
                            stream nextChunkPut: sourceName, ' removeClassVarName: ', name asString storeString; cr]]]]]!
stagingDefinitionFor: class
    ^ stagingDefinitions at: class ifAbsentPut: [ | definition tree |
        definition := super fatDefForClass: class.
        (class isBehavior and: [class superclass notNil]) ifTrue: [
            tree := RBParser parseExpression: definition.
            self excludeInherited: (self stagedVariablesAbove: class keyword: 'instanceVariableNames:')
                keyword: 'instanceVariableNames:' from: tree.
            class isMeta ifFalse: [self excludeInherited: (self stagedVariablesAbove: class keyword: 'classVariableNames:')
                keyword: 'classVariableNames:' from: tree].
            definition := tree formattedCode].
        definition]!
stagedVariablesAbove: class keyword: keyword
    | names parent |
    names := Set new. parent := class superclass.
    [parent notNil] whileTrue: [ | tree |
        tree := RBParser parseExpression: (self stagingDefinitionFor: parent).
        tree nodesDo: [:node | | index |
            node isMessage ifTrue: [
                index := node selector keywords indexOf: keyword.
                index > 0 ifTrue: [names addAll: (((node arguments at: index) value) findTokens: Character separators)]]].
        parent := parent superclass].
    ^ names!
excludeInherited: inherited keyword: keyword from: tree
    tree nodesDo: [:node | | index names arguments |
        node isMessage ifTrue: [
            index := node selector keywords indexOf: keyword.
            index > 0 ifTrue: [
                names := ((node arguments at: index) value findTokens: Character separators) reject: [:name | inherited includes: name].
                arguments := node arguments copy.
                arguments at: index put: (RBLiteralValueNode value: (String streamContents: [:stream |
                    names do: [:name | stream nextPutAll: name; space]])).
                node arguments: arguments]]]!
sourceState: state reader: reader
    sourceClasses := state at: #classes. sourceReader := reader. stagingDefinitions := IdentityDictionary new!
fileOutClassDefinition: class on: stream
    "Native rename and staged definitions; comment text belongs to this source cut."
    (self atClass: class includes: #rename) ifTrue: [
        stream nextChunkPut: 'Smalltalk renameClassNamed: #', (self oldNameFor: class), ' as: #', class name; cr].
    (self atClass: class includes: #change) ifTrue: [
        stream command: 'H3'; nextChunkPut: (self stagingDefinitionFor: class); cr; command: '/H3'.
        DeepCopier new checkClass: class
    ] ifFalse: [(self atClass: class includes: #add) ifTrue: [
        stream command: 'H3'; nextChunkPut: (self stagingDefinitionFor: class); cr; command: '/H3'.
        DeepCopier new checkClass: class]].
    (self atClass: class includes: #comment) ifTrue: [
        stream nextChunkPut: class theNonMetaClass name, ' comment: ',
            (sourceReader commentText: (sourceClasses at: class theNonMetaClass name asString)) storeString; cr]!
fileOutChangesFor: class on: stream
    "Use native chunk encoding and organization, without rereading corruptible SourceFiles."
    | changes state |
    changes := self methodChangesAtClass: class name.
    state := sourceClasses at: class name asString.
    class organization categories do: [:protocol |
        (class organization listAtCategoryNamed: protocol) do: [:selector |
            (changes includesKey: selector) ifTrue: [
                (#(remove addedThenRemoved) includes: (changes at: selector)) ifFalse: [
                    stream cr; nextPut: $!!;
                        nextChunkPut: class name, ' methodsFor: ', protocol asString storeString; cr;
                        nextChunkPut: (sourceReader methodSource: selector state: state);
                        nextChunkPut: ' '; cr]]]]!

fileOutPSFor: class on: stream
    "Native method removals and organization; final definitions are emitted as a separate phase."
    | dict classRecord |
    classRecord := changeRecords at: class name ifAbsent: [^ self].
    dict := classRecord methodChangeTypes.
    dict keysSortedSafely do: [:key |
        (#(remove addedThenRemoved) includes: (dict at: key)) ifTrue: [
            stream nextChunkPut: class name, ' removeSelector: ', key storeString; cr]].
    (classRecord includesChangeType: #reorganize) ifTrue: [
        class fileOutOrganizationOn: stream. stream cr]! !

Object subclass: #SEBookChanges
    instanceVariableNames: 'cold baseline previous dirty lastBundle watchRoots pendingSources pendingComments coldMethods renames'
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookChanges methodsFor: 'lifecycle'!
initialize
    super initialize.
    pendingSources := IdentityDictionary new. pendingComments := IdentityDictionary new. renames := Dictionary new.
    cold := self capture. baseline := cold. previous := cold. dirty := false.
    coldMethods := IdentitySet new.
    (cold at: #classes) valuesDo: [:state | (state at: #methods) valuesDo: [:method | coldMethods add: method]].
    lastBundle := Dictionary new at: 'version' put: 1; at: 'source' put: ''; at: 'entries' put: #(); yourself.
    SystemChangeNotifier uniqueInstance notify: self ofAllSystemChangesUsing: #event:!
establishBaseline
    renames removeAll.
    baseline := self capture. previous := baseline. dirty := false.
    lastBundle := Dictionary new at: 'version' put: 1; at: 'source' put: ''; at: 'entries' put: #(); yourself.
    self resetWatch!
dispose
    SystemChangeNotifier uniqueInstance noMoreNotificationsFor: self!
event: event
    dirty := true.
    (event itemKind = #class and: [event isRenamed]) ifTrue: [ | oldName newName origin |
        oldName := event oldName asString copy. newName := event newName asString copy.
        origin := renames keys detect: [:name | (renames at: name) = oldName] ifNone: [oldName].
        renames removeKey: origin ifAbsent: [].
        origin ~= newName ifTrue: [renames at: origin put: newName]].
    (event itemKind = #method and: [event isAdded or: [event isModified]]) ifTrue: [
        pendingSources at: event item put: (event item getSourceFor: event itemSelector in: event itemClass) asString copy].
    (event itemKind = #class and: [event isCommented]) ifTrue: [
        pendingComments at: event item put: event item organization classComment asString copy]!

isDirty
    ^ dirty!
bundle
    ^ lastBundle! !

!SEBookChanges methodsFor: 'native state'!
capture
    "One native source cut: background compilation cannot interleave its fields."
    ^ [self captureUnpreemptively] valueUnpreemptively!
captureUnpreemptively
    | state classes |
    state := Dictionary new. classes := Dictionary new.
    Smalltalk allClasses do: [:class |
        classes at: class name asString put: (self stateOf: class).
        classes at: class class name asString put: (self stateOf: class class)].
    state at: #classes put: classes; at: #packages put: SystemOrganization categories asArray copy.
    ^ state!
stateOf: class
    | protocols shape old definition organization remote comment sources |
    old := previous ifNotNil: [(previous at: #classes) at: class name asString ifAbsent: [nil]].
    (old notNil and: [self unchanged: class from: old]) ifTrue: [^ old].
    protocols := Dictionary new.
    class organization categories do: [:name | protocols at: name asString copy put: (class organization listAtCategoryNamed: name) copy].
    shape := Array with: class superclass with: class instVarNames copy with: class format
        with: (class isMeta ifTrue: [#()] ifFalse: [class classPool keys asArray sort])
        with: (class isMeta ifTrue: [#()] ifFalse: [class sharedPools copy])
        with: class category copy.
    shape := shape copyWith: class name asString copy.
    shape := shape copyWith: (class superclass ifNotNil: [:parent | parent name asString copy]).
    shape := shape copyWith: class traitComposition asString copy.
    old := previous ifNotNil: [(previous at: #classes) at: class name asString ifAbsent: [nil]].
    definition := (old notNil and: [(old at: #shape ifAbsent: [nil]) = shape])
        ifTrue: [old at: #definition] ifFalse: [class definition copy].
    organization := (old notNil and: [(old at: #protocols) = protocols])
        ifTrue: [old at: #organization] ifFalse: [String streamContents: [:stream | class fileOutOrganizationOn: stream]].
    remote := class isMeta ifTrue: [nil] ifFalse: [class organization commentRemoteStr].
    comment := (old notNil and: [(old at: #commentPointer) = (remote ifNotNil: [:value | value sourcePointer])])
        ifTrue: [old at: #comment]
        ifFalse: [cold ifNil: [remote ifNotNil: [:value | value copy]] ifNotNil: [remote ifNotNil: [:value | pendingComments at: class ifAbsent: [value text asString copy]]]].
    sources := Dictionary new.
    cold ifNotNil: [class methodDict keysAndValuesDo: [:selector :method |
        (coldMethods includes: method) ifFalse: [
            sources at: selector put: ((old notNil and: [((old at: #methods) at: selector ifAbsent: [nil]) == method])
                ifTrue: [self methodSource: selector state: old]
                ifFalse: [pendingSources at: method ifAbsent: [(method getSourceFor: selector in: class) asString copy]])]]].
    ^ Dictionary new at: #class put: class; at: #entity put: (Dictionary new
            at: 'className' put: class theNonMetaClass name asString copy;
            at: 'side' put: (class isMeta ifTrue: ['class'] ifFalse: ['instance']); yourself);
        at: #shape put: shape; at: #definition put: definition;
        at: #comment put: comment; at: #commentPointer put: (remote ifNotNil: [:value | value sourcePointer]);
        at: #methodSources put: sources;
        at: #organization put: organization; at: #protocols put: protocols; at: #methods put: class methodDict copy; yourself!
unchanged: class from: state
    | shape protocols categories |
    shape := state at: #shape ifAbsent: [^ false].
    class superclass == shape first ifFalse: [^ false].
    class instVarNames = (shape at: 2) ifFalse: [^ false].
    class format = (shape at: 3) ifFalse: [^ false].
    class isMeta ifFalse: [
        class classPool size = (shape at: 4) size ifFalse: [^ false].
        (shape at: 4) do: [:name | (class classPool includesKey: name) ifFalse: [^ false]].
        class sharedPools = (shape at: 5) ifFalse: [^ false]].
    class category = (shape at: 6) ifFalse: [^ false].
    class name asString = (shape at: 7) ifFalse: [^ false].
    (class superclass ifNotNil: [:parent | parent name asString]) = (shape at: 8) ifFalse: [^ false].
    class traitComposition asString = (shape at: 9) ifFalse: [^ false].
    (class isMeta ifTrue: [nil] ifFalse: [class organization commentRemoteStr ifNotNil: [:remote | remote sourcePointer]]) = (state at: #commentPointer) ifFalse: [^ false].
    (self sameMethods: class methodDict as: (state at: #methods)) ifFalse: [^ false].
    protocols := state at: #protocols. categories := class organization categories.
    categories size = protocols size ifFalse: [^ false].
    categories do: [:name |
        (class organization listAtCategoryNamed: name) = (protocols at: name asString ifAbsent: [^ false]) ifFalse: [^ false]].
    ^ true!
commentText: state
    ^ (state at: #comment) ifNil: [''] ifNotNil: [:remote |
        remote isString ifTrue: [remote] ifFalse: [self commentFrom: remote]]!
commentFrom: remote
    ^ (self coldSource: remote sourcePointer) ifNil: [remote text asString copy]!
methodSource: selector state: state
    | method |
    method := (state at: #methods) at: selector.
    method isString ifTrue: [^ method].
    (state at: #methodSources ifAbsent: [Dictionary new]) at: selector ifPresent: [:source | ^ source].
    ^ (self coldSource: method sourcePointer) ifNil: [(method getSourceFor: selector in: (state at: #class)) asString copy]!
entity: kind state: state
    ^ (state at: #entity) copy at: 'kind' put: kind; yourself!
entry: entity before: before after: after into: entries
    before = after ifFalse: [entries add: (Dictionary new at: 'entity' put: entity;
        at: 'before' put: before; at: 'after' put: after; yourself)]!
state: old differsFrom: new
    old == new ifTrue: [^ false].
    (old isNil or: [new isNil]) ifTrue: [^ true].
    #(#definition #organization #comment) do: [:field | (old at: field) ~= (new at: field) ifTrue: [^ true]].
    ^ (self sameMethods: (old at: #methods) as: (new at: #methods)) not!
sameMethods: left as: right
    "CompiledMethod equality ignores source-only edits; compare installed identities."
    left size = right size ifFalse: [^ false].
    left keysAndValuesDo: [:selector :method |
        method == (right at: selector ifAbsent: [^ false]) ifFalse: [^ false]].
    ^ true! !

!SEBookChanges methodsFor: 'reconciliation'!
reconcile
    | current changed |
    (dirty not and: [self sourceWatchChanged not]) ifTrue: [^ false].
    current := self capture.
    changed := (previous at: #packages) ~= (current at: #packages).
    changed ifFalse: [
        ((previous at: #classes) keys asSet union: (current at: #classes) keys asSet) do: [:name |
            (((previous at: #classes) at: name ifAbsent: [nil]) ~~ ((current at: #classes) at: name ifAbsent: [nil])) ifTrue: [changed := true]]].
    changed ifTrue: [lastBundle := [self bundleFrom: baseline to: current] valueUnpreemptively].
    previous := current. dirty := false. pendingSources removeAll. pendingComments removeAll. self resetWatch.
    ^ changed!
bundleFrom: base to: current
    | entries set source packages basePackages clearedComments |
    entries := OrderedCollection new. clearedComments := OrderedCollection new.
    set := SEBookCodeChangeSet basicNewNamed: 'SEBook accepted code'.
    set sourceState: current reader: self.
    packages := current at: #packages. basePackages := base at: #packages.
    (basePackages asSet union: packages asSet) do: [:name |
        self entry: (Dictionary new at: 'kind' put: 'package'; at: 'packageName' put: name; yourself)
            before: ((basePackages includes: name) ifTrue: [name] ifFalse: [nil])
            after: ((packages includes: name) ifTrue: [name] ifFalse: [nil]) into: entries].
    self classesFrom: base to: current set: set entries: entries clearedComments: clearedComments.
    source := String streamContents: [:stream |
        (packages difference: basePackages) do: [:name | stream nextChunkPut: 'SystemOrganization addCategory: ', name storeString; cr].
        set fileOutOn: stream.
        clearedComments do: [:name | stream nextChunkPut: name, ' comment: ', '' storeString; cr].
        (basePackages difference: packages) do: [:name | stream nextChunkPut: 'SystemOrganization removeCategory: ', name storeString; cr]].
    ^ Dictionary new at: 'version' put: 1; at: 'source' put: source; at: 'entries' put: entries asArray; yourself!
classesFrom: base to: current set: set entries: entries clearedComments: clearedComments
    | oldClasses classes handled |
    oldClasses := base at: #classes. classes := current at: #classes. handled := Set new.
    renames keysAndValuesDo: [:oldName :newName |
        ((oldClasses includesKey: oldName) and: [classes includesKey: newName]) ifTrue: [
            self rename: oldName to: newName from: oldClasses current: classes
                set: set entries: entries clearedComments: clearedComments handled: handled]].
    ((oldClasses keys asSet union: classes keys asSet) difference: handled) do: [:name | | old new record |
        old := oldClasses at: name ifAbsent: [nil]. new := classes at: name ifAbsent: [nil].
        (self state: old differsFrom: new) ifTrue: [
            record := set changeRecorderFor: name.
            self classFrom: old to: new record: record entries: entries clearedComments: clearedComments]]!
rename: oldName to: newName from: oldClasses current: classes set: set entries: entries clearedComments: clearedComments handled: handled
    "Native rename preserves global Associations already held by compiled clients."
    | old new oldMeta newMeta |
    old := oldClasses at: oldName. new := classes at: newName.
    oldMeta := oldName, ' class'. newMeta := newName, ' class'.
    (set changeRecorderFor: oldName) notePriorDefinition: (PseudoClass new definition: (old at: #definition); yourself).
    (set changeRecorderFor: oldMeta) notePriorDefinition: (PseudoClass new definition: ((oldClasses at: oldMeta) at: #definition); yourself).
    set renameClass: (new at: #class) from: oldName to: newName.
    {oldName -> newName. oldMeta -> newMeta} do: [:pair | | before after |
        before := oldClasses at: pair key. after := classes at: pair value.
        self entry: (self entity: 'class' state: before) before: (before at: #definition) after: nil into: entries.
        self classFrom: before to: after record: (set changeRecorderFor: pair value) entries: entries clearedComments: clearedComments.
        handled add: pair key; add: pair value]!
classFrom: old to: new record: record entries: entries clearedComments: clearedComments
    | state before after |
    state := new ifNil: [old].
    before := old ifNotNil: [old at: #definition]. after := new ifNotNil: [new at: #definition].
    self entry: (self entity: 'class' state: state) before: before after: after into: entries.
    new ifNil: [
        ((state at: #entity) at: 'side') = 'instance' ifTrue: [
            record notePriorDefinition: (PseudoClass new definition: before; yourself).
            record noteChangeType: #remove].
        ^ self].
    old ifNil: [record noteChangeType: #add] ifNotNil: [before ~= after ifTrue: [
        record notePriorDefinition: (PseudoClass new definition: before; yourself).
        record noteChangeType: #change]].
    before := old ifNotNil: [old at: #comment]. after := new at: #comment.
    before ~~ after ifTrue: [before := old ifNotNil: [self commentText: old]. after := self commentText: new].
    before ~= after ifTrue: [
        self entry: (self entity: 'comment' state: state) before: before after: after into: entries.
        ((state at: #entity) at: 'side') = 'instance' ifTrue: [
            record noteChangeType: #comment.
            after isEmpty ifTrue: [clearedComments add: ((state at: #entity) at: 'className')]]].
    self protocolsFrom: old to: new record: record entries: entries.
    self methodsFrom: old to: new record: record entries: entries!
protocolsFrom: old to: new record: record entries: entries
    | before after |
    before := old ifNil: [Dictionary new] ifNotNil: [old at: #protocols]. after := new at: #protocols.
    before ~= after ifTrue: [record noteChangeType: #reorganize].
    (before keys asSet union: after keys asSet) do: [:name |
        self entry: ((self entity: 'protocol' state: new) at: 'protocol' put: name; yourself)
            before: ((before at: name ifAbsent: [nil]) ifNotNil: [:selectors | selectors storeString]) after: ((after at: name ifAbsent: [nil]) ifNotNil: [:selectors | selectors storeString]) into: entries]!
methodsFrom: old to: new record: record entries: entries
    | beforeMethods methods |
    beforeMethods := old ifNil: [Dictionary new] ifNotNil: [old at: #methods]. methods := new at: #methods.
    (beforeMethods keys asSet union: methods keys asSet) do: [:selector | | before after |
        (beforeMethods at: selector ifAbsent: [nil]) ~~ (methods at: selector ifAbsent: [nil]) ifTrue: [
            before := (beforeMethods includesKey: selector) ifTrue: [self methodSource: selector state: old] ifFalse: [nil].
            after := (methods includesKey: selector) ifTrue: [self methodSource: selector state: new] ifFalse: [nil].
            before ~= after ifTrue: [
                record atSelector: selector put: (after ifNil: [#remove] ifNotNil: [before ifNil: [#add] ifNotNil: [#change]]).
                self entry: ((self entity: 'method' state: new) at: 'selector' put: selector asString; yourself)
                    before: before after: after into: entries]]]! !

!SEBookChanges methodsFor: 'portable baseline'!
portableState: identity
    | current records |
    current := self capture. records := Dictionary new.
    ((cold at: #classes) keys asSet union: (current at: #classes) keys asSet) do: [:name | | old new |
        old := (cold at: #classes) at: name ifAbsent: [nil]. new := (current at: #classes) at: name ifAbsent: [nil].
        (self state: old differsFrom: new) ifTrue: [records at: name put: (new ifNotNil: [self portableClass: new])]].
    ^ Dictionary new at: 'version' put: 1; at: 'baselineId' put: identity;
        at: 'classes' put: records; at: 'packages' put: (current at: #packages); yourself!
portableClass: state
    | methods |
    methods := Dictionary new.
    (state at: #methods) keysDo: [:selector | methods at: selector asString put: (self methodSource: selector state: state)].
    ^ Dictionary new at: 'entity' put: (state at: #entity); at: 'definition' put: (state at: #definition);
        at: 'comment' put: (self commentText: state); at: 'organization' put: (state at: #organization);
        at: 'protocols' put: (state at: #protocols); at: 'methods' put: methods; yourself!
importState: portable identity: identity
    | state classes |
    (portable at: 'baselineId') = identity ifFalse: [self error: 'PRECONDITION_FAILED'].
    classes := (cold at: #classes) copy.
    (portable at: 'classes') keysAndValuesDo: [:name :record |
        record ifNil: [classes removeKey: name ifAbsent: []] ifNotNil: [ | methods protocols converted |
            methods := Dictionary new. (record at: 'methods') keysAndValuesDo: [:selector :source | methods at: selector asSymbol put: source].
            converted := Dictionary new at: #entity put: (record at: 'entity'); at: #methods put: methods; yourself.
            #(#definition #comment #organization) do: [:field | converted at: field put: (record at: field asString)].
            protocols := Dictionary new.
            (record at: 'protocols') keysAndValuesDo: [:protocolName :selectors | protocols at: protocolName put: (selectors collect: [:selector | selector asSymbol]) asArray].
            converted at: #protocols put: protocols.
            classes at: name put: converted]].
    state := Dictionary new at: #classes put: classes; at: #packages put: (portable at: 'packages'); yourself.
    ^ state!
rebaseTo: portable identity: identity
    baseline := self importState: portable identity: identity.
    previous := self capture.
    lastBundle := [self bundleFrom: baseline to: previous] valueUnpreemptively.
    dirty := false. self resetWatch! !

!SEBookChanges methodsFor: 'raw file conflicts'!
ensureNoConflictsWith: portable identity: identity
    | candidate staged |
    candidate := self importState: portable identity: identity. staged := self capture.
    renames keysDo: [:oldName |
        (((baseline at: #classes) includesKey: oldName) and: [((candidate at: #classes) includesKey: oldName) not]) ifTrue: [
            SEBookRuntimeError signalDetails: (Dictionary new at: 'code' put: 'PRECONDITION_FAILED';
                at: 'message' put: 'Raw file removes the original declaration required by an accepted class rename.'; yourself)]].
    (lastBundle at: 'entries') do: [:entry | | entity original proposed accepted stagedValue |
        entity := entry at: 'entity'.
        original := self valueFor: entity in: baseline.
        proposed := self valueFor: entity in: candidate.
        accepted := self valueFor: entity in: previous.
        stagedValue := self valueFor: entity in: staged.
        (((proposed ~= original) and: [proposed ~= accepted]) or: [stagedValue ~= accepted])
            ifTrue: [SEBookRuntimeError signalDetails: (Dictionary new at: 'code' put: 'PRECONDITION_FAILED';
                at: 'message' put: 'Raw file conflicts with accepted browser changes; preserve this draft and reconcile the sources.'; yourself)]]!
valueFor: entity in: state
    | kind name class selector |
    kind := entity at: 'kind'.
    kind = 'package' ifTrue: [name := entity at: 'packageName'. ^ ((state at: #packages) includes: name) ifTrue: [name] ifFalse: [nil]].
    name := entity at: 'className'. (entity at: 'side') = 'class' ifTrue: [name := name, ' class'].
    class := (state at: #classes) at: name ifAbsent: [^ nil].
    kind = 'class' ifTrue: [^ class at: #definition].
    kind = 'comment' ifTrue: [^ self commentText: class].
    kind = 'protocol' ifTrue: [^ (class at: #protocols) at: (entity at: 'protocol') ifAbsent: [nil]].
    selector := (entity at: 'selector') asSymbol.
    ^ ((class at: #methods) includesKey: selector) ifTrue: [self methodSource: selector state: class] ifFalse: [nil]! !

!SEBookChanges methodsFor: 'VM metadata watch'!
resetWatch
    "Keep every adapter reference image-rooted; discard JS metadata on Worker recovery."
    watchRoots := OrderedCollection new.
    Smalltalk allClasses do: [:class |
        {class. class class} do: [:side |
            watchRoots add: {side. 0. side isMeta ifTrue: [Metaclass instSize] ifFalse: [Class instSize]}; add: {side methodDict. 1};
                add: {side organization. 2}; add: {side instVarNames. 1}; add: {side traitComposition. 3}.
            side isMeta ifFalse: [
                watchRoots add: {side classPool. 1}; add: {side sharedPools. 0}.
                side sharedPools do: [:pool | watchRoots add: {pool. 1}]]]].
    watchRoots add: {SystemOrganization. 2}.
    watchRoots := watchRoots asArray.
    self resetSourceWatch: watchRoots!
resetSourceWatch: roots
    <primitive: 'primitiveResetSourceWatch' module: 'SEBookPlugin'>
    ^ self!
sourceWatchChanged
    <primitive: 'primitiveSourceWatchChanged' module: 'SEBookPlugin'>
    ^ true! !

!SEBookChanges methodsFor: 'immutable cold source'!
coldBytes: fileIndex at: position count: count
    <primitive: 'primitiveColdSource' module: 'SEBookPlugin'>
    self error: 'Cold source read exceeds its bounded contract'!
hasColdSource: pointer
    pointer = 0 ifTrue: [^ false].
    ^ (self coldBytes: (SourceFiles fileIndexFromSourcePointer: pointer)
        at: (SourceFiles filePositionFromSourcePointer: pointer) count: 0) notNil!
coldSource: pointer
    | bytes stream text count |
    pointer = 0 ifTrue: [^ nil].
    count := 4096.
    [
        bytes := self coldBytes: (SourceFiles fileIndexFromSourcePointer: pointer)
            at: (SourceFiles filePositionFromSourcePointer: pointer) count: count.
        bytes ifNil: [^ nil].
        stream := bytes asString readStream. text := stream nextChunk.
        (stream atEnd and: [bytes size = count]) ifFalse: [^ text asByteArray utf8Decoded].
        count = 1048576 ifTrue: [self error: 'Cold source chunk exceeds one MiB'].
        count := count * 2
    ] repeat! !

!SEBookChanges methodsFor: 'current retained source'!
sourceFor: selector in: class
    ^ self methodSource: selector state: (self stateOf: class)!
commentFor: class
    ^ self commentText: (self stateOf: class theNonMetaClass)! !
