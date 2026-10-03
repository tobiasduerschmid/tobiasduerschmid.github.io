Object subclass: #SEBookSemanticsParent
    instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Semantics'!
!SEBookSemanticsParent methodsFor: 'examples'!
answer
    ^ 40!
nonlocalReturn
    [^ 7] value.
    ^ 99! !
SEBookSemanticsParent subclass: #SEBookSemanticsChild
    instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Semantics'!
!SEBookSemanticsChild methodsFor: 'examples'!
answer
    ^ super answer + 2!
greeting
    "A comment with escaped !! and Unicode café 😀."
    ^ 'café 😀!!'! !
!SEBookSemanticsChild class methodsFor: 'examples'!
answer
    ^ 17! !
Object subclass: #SEBookUnprintable
    instanceVariableNames: 'link' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Semantics'!
!SEBookUnprintable methodsFor: 'examples'!
initialize
    link := self!
printString
    [true] whileTrue: []! !
