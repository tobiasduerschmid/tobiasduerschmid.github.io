Object subclass: #SEBookReplayParent
    instanceVariableNames: 'inherited'
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Replay-Tests'!
Object subclass: #SEBookReplayAlternate
    instanceVariableNames: ''
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Replay-Tests'!
SEBookReplayParent subclass: #SEBookReplayTarget
    instanceVariableNames: 'saved'
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Replay-Tests'!
Object subclass: #SEBookReplayDonor
    instanceVariableNames: ''
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Replay-Tests'!
Object subclass: #SEBookReplayGone
    instanceVariableNames: ''
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Replay-Tests'!
!SEBookReplayParent methodsFor: 'accessing'!
inherited: value
    inherited := value!
inherited
    ^ inherited! !
!SEBookReplayTarget methodsFor: 'accessing'!
saved: value
    saved := value!
saved
    ^ saved!
value
    ^ 1!
obsolete
    ^ 0! !
!SEBookReplayTarget class methodsFor: 'accessing'!
answer
    ^ 10!
obsolete
    ^ 0! !
!SEBookReplayDonor methodsFor: 'accessing'!
value
    ^ 99! !
