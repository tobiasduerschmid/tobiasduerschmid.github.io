Object subclass: #SEBookBrowser
    instanceVariableNames: 'pageLimit sourceReader'
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookBrowser methodsFor: 'configuration'!
pageLimit: count
    pageLimit := count!
sourceReader: reader
    sourceReader := reader! !
!SEBookBrowser methodsFor: 'queries'!
browse: query revision: revision
    | kind selector items source result |
    kind := query at: 'kind'.
    selector := kind = 'variableReferences' ifTrue: [#queryVariableReferences:] ifFalse: [('query', kind capitalized, ':') asSymbol].
    (self respondsTo: selector) ifFalse: [self error: 'PRECONDITION_FAILED'].
    kind = 'source'
        ifTrue: [items := #(). source := self querySource: query]
        ifFalse: [items := self perform: selector with: query].
    result := self page: items query: query.
    result at: 'revision' put: revision.
    kind = 'variableReferences' ifTrue: [result at: 'scope' put: (self variableScope: query)].
    source ifNotNil: [result at: 'source' put: source].
    ^ result!
page: collection query: query
    | items search offset end |
    search := self labelSearchFor: query.
    items := (collection select: [:item | search isEmpty or: [
        (item at: 'label') includesSubstring: search caseSensitive: false]]) asArray.
    (query at: 'kind') = 'versions' ifFalse: [items sort: [:a :b | (a at: 'label') <= (b at: 'label')]].
    offset := query at: 'offset'. end := offset + ((query at: 'limit') min: pageLimit) min: items size.
    ^ Dictionary new
        at: 'items' put: (offset >= items size ifTrue: [#()] ifFalse: [items copyFrom: offset + 1 to: end]);
        at: 'nextOffset' put: (end < items size ifTrue: [end] ifFalse: [nil]); yourself!
labelSearchFor: query
    "A reference search without a target selector uses search as the selector,
    not as a second filter on the differently named callers."
    ((#('senders' 'implementors') includes: (query at: 'kind')) and: [
        ((query at: 'target' ifAbsent: [Dictionary new]) includesKey: 'selector') not])
        ifTrue: [^ ''].
    ^ query at: 'search' ifAbsent: ['']!
queryPackages: query
    ^ SystemOrganization categories collect: [:category |
        self item: category asString target: (Dictionary new at: 'kind' put: 'package'; at: 'packageName' put: category asString; yourself)]!
queryClasses: query
    | target |
    target := query at: 'target' ifAbsent: [Dictionary new].
    ^ (Smalltalk allClasses select: [:class | (target includesKey: 'packageName') not or: [class category = (target at: 'packageName')]])
        collect: [:class | self classItem: class]!
queryProtocols: query
    | target |
    target := query at: 'target'.
    ^ (self classFor: target) organization categories collect: [:category |
        self item: category asString target: (target copy at: 'kind' put: 'protocol'; at: 'protocol' put: category asString; yourself)]!
queryMethods: query
    | target class |
    target := query at: 'target'. class := self classFor: target.
    ^ (class selectors select: [:selector | (target includesKey: 'protocol') not or: [
        (class organization categoryOfElement: selector) = (target at: 'protocol') asSymbol]])
        collect: [:selector | self item: selector asString target: (self methodTarget: selector class: class)]!
querySource: query
    | target class |
    target := query at: 'target'.
    (target at: 'kind') = 'file' ifTrue: [^ FileStream readOnlyFileNamed: (target at: 'path') do: [:stream | stream contents]].
    class := self classFor: target.
    (target at: 'kind') = 'method' ifTrue: [^ sourceReader
        ifNil: [(class sourceCodeAt: (target at: 'selector') asSymbol) asString]
        ifNotNil: [sourceReader sourceFor: (target at: 'selector') asSymbol in: class]].
    (target at: 'kind') = 'comment' ifTrue: [^ sourceReader
        ifNil: [class comment asString] ifNotNil: [sourceReader commentFor: class]].
    ^ class definition!
queryHierarchy: query
    | class |
    class := self classFor: (query at: 'target').
    ^ (class allSuperclasses reverse, {class}, class allSubclasses) collect: [:each | self classItem: each]!
queryVariables: query
    | class items names |
    class := self classFor: (query at: 'target'). items := OrderedCollection new.
    class allInstVarNames do: [:name | items add: (self variableItem: name kind: 'instance'
        owner: (self instanceVariableOwner: name in: class))].
    names := Set new.
    class theNonMetaClass withAllSuperclasses do: [:owner | owner classVarNames do: [:name |
        (names includes: name) ifFalse: [names add: name.
            items add: (self variableItem: name asString kind: 'class' owner: owner)]]].
    ^ items!
queryVariableReferences: query
    | variable class owner name items binding |
    variable := query at: 'variable'. name := variable at: 'name'.
    class := self classFor: (query at: 'target'). items := OrderedCollection new.
    (variable at: 'kind') = 'instance' ifTrue: [
        owner := self instanceVariableOwner: name in: class.
        ({owner}, owner allSubclasses) do: [:each |
            (each whichSelectorsAccess: name) do: [:selector |
                items add: (self item: each name, '>>', selector asString target: (self methodTarget: selector class: each))]].
        ^ items].
    owner := self classVariableOwner: name in: class.
    binding := owner classPool associationAt: name asSymbol.
    Smalltalk allClassesAndTraitsDo: [:each | {each. each class} do: [:side |
        side selectorsAndMethodsDo: [:selector :method |
            (self method: method refersToBinding: binding) ifTrue: [
                items add: (self item: side name, '>>', selector asString target: (self methodTarget: selector class: side))]]]].
    ^ items!
querySenders: query
    ^ self methodsMatching: [:name :method :selector | method hasLiteral: selector] query: query!
queryImplementors: query
    ^ self methodsMatching: [:name :method :selector | name = selector] query: query!
queryVersions: query
    | target class method versions |
    target := query at: 'target'. class := self classFor: target.
    method := class compiledMethodAt: (target at: 'selector') asSymbol.
    versions := ChangeSet scanVersionsOf: method class: class theNonMetaClass meta: class isMeta
        category: (class organization categoryOfElement: method selector) selector: method selector.
    versions ifNil: [^ #()].
    ^ versions withIndexCollect: [:version :index | Dictionary new at: 'id' put: index asString;
        at: 'label' put: index asString, ' ', version stamp; at: 'detail' put: version string; yourself]! !
!SEBookBrowser methodsFor: 'native system queries'!
methodsMatching: predicate query: query
    | target selector items |
    target := query at: 'target' ifAbsent: [Dictionary new].
    selector := (target at: 'selector' ifAbsent: [query at: 'search']) asSymbol.
    items := OrderedCollection new.
    Smalltalk allClassesAndTraitsDo: [:class | {class. class class} do: [:side |
        side selectorsAndMethodsDo: [:name :method |
            (predicate value: name value: method value: selector) ifTrue: [
                items add: (self item: side name, '>>', name asString target: (self methodTarget: name class: side))]]]].
    ^ items!
classFor: target
    | class |
    class := Smalltalk at: (target at: 'className') asSymbol ifAbsent: [self error: 'PRECONDITION_FAILED'].
    ^ (target at: 'side' ifAbsent: ['instance']) = 'class' ifTrue: [class class] ifFalse: [class]!
classItem: class
    ^ self item: class name target: (Dictionary new at: 'kind' put: 'class'; at: 'className' put: class theNonMetaClass name;
        at: 'side' put: (class isMeta ifTrue: ['class'] ifFalse: ['instance']);
        at: 'packageName' put: class theNonMetaClass category asString; yourself)!
methodTarget: selector class: class
    ^ Dictionary new at: 'kind' put: 'method'; at: 'className' put: class theNonMetaClass name;
        at: 'side' put: (class isMeta ifTrue: ['class'] ifFalse: ['instance']); at: 'selector' put: selector asString;
        at: 'packageName' put: class theNonMetaClass category asString;
        at: 'protocol' put: (class organization categoryOfElement: selector) asString; yourself!
item: label target: target
    ^ Dictionary new at: 'id' put: label; at: 'label' put: label; at: 'target' put: target; yourself! !

!SEBookBrowser methodsFor: 'variable bindings'!
instanceVariableOwner: name in: class
    ^ class withAllSuperclasses detect: [:each | each instVarNames includes: name]
        ifNone: [self error: 'PRECONDITION_FAILED']!
classVariableOwner: name in: class
    ^ class theNonMetaClass withAllSuperclasses detect: [:each | each classPool includesKey: name asSymbol]
        ifNone: [self error: 'PRECONDITION_FAILED']!
method: method refersToBinding: binding
    method allLiteralsDo: [:literal | literal == binding ifTrue: [^ true]].
    ^ false!
variableItem: name kind: kind owner: owner
    ^ Dictionary new at: 'id' put: kind, ':', name; at: 'label' put: name, ' (', kind, ')';
        at: 'variable' put: (Dictionary new at: 'kind' put: kind; at: 'name' put: name; yourself);
        at: 'declaringClass' put: ((self classItem: owner) at: 'target');
        at: 'detail' put: 'Declared by ', owner name; yourself!
variableScope: query
    | variable name class owner |
    variable := query at: 'variable'. name := variable at: 'name'.
    class := self classFor: (query at: 'target').
    (variable at: 'kind') = 'instance' ifTrue: [
        owner := self instanceVariableOwner: name in: class.
        ^ 'Instance slot ', name, ': ', owner name, ' declaration hierarchy (declaring class and descendants).'].
    owner := self classVariableOwner: name in: class.
    ^ 'Class variable ', name, ': references to the ', owner name, ' binding across the image, on both sides.'! !
