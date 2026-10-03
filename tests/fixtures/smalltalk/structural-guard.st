Object subclass: #SEBookGuardA instanceVariableNames: 'original' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Guard-Tests'!
!SEBookGuardA methodsFor: 'testing'!
answer ^ 42!
retained ^ [original]!
retainedContext ^ thisContext!
waitOn: gate gate wait. ^ original! !
Object subclass: #SEBookGuardB instanceVariableNames: 'original' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Guard-Tests'!
Object subclass: #SEBookGuardHookTarget instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Guard-Tests'!
!SEBookGuardHookTarget class methodsFor: 'testing'!
compile: source classified: protocol notifying: requestor
    Smalltalk at: #SEBookGuardPartialSeen put: (SEBookGuardA instVarNames includes: 'part').
    ^ super compile: source classified: protocol notifying: requestor! !
Object subclass: #SEBookGuardListener instanceVariableNames: 'seen' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Guard-Tests'!
!SEBookGuardListener methodsFor: 'testing'!
initialize seen := OrderedCollection new!
changed: event
    seen add: {SEBookGuardA instVarNames includes: 'part'. SEBookGuardB instVarNames includes: 'part'. SEBookStructuralGuard active}!
seen ^ seen! !
Delay subclass: #SEBookGuardDelay instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Guard-Tests'!
!SEBookGuardDelay methodsFor: 'testing'!
signalWaitingProcess
    (SEBookGuardA instVarNames includes: 'part') ifTrue: [
        Smalltalk at: #SEBookGuardTimerSeen put: {true. SEBookGuardB instVarNames includes: 'part'. SEBookStructuralGuard active}].
    ^ super signalWaitingProcess! !
Object subclass: #SEBookGuardFixture instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Guard-Tests'!
!SEBookGuardFixture class methodsFor: 'testing'!
replace: token failing: fail
    | owner record composite |
    owner := SEBookRefactorings allInstances detect: [:each | (each instVarNamed: 'previews') includesKey: token].
    record := (owner instVarNamed: 'previews') at: token.
    composite := RBCompositeRefactoryChange new.
    composite addChange: (RBAddInstanceVariableChange add: 'part' to: SEBookGuardA).
    composite addChange: (fail
        ifTrue: [RBRefactoryChange new]
        ifFalse: [RBAddInstanceVariableChange add: 'part' to: SEBookGuardB]).
    record at: 'change' put: composite!
replaceWithCompileHook: token
    | owner record composite |
    owner := SEBookRefactorings allInstances detect: [:each | (each instVarNamed: 'previews') includesKey: token].
    record := (owner instVarNamed: 'previews') at: token.
    composite := RBCompositeRefactoryChange new.
    composite addChange: (RBAddInstanceVariableChange add: 'part' to: SEBookGuardA).
    composite addChange: (RBAddMethodChange compile: 'answer ^ 12' in: SEBookGuardHookTarget classified: 'testing').
    record at: 'change' put: composite!
replaceWithSlowNative: token
    | owner record composite source |
    owner := SEBookRefactorings allInstances detect: [:each | (each instVarNamed: 'previews') includesKey: token].
    record := (owner instVarNamed: 'previews') at: token.
    composite := RBCompositeRefactoryChange new.
    composite addChange: (RBAddInstanceVariableChange add: 'part' to: SEBookGuardA).
    source := String streamContents: [:stream |
        stream nextPutAll: 'slow '. 500 timesRepeat: [stream nextPutAll: '1 + 1. ']. stream nextPutAll: '^ 42'].
    4000 timesRepeat: [composite addChange: (RBAddMethodChange compile: source in: SEBookGuardB classified: 'testing')].
    record at: 'change' put: composite! !
