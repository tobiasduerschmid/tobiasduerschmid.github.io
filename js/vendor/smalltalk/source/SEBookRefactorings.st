"Local source adapters keep RB AST positions and inverse changes on the retained source cut."
RBNamespace subclass: #SEBookRefactoringModel
    instanceVariableNames: 'sourceReader' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
RBClass subclass: #SEBookRefactoringClass
    instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
RBMetaclass subclass: #SEBookRefactoringMetaclass
    instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookRefactoringClass methodsFor: 'method accessing'!
methodFor: selector
    ^ model retainedMethod: (super methodFor: selector)!
bindingOf: name
    ^ model classVariableBinding: name in: self! !
!SEBookRefactoringMetaclass methodsFor: 'method accessing'!
methodFor: selector
    ^ model retainedMethod: (super methodFor: selector)!
bindingOf: name
    ^ model classVariableBinding: name in: self! !
!SEBookRefactoringModel methodsFor: 'source model'!
sourceReader: reader
    sourceReader := reader!
classVariableBinding: name in: modelClass
    "The pinned RB bindingOf: checks only the own pool and misses inherited-variable callers."
    modelClass realClass ifNotNil: [:real |
        real theNonMetaClass withAllSuperclasses do: [:class | | binding |
            binding := class classPool associationAt: name asSymbol ifAbsent: [nil].
            binding ifNotNil: [^ binding]]].
    ^ nil!
retainedMethod: method
    "New model methods already own their source; installed methods use the native ledger."
    (method notNil and: [method method notNil]) ifTrue: [
        method source: (sourceReader sourceFor: method selector in: method modelClass realClass)].
    ^ method!
createNewClassFor: behavior
    | name |
    name := behavior theNonMetaClass name.
    ^ changedClasses at: name put: (Array
        with: ((SEBookRefactoringClass existingNamed: name) model: self; yourself)
        with: ((SEBookRefactoringMetaclass existingNamed: name) model: self; yourself))! !

RBAddMethodChange subclass: #SEBookAddMethodChange
    instanceVariableNames: 'sourceReader' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
RBRemoveMethodChange subclass: #SEBookRemoveMethodChange
    instanceVariableNames: 'sourceReader' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookAddMethodChange methodsFor: 'retained inverse'!
sourceReader: reader
    sourceReader := reader!
identityFrom: change
    className := change changeClassName. isMeta := change isMeta!
asUndoOperation
    ^ SEBookRefactorings inverseFor: self reader: sourceReader! !
!SEBookRemoveMethodChange methodsFor: 'retained inverse'!
sourceReader: reader
    sourceReader := reader!
identityFrom: change
    className := change changeClassName. isMeta := change isMeta!
asUndoOperation
    ^ SEBookRefactorings inverseFor: self reader: sourceReader! !

Object subclass: #SEBookRefactorings
    instanceVariableNames: 'sourceReader previews nextToken generation'
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookRefactorings class methodsFor: 'native method changes'!
definitionForModelClass: class
    class isMeta ifFalse: [^ class definitionString].
    ^ class printString, ' instanceVariableNames: ', (String streamContents: [:stream |
        class instanceVariableNames do: [:name | stream nextPutAll: name; space]]) storeString!
inverseFor: change reader: reader
    | class selector |
    class := change changeClass. selector := change selector.
    ^ ((class includesSelector: selector)
        ifTrue: [SEBookAddMethodChange compile: (reader sourceFor: selector in: class)
            in: class classified: (class organization categoryOfElement: selector)]
        ifFalse: [SEBookRemoveMethodChange remove: selector from: class]) sourceReader: reader; yourself! !
!SEBookRefactorings methodsFor: 'lifecycle'!
initialize
    super initialize. previews := Dictionary new. nextToken := 0!
sourceReader: reader generation: identity
    sourceReader := reader. self generation: identity.
    self ordinarySourceAccepted!
ordinarySourceAccepted
    "The accepted-program boundary is stricter than upstream notification filtering."
    RBRefactoryChangeManager instance clearUndoRedoList!
generation: identity
    generation := identity. previews removeAll!
history
    | manager undo redo |
    manager := RBRefactoryChangeManager instance.
    undo := manager hasUndoableOperations. redo := manager hasRedoableOperations.
    ^ Dictionary new at: 'canUndo' put: undo; at: 'canRedo' put: redo;
        at: 'reason' put: ((undo or: [redo]) ifTrue: [nil] ifFalse: ['No refactoring history. Ordinary accepted source or file edits and session restarts clear history.']); yourself!
fail: message
    SEBookRuntimeError signalDetails: (Dictionary new at: 'code' put: 'PRECONDITION_FAILED'; at: 'message' put: message; yourself)! !

!SEBookRefactorings methodsFor: 'catalog and constructors'!
definitions
    "Typed form metadata and genuine native constructor are one declaration."
    ^ {
        { 'renameClass'. 'Rename class'. 'class'. { (self input: 'newName' label: 'New class name' type: 'text') }. nil.
            [:model :class :request | RBRenameClassRefactoring model: model rename: class to: ((request at: 'options') at: 'newName') asSymbol] }.
        { 'renameMethod'. 'Rename method'. 'method'. { (self input: 'newSelector' label: 'New selector' type: 'text') }. nil.
            [:model :class :request | self renameMethodIn: model class: class request: request] }.
        { 'renameInstanceVariable'. 'Rename instance variable'. 'class'. { (self input: 'oldName' label: 'Current variable name' type: 'text') . (self input: 'newName' label: 'New variable name' type: 'text') }. nil.
            [:model :class :request | RBRenameInstanceVariableRefactoring model: model rename: ((request at: 'options') at: 'oldName') to: ((request at: 'options') at: 'newName') in: class] }.
        { 'renameClassVariable'. 'Rename class variable'. 'class'. { (self input: 'oldName' label: 'Current variable name' type: 'text') . (self input: 'newName' label: 'New variable name' type: 'text') }. nil.
            [:model :class :request | RBRenameClassVariableRefactoring model: model rename: ((request at: 'options') at: 'oldName') to: ((request at: 'options') at: 'newName') in: class] }.
        { 'renameTemporary'. 'Rename temporary'. 'method'. { (self input: 'newName' label: 'New temporary name' type: 'text') }. 'Select the exact temporary identifier'.
            [:model :class :request | RBRenameTemporaryRefactoring model: model renameTemporaryFrom: (self intervalFor: request in: class) to: ((request at: 'options') at: 'newName') in: class selector: ((request at: 'target') at: 'selector') asSymbol] }.
        { 'renameArgument'. 'Rename argument'. 'method'. { (self input: 'newName' label: 'New argument name' type: 'text') }. 'Select the exact argument identifier'.
            [:model :class :request | RBRenameTemporaryRefactoring model: model renameTemporaryFrom: (self intervalFor: request in: class) to: ((request at: 'options') at: 'newName') in: class selector: ((request at: 'target') at: 'selector') asSymbol] }.
        { 'extractMethod'. 'Extract method'. 'method'. { (self input: 'newSelector' label: 'Extracted method selector' type: 'text') . (self input: 'extractAssignment' label: 'Keep trailing assignment' type: 'boolean') . (self input: 'useExistingMethod' label: 'Reuse equivalent method' type: 'boolean') }. 'Select an expression or statements'.
            [:model :class :request | self configureMethodName: (RBExtractMethodRefactoring model: model extract: (self intervalFor: request in: class) from: ((request at: 'target') at: 'selector') asSymbol in: class) request: request] }.
        { 'extractTemporary'. 'Extract temporary'. 'method'. { (self input: 'newName' label: 'New temporary name' type: 'text') }. 'Select an expression'.
            [:model :class :request | RBExtractToTemporaryRefactoring model: model extract: (self intervalFor: request in: class) to: ((request at: 'options') at: 'newName') from: ((request at: 'target') at: 'selector') asSymbol in: class] }.
        { 'inlineMethod'. 'Inline self or super method'. 'method'. { (self input: 'inlineExpression' label: 'Allow repeated argument evaluation' type: 'boolean') }. 'Select a self or super message send'.
            [:model :class :request | (RBInlineMethodRefactoring model: model inline: (self intervalFor: request in: class) inMethod: ((request at: 'target') at: 'selector') asSymbol forClass: class) setOption: #inlineExpression toUse: [:ref :source | ((request at: 'options') at: 'inlineExpression')]; yourself] }.
        { 'inlineTemporary'. 'Inline temporary'. 'method'. {  }. 'Select the temporary assignment'.
            [:model :class :request | RBInlineTemporaryRefactoring model: model inline: (self intervalFor: request in: class) from: ((request at: 'target') at: 'selector') asSymbol in: class] }.
        { 'moveMethod'. 'Move method to component'. 'method'. { (self input: 'receiverVariable' label: 'Receiver variable' type: 'text') . (self input: 'destinationClasses' label: 'Destination classes' type: 'string-list') . (self input: 'newSelector' label: 'Moved method selector' type: 'text') . (self input: 'selfArgumentName' label: 'Name for original self' type: 'text') }. nil.
            [:model :class :request | self moveMethodIn: model class: class request: request] }.
        { 'moveVariable'. 'Move temporary into narrower scope'. 'method'. {  }. 'Select the temporary identifier'.
            [:model :class :request | RBMoveVariableDefinitionRefactoring model: model bindTight: (self intervalFor: request in: class) in: class selector: ((request at: 'target') at: 'selector') asSymbol] }.
        { 'pullUpMethod'. 'Pull up method'. 'method'. {  }. nil.
            [:model :class :request | RBPullUpMethodRefactoring model: model pullUp: (Array with: ((request at: 'target') at: 'selector') asSymbol) from: class] }.
        { 'pushDownMethod'. 'Push down method'. 'method'. {  }. nil.
            [:model :class :request | RBPushDownMethodRefactoring model: model pushDown: (Array with: ((request at: 'target') at: 'selector') asSymbol) from: class] }.
        { 'pullUpVariable'. 'Pull variable into selected superclass'. 'class'. { (self input: 'variableName' label: 'Variable name' type: 'text') . (self input: 'classVariable' label: 'Class variable' type: 'boolean') }. nil.
            [:model :class :request | (((request at: 'options') at: 'classVariable') ifTrue: [RBPullUpClassVariableRefactoring] ifFalse: [RBPullUpInstanceVariableRefactoring]) model: model variable: ((request at: 'options') at: 'variableName') class: class] }.
        { 'pushDownVariable'. 'Push variable into referencing subclasses'. 'class'. { (self input: 'variableName' label: 'Variable name' type: 'text') . (self input: 'classVariable' label: 'Class variable' type: 'boolean') }. nil.
            [:model :class :request | (((request at: 'options') at: 'classVariable') ifTrue: [RBPushDownClassVariableRefactoring] ifFalse: [RBPushDownInstanceVariableRefactoring]) model: model variable: ((request at: 'options') at: 'variableName') class: class] }.
        { 'addParameter'. 'Append parameter'. 'method'. { (self input: 'newSelector' label: 'New selector' type: 'text') . (self input: 'initializer' label: 'Default argument expression' type: 'source') }. nil.
            [:model :class :request | RBAddParameterRefactoring model: model addParameterToMethod: ((request at: 'target') at: 'selector') asSymbol in: class newSelector: ((request at: 'options') at: 'newSelector') asSymbol initializer: ((request at: 'options') at: 'initializer')] }.
        { 'removeParameter'. 'Remove unused parameter'. 'method'. { (self input: 'argumentName' label: 'Unused argument name' type: 'text') }. nil.
            [:model :class :request | self removeParameterIn: model class: class request: request] }.
        { 'reorderParameters'. 'Reorder parameters'. 'method'. { (self input: 'newSelector' label: 'New selector' type: 'text') . (self input: 'permutation' label: 'Old argument position for each new position' type: 'integer-list') }. nil.
            [:model :class :request | self renameMethodIn: model class: class request: request] }.
        { 'addClass'. 'Add subclass'. 'class'. { (self input: 'newName' label: 'New class name' type: 'text') . (self input: 'subclasses' label: 'Immediate subclasses to reparent' type: 'string-list') . (self input: 'category' label: 'Package name' type: 'text') }. nil.
            [:model :class :request | RBAddClassRefactoring model: model addClass: ((request at: 'options') at: 'newName') asSymbol superclass: class subclasses: (((request at: 'options') at: 'subclasses') collect: [:name | name asSymbol]) category: ((request at: 'options') at: 'category') asSymbol] }.
        { 'removeClass'. 'Remove class'. 'class'. {  }. nil.
            [:model :class :request | RBRemoveClassRefactoring model: model classNames: (Array with: class name)] }.
        { 'addMethod'. 'Add method'. 'class'. { (self input: 'source' label: 'Method source' type: 'source') . (self input: 'protocols' label: 'Protocols' type: 'string-list') }. nil.
            [:model :class :request | RBAddMethodRefactoring model: model addMethod: ((request at: 'options') at: 'source') toClass: class inProtocols: (((request at: 'options') at: 'protocols') collect: [:name | name asSymbol])] }.
        { 'removeMethod'. 'Remove method'. 'method'. {  }. nil.
            [:model :class :request | RBRemoveMethodRefactoring model: model removeMethods: (Array with: ((request at: 'target') at: 'selector') asSymbol) from: class] }.
        { 'createAccessors'. 'Create variable accessors'. 'class'. { (self input: 'variableName' label: 'Variable name' type: 'text') . (self input: 'classVariable' label: 'Class variable' type: 'boolean') }. nil.
            [:model :class :request | RBCreateAccessorsForVariableRefactoring model: model variable: ((request at: 'options') at: 'variableName') class: class classVariable: ((request at: 'options') at: 'classVariable')] }.
        { 'splitClass'. 'Split class'. 'class'. { (self input: 'instanceVariables' label: 'Instance variables' type: 'string-list') . (self input: 'newClassName' label: 'Extracted class name' type: 'text') . (self input: 'referenceVariableName' label: 'Reference variable' type: 'text') }. nil.
            [:model :class :request | self fail: self splitClassUnavailableReason] }
    }!
splitClassUnavailableReason
    ^ 'Split class is unavailable: native split loses retained field values, leaves extracted components uninitialized, and lacks verified reverse migration for Undo.'!
input: name label: label type: type
    ^ Dictionary new at: 'name' put: name; at: 'label' put: label;
        at: 'type' put: type; at: 'required' put: true; yourself!
catalog: target
    ^ (self definitionsFor: target) collect: [:definition | | options entry reason |
        options := Dictionary new at: 'inputs' put: definition fourth; yourself.
        definition fifth ifNotNil: [options at: 'selection' put: (Dictionary new
            at: 'required' put: true; at: 'label' put: definition fifth; yourself)].
        reason := self applicabilityReason: definition target: target.
        entry := Dictionary new at: 'action' put: definition first; at: 'label' put: definition second;
            at: 'options' put: options; at: 'applicable' put: reason isNil; yourself.
        reason ifNotNil: [entry at: 'reason' put: reason]. entry]!
definitionsFor: target
    "Creation defaults belong with native constructors, including an empty package's superclass."
    ^ self definitions collect: [:definition | | inputs |
        inputs := definition fourth.
        definition first = 'addClass' ifTrue: [
            inputs do: [:input |
                (input at: 'name') = 'category' ifTrue: [input at: 'default' put: (target at: 'packageName' ifAbsent: [
                    (self classFor: target) theNonMetaClass category asString])].
                (input at: 'name') = 'subclasses' ifTrue: [input at: 'default' put: #()]].
            (target at: 'kind') = 'package' ifTrue: [
                definition at: 2 put: 'Add class'.
                inputs := {(self input: 'superclassName' label: 'Superclass name' type: 'text') at: 'default' put: 'Object'; yourself}, inputs]].
        definition first = 'addMethod' ifTrue: [inputs do: [:input |
            (input at: 'name') = 'protocols' ifTrue: [input at: 'default' put: (Array with: (target at: 'protocol' ifAbsent: ['as yet unclassified']))]]].
        definition at: 4 put: inputs. definition]!
classForRequest: request
    | target |
    target := request at: 'target'.
    ((request at: 'action') = 'addClass' and: [(target at: 'kind') = 'package']) ifTrue: [
        ^ self classFor: (Dictionary new at: 'kind' put: 'class'; at: 'side' put: 'instance';
            at: 'className' put: ((request at: 'options') at: 'superclassName'); yourself)].
    ^ self classFor: target!

applicabilityReason: definition target: target
    | class |
    (definition first = 'addClass' and: [(target at: 'kind') = 'package']) ifTrue: [
        ^ (SystemOrganization categories includes: (target at: 'packageName') asSymbol)
            ifTrue: [nil] ifFalse: ['Select an existing package.']].
    definition first = 'splitClass' ifTrue: [^ self splitClassUnavailableReason].
    (target includesKey: 'className') ifFalse: [^ 'Select an existing class.'].
    class := Smalltalk at: (target at: 'className') asSymbol ifAbsent: [^ 'Select an existing class.'].
    (class isBehavior and: [class isTrait not]) ifFalse: [^ 'Select an ordinary class.'].
    (target at: 'side' ifAbsent: ['instance']) = 'class' ifTrue: [class := class class].
    definition third = 'method' ifTrue: [
        ((target at: 'kind') = 'method' and: [class includesSelector: (target at: 'selector') asSymbol])
            ifFalse: [^ 'Select an existing method.']].
    ^ nil!
classFor: target
    | class |
    class := Smalltalk at: (target at: 'className') asSymbol ifAbsent: [self fail: 'The target class no longer exists.'].
    (class isBehavior and: [class isTrait not]) ifFalse: [self fail: 'Select an ordinary class or method.'].
    ^ (target at: 'side' ifAbsent: ['instance']) = 'class' ifTrue: [class class] ifFalse: [class]!
validatedDefinition: request
    | definition options reason |
    definition := (self definitionsFor: (request at: 'target')) detect: [:each | each first = (request at: 'action')]
        ifNone: [self fail: 'Unknown refactoring action.'].
    reason := self applicabilityReason: definition target: (request at: 'target').
    reason ifNotNil: [self fail: reason].
    options := request at: 'options'.
    options keys asSet = ((definition fourth collect: [:input | input at: 'name']) asSet)
        ifFalse: [self fail: 'Provide exactly the declared named inputs.'].
    definition fourth do: [:input | self validateInput: input value: (options at: (input at: 'name'))].
    ^ definition!
validateInput: input value: value
    | type valid |
    type := input at: 'type'. valid := false.
    (#('text' 'source') includes: type) ifTrue: [valid := value isString and: [value notEmpty]].
    type = 'boolean' ifTrue: [valid := value == true or: [value == false]].
    type = 'string-list' ifTrue: [valid := value isArray and: [value allSatisfy: [:each | each isString and: [each notEmpty]]]].
    type = 'integer-list' ifTrue: [valid := value isArray and: [value allSatisfy: [:each | each isInteger]]].
    valid ifFalse: [self fail: 'Invalid input: ', (input at: 'label')].!
renameMethodIn: model class: class request: request
    | old new permutation |
    old := ((request at: 'target') at: 'selector') asSymbol.
    new := ((request at: 'options') at: 'newSelector') asSymbol.
    (RBScanner isSelector: new) ifFalse: [self fail: 'Enter a valid Smalltalk selector.'].
    old numArgs = new numArgs ifFalse: [self fail: 'Preserve the number of arguments.'].
    permutation := (request at: 'options') at: 'permutation' ifAbsent: [(1 to: old numArgs) asArray].
    (permutation size = old numArgs and: [permutation asSet = (1 to: old numArgs) asSet])
        ifFalse: [self fail: 'Permutation must contain each argument position exactly once.'].
    permutation asArray = (1 to: old numArgs) asArray ifFalse: [self validateReordering: old in: model].
    ^ RBRenameMethodRefactoring model: model renameMethod: old in: class to: new permutation: permutation!
validateReordering: selector in: model
    "Stock RB moves argument trees without preserving their evaluation order."
    self validateCallerArguments: selector positions: (1 to: selector numArgs) in: model
        reason: 'Extract complex caller arguments to temporaries before reordering parameters; the native engine would change their evaluation order.'!
removeParameterIn: model class: class request: request
    | selector argument tree index |
    selector := ((request at: 'target') at: 'selector') asSymbol.
    argument := (request at: 'options') at: 'argumentName'.
    tree := (model classFor: class) parseTreeFor: selector.
    tree ifNil: [self fail: 'The method cannot be parsed safely.'].
    index := tree argumentNames indexOf: argument.
    index > 0 ifFalse: [self fail: 'Select a declared method parameter.'].
    self validateCallerArguments: selector positions: (Array with: index) in: model
        reason: 'Extract complex caller arguments to temporaries before removing this parameter; the native engine would discard their evaluation.'.
    ^ RBRemoveParameterRefactoring model: model removeParameter: argument in: class selector: selector!
validateCallerArguments: selector positions: positions in: model reason: reason
    model allReferencesTo: selector do: [:method | | tree |
        tree := method parseTree.
        tree ifNil: [self fail: 'A caller cannot be parsed safely.'].
        tree nodesDo: [:node |
            (node isMessage and: [node selector = selector]) ifTrue: [
                (positions allSatisfy: [:index | | argument |
                    argument := node arguments at: index.
                    argument isVariable or: [argument isLiteral]])
                    ifFalse: [self fail: reason]]]]!
configureMethodName: ref request: request
    | options calls |
    options := request at: 'options'. calls := 0.
    ref setOption: #methodName toUse: [:ignored :inferred |
        calls := calls + 1. calls > 1 ifTrue: [self fail: 'The method name was rejected; choose another selector.'].
        inferred selector: (options at: 'newSelector') asSymbol.
        ((RBScanner isSelector: inferred selector) and: [inferred selector numArgs = inferred arguments size])
            ifFalse: [self fail: 'Selector arity must match the extracted arguments.'].
        inferred].
    ref setOption: #alreadyDefined toUse: [:ignored :class :selector | self fail: 'The destination already defines this selector.'].
    ref setOption: #extractAssignment toUse: [:ignored :variable | options at: 'extractAssignment' ifAbsent: [false]].
    ref setOption: #useExistingMethod toUse: [:ignored :selector | options at: 'useExistingMethod' ifAbsent: [false]].
    ref setOption: #inlineExpression toUse: [:ignored :expression | false].
    ^ ref!
moveMethodIn: model class: class request: request
    | options ref calls |
    options := request at: 'options'. calls := 0.
    ref := RBMoveMethodRefactoring model: model selector: ((request at: 'target') at: 'selector') asSymbol
        class: class variable: (options at: 'receiverVariable').
    ref setOption: #variableTypes toUse: [:ignored :types :selected |
        (options at: 'destinationClasses') isEmpty ifTrue: [self fail: 'Select a destination class.'].
        (options at: 'destinationClasses') collect: [:name |
            (model classNamed: name asSymbol) ifNil: [self fail: 'Destination class does not exist.']]].
    ref setOption: #selfArgumentName toUse: [:ignored |
        calls := calls + 1. calls > 1 ifTrue: [self fail: 'Choose a different name for the original receiver.'].
        options at: 'selfArgumentName'].
    ^ self configureMethodName: ref request: request!
validateVariableTarget: request class: class
    | action options name classVariable |
    action := request at: 'action'. options := request at: 'options'.
    (#('renameInstanceVariable' 'renameClassVariable' 'pushDownVariable' 'createAccessors') includes: action) ifFalse: [^ self].
    name := options at: 'oldName' ifAbsent: [options at: 'variableName'].
    classVariable := action = 'renameClassVariable' or: [options at: 'classVariable' ifAbsent: [false]].
    (classVariable ifTrue: [class theNonMetaClass allClassVarNames includes: name asSymbol]
        ifFalse: [class allInstVarNames includes: name])
        ifFalse: [self fail: 'The selected class does not define or inherit this variable.']!
validateTemporaryAssignment: request class: class model: model
    | tree node |
    tree := (model classFor: class) parseTreeFor: ((request at: 'target') at: 'selector') asSymbol.
    node := tree whichNodeIsContainedBy: (self intervalFor: request in: class).
    (node notNil and: [node isAssignment and: [(node whoDefines: node variable name) isKindOf: RBSequenceNode]])
        ifFalse: [self fail: 'Select a complete temporary assignment statement.'].
    ((self immutableLiteral: node value) or: [self isImmediateSingleReturn: node]) ifFalse: [
        self fail: 'Inline only immutable literals or an assignment immediately followed by its sole return use; native substitution can duplicate or defer side effects.']!
immutableLiteral: node
    | value |
    node isLiteral ifFalse: [^ false].
    value := node value.
    ^ value class == SmallInteger or: [value isSymbol or: [value isCharacter or: [
        value == nil or: [value == true or: [value == false]]]]]!
isImmediateSingleReturn: assignment
    | sequence index next references |
    sequence := assignment parent.
    sequence isSequence ifFalse: [^ false].
    index := sequence statements indexOf: assignment.
    index < sequence statements size ifFalse: [^ false].
    next := sequence statements at: index + 1.
    (next isReturn and: [next value isVariable and: [next value name = assignment variable name]]) ifFalse: [^ false].
    references := 0.
    (assignment whoDefines: assignment variable name) statements do: [:statement | statement nodesDo: [:node |
        (node isVariable and: [node ~~ assignment variable and: [node name = assignment variable name]])
            ifTrue: [references := references + 1]]].
    ^ references = 1!
validateArgumentSelection: request class: class model: model
    | interval tree |
    interval := self intervalFor: request in: class.
    tree := (model classFor: class) parseTreeFor: ((request at: 'target') at: 'selector') asSymbol.
    (tree arguments anySatisfy: [:node | node start = interval first and: [node stop = interval last]])
        ifFalse: [self fail: 'Select an exact method argument in its declaration.']!
intervalFor: request in: class
    | source selection start end |
    selection := request at: 'selection' ifAbsent: [self fail: 'Select a nonempty source range.'].
    source := sourceReader sourceFor: ((request at: 'target') at: 'selector') asSymbol in: class.
    start := self characterOffset: (selection at: 'start') in: source.
    end := self characterOffset: (selection at: 'end') in: source.
    start < end ifFalse: [self fail: 'Select a nonempty source range.'].
    ^ start + 1 to: end!
characterOffset: offset in: source
    | units characters |
    units := 0. characters := 0.
    source do: [:character |
        units = offset ifTrue: [^ characters].
        units := units + (character asInteger > 65535 ifTrue: [2] ifFalse: [1]).
        characters := characters + 1].
    units = offset ifTrue: [^ characters].
    self fail: 'Selection must use UTF-16 boundaries in the current source.'! !

!SEBookRefactorings methodsFor: 'preview'!
prepare: request revision: revision
    | definition class model ref warnings change token bundle targetPackage |
    definition := self validatedDefinition: request.
    class := self classForRequest: request.
    self validateVariableTarget: request class: class.
    model := (SEBookRefactoringModel onEnvironment: RBBrowserEnvironment new) sourceReader: sourceReader; yourself.
    warnings := OrderedCollection new.
    (request at: 'action') = 'renameArgument' ifTrue: [self validateArgumentSelection: request class: class model: model].
    (request at: 'action') = 'inlineTemporary' ifTrue: [self validateTemporaryAssignment: request class: class model: model].
    [
        ref := definition sixth value: model value: class value: request.
        [ref primitiveExecute] on: RBRefactoringWarning do: [:warning | warnings add: warning messageText. warning resume]
    ] on: RBRefactoringError do: [:error | self fail: error messageText].
    change := self retainedChange: ref changes.
    bundle := self previewBundle: change model: model.
    targetPackage := (request at: 'target') at: 'packageName' ifAbsent: [class theNonMetaClass category asString].
    (((bundle at: 'entries') collect: [:entry | (entry at: 'entity') at: 'packageName']) asSet difference: (Set with: targetPackage))
        do: [:name | warnings add: 'Changes also affect package ', name, ' outside the selected target package.'].
    (#('renameMethod' 'addParameter' 'removeParameter' 'reorderParameters') includes: (request at: 'action')) ifTrue: [warnings add: 'Dynamic sends with computed selectors and external references cannot all be discovered. Review callers that use perform: or construct selector names.'].
    nextToken := nextToken + 1. token := generation, ':refactoring:', nextToken asString.
    previews at: token put: (Dictionary new at: 'change' put: change; at: 'revision' put: revision; yourself).
    ^ Dictionary new at: 'token' put: token; at: 'baseRevision' put: revision; at: 'changes' put: bundle;
        at: 'warnings' put: warnings asArray; at: 'consequences' put: (self consequencesFor: request); yourself!
consequencesFor: request
    | consequences action |
    consequences := OrderedCollection with: 'Apply changes every listed definition in the live image. Undo history lasts only for this session.'.
    action := request at: 'action'.
    (#('pullUpVariable' 'pushDownVariable') includes: action) ifTrue: [consequences add: 'Moving the variable removes its old storage. Existing instance or class-variable values can be discarded. Code Undo restores definitions, not discarded values.'].
    action = 'removeClass' ifTrue: [consequences add: 'Removing a class leaves existing instances obsolete. Code Undo recreates its definitions; it does not restore the former class identity or retained instances.'].
    action = 'moveMethod' ifTrue: [consequences add: 'The method moves through the selected receiver variable and leaves a delegating method on the original class.'].
    action = 'inlineMethod' ifTrue: [
        consequences add: 'Inlining replaces this selected self or super send; the called method remains defined.'.
        ((request at: 'options') at: 'inlineExpression') ifTrue: [consequences add: 'Allowing argument-expression substitution can repeat or defer their effects. Turn it off to retain temporary argument bindings.']].
    ^ consequences asArray!
retainedChange: change
    (change isKindOf: SEBookOrganizationChange) ifTrue: [^ change].
    (change class = RBRenameInstanceVariableChange) ifTrue: [
        ^ (SEBookRenameInstanceVariableChange rename: change oldName to: change newName in: change changeClass)
            changes: (change changes collect: [:member | self retainedChange: member]); yourself].
    (change isKindOf: RBCompositeRefactoryChange) ifTrue: [
        ^ change copy changes: (change changes collect: [:member | self retainedChange: member]); yourself].
    (change isKindOf: RBAddMethodChange) ifTrue: [
        ^ SEBookAddMethodChange new identityFrom: change;
            protocols: change protocols; sourceText: change source; sourceReader: sourceReader; yourself].
    (change isKindOf: RBRemoveMethodChange) ifTrue: [
        ^ SEBookRemoveMethodChange new identityFrom: change; selector: change selector;
            sourceReader: sourceReader; yourself].
    ((change isKindOf: RBRefactoryVariableChange) or: [(change isKindOf: RBRefactoryDefinitionChange) or: [change isKindOf: RBCommentChange]]) ifTrue: [^ change].
    (change isKindOf: RBRemoveClassChange) ifTrue: [
        ^ (SEBookRemoveClassChange removeClassName: change changeClassName) sourceReader: sourceReader; yourself].
    self fail: 'This native change kind has no verified source preview adapter.'!
previewBundle: change model: model
    | entries source |
    entries := OrderedCollection new.
    self previewEntries: change model: model into: entries.
    source := String streamContents: [:stream | self writeChange: change on: stream].
    ^ Dictionary new at: 'version' put: 1; at: 'source' put: source; at: 'entries' put: entries asArray; yourself!
previewEntries: change model: model into: entries
    | class modelClass target before after className isMethod |
    (change isKindOf: RBCompositeRefactoryChange) ifTrue: [
        ((change isKindOf: RBRenameClassChange) or: [change isKindOf: RBRenameVariableChange])
            ifTrue: [self structuralEntry: change model: model into: entries].
        change changes do: [:member | self previewEntries: member model: model into: entries]. ^ self].
    isMethod := (change isKindOf: RBAddMethodChange) or: [change isKindOf: RBRemoveMethodChange].
    isMethod ifFalse: [^ self structuralEntry: change model: model into: entries].
    className := change changeClassName. class := change changeClass.
    modelClass := model classNamed: className.
    modelClass ifNil: [modelClass := model classFor: class].
    target := Dictionary new at: 'kind' put: 'method'; at: 'className' put: className asString;
        at: 'side' put: (change isMeta ifTrue: ['class'] ifFalse: ['instance']);
        at: 'selector' put: change selector asString;
        at: 'packageName' put: modelClass theNonMetaClass category asString; yourself.
    before := (class notNil and: [class includesSelector: change selector])
        ifTrue: [sourceReader sourceFor: change selector in: class] ifFalse: [nil].
    after := (change isKindOf: RBAddMethodChange) ifTrue: [change source] ifFalse: [nil].
    entries add: (Dictionary new at: 'entity' put: target; at: 'before' put: before; at: 'after' put: after; yourself)!
structuralEntry: change model: model into: entries
    | class name modelClass target before after isMeta |
    class := change changeClass. isMeta := class notNil and: [class isMeta].
    name := (change isKindOf: RBRenameClassChange) ifTrue: [change oldName] ifFalse: [change changeClassName].
    modelClass := model classNamed: ((change isKindOf: RBRenameClassChange) ifTrue: [change newName] ifFalse: [name]) asSymbol.
    (modelClass notNil and: [isMeta]) ifTrue: [modelClass := modelClass theMetaClass].
    target := Dictionary new at: 'kind' put: 'class'; at: 'className' put: name asString;
        at: 'side' put: (isMeta ifTrue: ['class'] ifFalse: ['instance']); at: 'packageName' put: (class ifNil: [modelClass theNonMetaClass category] ifNotNil: [class theNonMetaClass category]) asString; yourself.
    (entries anySatisfy: [:entry | (entry at: 'entity') = target]) ifTrue: [^ self].
    before := class ifNil: [nil] ifNotNil: [class definition].
    after := modelClass ifNil: [nil] ifNotNil: [self class definitionForModelClass: modelClass].
    entries add: (Dictionary new at: 'entity' put: target; at: 'before' put: before; at: 'after' put: after; yourself)!
writeChange: change on: stream
    (change isKindOf: RBRenameClassChange) ifTrue: [
        stream nextChunkPut: change oldName asString, ' rename: ', change newName asSymbol storeString; cr.
        change changes do: [:member | self writeChange: (member renameChangesForClass: change oldName asSymbol to: change newName asSymbol) on: stream]. ^ self].
    (change isKindOf: RBRenameVariableChange) ifTrue: [
        stream nextChunkPut: '(', change class name, ' rename: ', change oldName storeString,
            ' to: ', change newName storeString, ' in: ', change displayClassName, ') addNewVariable; copyOldValuesToNewVariable'; cr.
        change changes do: [:member | self writeChange: member on: stream].
        stream nextChunkPut: '(', change class name, ' rename: ', change oldName storeString,
            ' to: ', change newName storeString, ' in: ', change displayClassName, ') removeOldVariable'; cr.
        (change isKindOf: SEBookRenameInstanceVariableChange) ifTrue: [stream nextChunkPut: change definitionAfterRename; cr].
        ^ self].
    (change isKindOf: RBCompositeRefactoryChange) ifTrue: [
        change changes do: [:member | self writeChange: member on: stream]. ^ self].
    (change isKindOf: RBAddMethodChange) ifTrue: [
        stream cr; nextPut: $!!; nextChunkPut: change displayClassName, ' methodsFor: ', change protocol asString storeString;
            cr; nextChunkPut: change source; nextChunkPut: ' '; cr. ^ self].
    (change isKindOf: RBRemoveMethodChange) ifTrue: [
        stream nextChunkPut: change displayClassName, ' removeSelector: ', change selector storeString; cr. ^ self].
    (change isKindOf: RBRefactoryDefinitionChange) ifTrue: [stream nextChunkPut: change definition; cr. ^ self].
    (change isKindOf: RBRefactoryVariableChange) ifTrue: [
        stream nextChunkPut: change displayClassName, ' ', change changeSymbol asString, ' ', change variable storeString; cr. ^ self].
    (change isKindOf: RBRemoveClassChange) ifTrue: [stream nextChunkPut: change displayClassName, ' removeFromSystem'; cr. ^ self].
    self fail: 'Unsupported native preview source change.'!
cancel: token
    previews removeKey: token ifAbsent: []. ^ nil!
apply: token revision: revision
    | record |
    record := previews at: token ifAbsent: [self fail: 'This preview was canceled or belongs to an earlier session.'].
    (record at: 'revision') = revision ifFalse: [self error: 'STALE_REVISION'].
    RBRefactoryChangeManager instance performChange: (self historyChange: (record at: 'change')).
    previews removeAll!
undo
    RBRefactoryChangeManager instance hasUndoableOperations ifFalse: [self fail: 'No refactoring is available to undo.'].
    RBRefactoryChangeManager instance undoOperation. previews removeAll!
redo
    RBRefactoryChangeManager instance hasRedoableOperations ifFalse: [self fail: 'No refactoring is available to redo.'].
    RBRefactoryChangeManager instance redoOperation. previews removeAll! !

!SEBookAddMethodChange methodsFor: 'initialization'!
sourceText: text
    source := text! !

RBRemoveClassChange subclass: #SEBookRemoveClassChange
    instanceVariableNames: 'sourceReader' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookRemoveClassChange methodsFor: 'retained inverse'!
sourceReader: reader
    sourceReader := reader!
asUndoOperation
    | changes |
    changes := RBCompositeRefactoryChange new.
    self changeClass withAllSubclasses do: [:class |
        changes defineClass: class definition.
        class class instVarNames do: [:name | changes addInstanceVariable: name to: class class].
        {class. class class} do: [:side | side selectors do: [:selector |
            changes addChange: ((SEBookAddMethodChange compile: (sourceReader sourceFor: selector in: side)
                in: side classified: (side organization categoryOfElement: selector)) sourceReader: sourceReader; yourself)].
            changes addChange: (SEBookOrganizationChange new changeClass: side; organization: side organization copy; yourself)].
        changes comment: (sourceReader commentFor: class) in: class].
    ^ changes! !

RBRefactoryChange subclass: #SEBookRetainedRefactoringChange
    instanceVariableNames: 'nativeChange owner' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookRetainedRefactoringChange methodsFor: 'native inverse adaptation'!
nativeChange: change owner: adapter
    nativeChange := change. owner := adapter!
executeNotifying: notifier
    ^ SEBookStructuralGuard during: [ | inverse |
        inverse := [nativeChange executeNotifying: notifier]
            on: InMidstOfFileinNotification do: [:notification | notification resume: true].
        owner historyChange: (owner retainedChange: inverse)
    ] layoutClasses: (owner layoutClassesFor: nativeChange)! !
!SEBookRefactorings methodsFor: 'native inverse adaptation'!
historyChange: change
    ^ SEBookRetainedRefactoringChange new nativeChange: change owner: self; yourself!
layoutClassesFor: change
    | classes |
    classes := IdentitySet new.
    self collectLayoutClassesFrom: change into: classes.
    ^ classes asArray!
collectLayoutClassesFrom: change into: classes
    "Pass own physical layouts; the guard expands subclasses and checks retained activations."
    | class superclassChanged |
    ((change isKindOf: RBRenameInstanceVariableChange) or: [
        (change isKindOf: RBAddInstanceVariableChange) or: [change isKindOf: RBRemoveInstanceVariableChange]]) ifTrue: [
        change changeClass ifNotNil: [:behavior | classes add: behavior]].
    (change isKindOf: RBAddClassChange) ifTrue: [
        class := change changeClass.
        class ifNotNil: [
            superclassChanged := change superclassName ~= (class superclass ifNotNil: [:parent | parent name]).
            (superclassChanged or: [change instanceVariableNames ~= class instVarNames]) ifTrue: [classes add: class].
            superclassChanged ifTrue: [classes add: class class]]].
    (change isKindOf: RBAddMetaclassChange) ifTrue: [
        change changeClass ifNotNil: [:behavior |
            change classInstanceVariableNames ~= behavior class instVarNames ifTrue: [classes add: behavior class]]].
    (change isKindOf: RBRemoveClassChange) ifTrue: [
        change changeClass ifNotNil: [:behavior | classes add: behavior; add: behavior class]].
    (change isKindOf: RBCompositeRefactoryChange) ifTrue: [
        change changes do: [:member | self collectLayoutClassesFrom: member into: classes]]! !

RBRenameInstanceVariableChange subclass: #SEBookRenameInstanceVariableChange
    instanceVariableNames: 'targetDefinition' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookRenameInstanceVariableChange methodsFor: 'native migration compatibility'!
targetDefinition: definition
    targetDefinition := definition!
executeNotifying: notifier
    | before desired inverse definitionChange |
    before := self changeClass definition.
    desired := self definitionAfterRename.
    inverse := super executeNotifying: notifier.
    "Stock rename appends storage. A native definition change restores declaration order by name."
    definitionChange := (self isMeta ifTrue: [RBAddMetaclassChange] ifFalse: [RBAddClassChange]) definition: desired.
    definitionChange executeNotifying: notifier.
    inverse targetDefinition: before.
    ^ inverse!
definitionAfterRename
    | modelClass |
    targetDefinition ifNotNil: [^ targetDefinition].
    modelClass := (RBNamespace onEnvironment: RBBrowserEnvironment new) classFor: self changeClass.
    modelClass renameInstanceVariable: oldName to: newName around: [].
    ^ SEBookRefactorings definitionForModelClass: modelClass!
copyOldValuesToNewVariable
    "After a checkpoint, SqueakJS can enumerate unreachable old-layout objects after reshape.
    Collect those stale objects before the stock native copy; retained aliases still migrate normally."
    Smalltalk garbageCollect.
    ^ super copyOldValuesToNewVariable! !

RBRefactoryClassChange subclass: #SEBookOrganizationChange
    instanceVariableNames: 'organization' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookOrganizationChange methodsFor: 'native inverse metadata'!
organization: value
    organization := value!
asUndoOperation
    ^ self class new changeClass: self changeClass; organization: self changeClass organization copy; yourself!
primitiveExecute
    self changeClass organization: organization copy!
changeString
    ^ 'Restore protocol organization for ', self displayClassName! !
