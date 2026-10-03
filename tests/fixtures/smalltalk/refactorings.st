Object subclass: #SEBookRenameTarget instanceVariableNames: 'saved' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Refactor-Target'!
!SEBookRenameTarget methodsFor: 'accessing'!
oldSelector ^ 41!
saved ^ saved!
saved: anObject saved := anObject!
collision ^ 99!
localValue
    "Retain 😀 exact positions and !! punctuation."
    | local |
    local := 42.
    ^ local! !
SEBookRenameTarget subclass: #SEBookRenameChild instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Refactor-Target'!
!SEBookRenameChild methodsFor: 'accessing'!
oldSelector ^ super oldSelector + 1! !
Object subclass: #SEBookRenameCaller instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Refactor-Outside'!
!SEBookRenameCaller methodsFor: 'calling'!
call: target ^ target oldSelector!
dynamic: target selector: name ^ target perform: name! !
RBRefactoryChange subclass: #SEBookFailureChange instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Refactor-Tests'!
!SEBookFailureChange methodsFor: 'execution'!
executeNotifying: aBlock
    SEBookRenameTarget allInstancesDo: [:each | each saved at: 1 put: 99].
    FileStream forceNewFileNamed: '/refactoring.txt' do: [:stream | stream nextPutAll: 'changed'].
    self error: 'Controlled composite failure after structural change'! !
!SEBookFailureChange class methodsFor: 'fixture'!
injectInto: token
    | owner record composite |
    owner := SEBookRefactorings allInstances detect: [:each | (each instVarNamed: 'previews') includesKey: token].
    record := (owner instVarNamed: 'previews') at: token.
    composite := RBCompositeRefactoryChange new.
    composite addChange: (RBAddInstanceVariableChange add: 'addedByFailedRefactoring' to: SEBookRenameTarget).
    composite addChange: self new.
    record at: 'change' put: composite! !
RBRefactoryChange subclass: #SEBookUnadaptableInverseChange instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Refactor-Tests'!
!SEBookUnadaptableInverseChange methodsFor: 'execution'!
executeNotifying: notifier
    SEBookRenameTarget compile: 'oldSelector ^ 99' classified: 'changed'.
    ^ Object new! !
!SEBookUnadaptableInverseChange class methodsFor: 'fixture'!
injectInto: token
    | owner record |
    owner := SEBookRefactorings allInstances detect: [:each | (each instVarNamed: 'previews') includesKey: token].
    record := (owner instVarNamed: 'previews') at: token.
    record at: 'change' put: self new! !

RBRefactoryChange subclass: #SEBookPostExecutionFailureChange instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Refactor-Tests'!
!SEBookPostExecutionFailureChange methodsFor: 'execution'!
executeNotifying: notifier
    self error: 'Controlled failure after native rename'! !
!SEBookPostExecutionFailureChange class methodsFor: 'fixture'!
injectAfter: token
    | owner record composite |
    owner := SEBookRefactorings allInstances detect: [:each | (each instVarNamed: 'previews') includesKey: token].
    record := (owner instVarNamed: 'previews') at: token.
    composite := RBCompositeRefactoryChange new.
    composite addChange: (record at: 'change'); addChange: self new.
    record at: 'change' put: composite! !
