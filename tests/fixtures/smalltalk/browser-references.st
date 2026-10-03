Object subclass: #SEBookReferenceBase instanceVariableNames: 'slot' classVariableNames: 'Shared' poolDictionaries: '' category: 'SEBook-Reference-Tests'!
SEBookReferenceBase class instanceVariableNames: 'classSlot'!
SEBookReferenceBase subclass: #SEBookReferenceChild instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Reference-Tests'!
Object subclass: #SEBookReferenceOther instanceVariableNames: 'slot' classVariableNames: 'Shared' poolDictionaries: '' category: 'SEBook-Reference-Tests'!
SEBookReferenceOther class instanceVariableNames: 'classSlot'!
!SEBookReferenceBase class methodsFor: 'accessing'!
baseClassSlot ^ classSlot! !
!SEBookReferenceBase methodsFor: 'accessing'!
baseSlot ^ slot!
baseShared ^ Shared! !
!SEBookReferenceChild methodsFor: 'accessing'!
childSlot: value slot := value!
childShared ^ Shared!
readBase ^ self baseSlot!
localOnly | slot | slot := 42. ^ slot! !
!SEBookReferenceChild class methodsFor: 'accessing'!
classShared ^ Shared!
childClassSlot ^ classSlot! !
!SEBookReferenceOther methodsFor: 'accessing'!
otherSlot ^ slot!
otherShared ^ Shared! !
SEBookReferenceChild comment: 'A child for native Browser navigation.'!

!SEBookReferenceOther class methodsFor: 'accessing'!
otherClassSlot ^ classSlot! !
