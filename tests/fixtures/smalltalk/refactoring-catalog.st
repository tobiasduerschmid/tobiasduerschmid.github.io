Object subclass: #SECatalogParent instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
SECatalogParent subclass: #SECatalogTarget instanceVariableNames: 'stored spare' classVariableNames: 'SharedValue' poolDictionaries: '' category: 'SEBook-Catalog'!
!SECatalogTarget methodsFor: 'catalog'!
catAnswer ^ 42!
catCollision ^ 99!
catStored ^ stored!
catStored: value stored := value!
catShared ^ SharedValue!
catShared: value SharedValue := value!
catLocal
    "😀 local stays in this comment; 'local' stays in the literal."
    | local |
    local := 40.
    ^ local + 2!
catArgument: value ^ value + 2!
catExtract ^ 40 + 2!
catInline ^ self catAnswer!
catTemporary | answer | answer := 40 + 2. ^ answer!
catBind | count | ^ (1 to: 2) collect: [:index | count := index + 40. count]!
catPair: first with: second ^ first * 10 + second!
catUnused: first with: unused ^ first + 2!
catUncalled ^ 42!
catPull ^ 42!
catMove: component ^ component catComponent + 2!
catLiteral ^ 'catAnswer stored SharedValue local'! !
SECatalogTarget subclass: #SECatalogChild instanceVariableNames: 'childOnly' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
Object subclass: #SECatalogCaller instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog-Outside'!
!SECatalogCaller methodsFor: 'catalog'!
catCall: target ^ target catAnswer!
catPairCall: target ^ target catPair: 4 with: 2!
catUnusedCall: target ^ target catUnused: 40 with: 9! !
Object subclass: #SECatalogComponent instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
!SECatalogComponent methodsFor: 'catalog'!
catComponent ^ 40! !
Object subclass: #SECatalogAbstract instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
!SECatalogAbstract methodsFor: 'catalog'!
catAbstract ^ self subclassResponsibility!
catPush ^ 42! !
SECatalogAbstract subclass: #SECatalogConcrete instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
!SECatalogConcrete methodsFor: 'catalog'!
catAbstract ^ 42! !
Object subclass: #SECatalogVarParent instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
SECatalogVarParent subclass: #SECatalogVarChild instanceVariableNames: 'number' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
!SECatalogVarChild methodsFor: 'catalog'!
catNumber ^ number!
catNumber: value number := value! !
Object subclass: #SECatalogPushParent instanceVariableNames: 'number' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
SECatalogPushParent subclass: #SECatalogPushChild instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
!SECatalogPushChild methodsFor: 'catalog'!
catNumber ^ number!
catNumber: value number := value! !
Object subclass: #SECatalogRemovable instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
!SECatalogRemovable methodsFor: 'retained'!
catRemovedSource ^ 'original !! 😀'! !
!SECatalogTarget methodsFor: 'catalog partitions'!
catScopes ^ {[:local | local + 1] value: 40. [:local | local + 2] value: 40}!
catMovePrimitive: component
    <primitive: 1>
    ^ component!
catMoveSuper: component ^ super yourself!
catEffects: log
    | first second |
    first := log add: 4. second := log add: 2.
    ^ self catPair: first with: second! !
!SECatalogCaller methodsFor: 'catalog partitions'!
catClass ^ SECatalogTarget! !
Object subclass: #SECatalogClassVarParent instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
SECatalogClassVarParent subclass: #SECatalogClassVarChild instanceVariableNames: '' classVariableNames: 'ClassNumber' poolDictionaries: '' category: 'SEBook-Catalog'!
!SECatalogClassVarChild methodsFor: 'catalog'!
catNumber ^ ClassNumber!
catNumber: value ClassNumber := value! !
Object subclass: #SECatalogClassPushParent instanceVariableNames: '' classVariableNames: 'ClassNumber' poolDictionaries: '' category: 'SEBook-Catalog'!
SECatalogClassPushParent subclass: #SECatalogClassPushChild instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
!SECatalogClassPushChild methodsFor: 'catalog'!
catNumber ^ ClassNumber!
catNumber: value ClassNumber := value! !

!SECatalogTarget methodsFor: 'catalog boundaries'!
catLiteralTemporary | answer | answer := 21. ^ answer + answer! !
!SECatalogRemovable class methodsFor: 'retained class source'!
catRemovedClassSource
    "Preserve this exact class-side formatting."
    ^ 42! !

Object subclass: #SECatalogClassStorage instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
SECatalogClassStorage class instanceVariableNames: 'classStored classSpare'!
SECatalogClassStorage subclass: #SECatalogClassStorageChild instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Catalog'!
!SECatalogClassStorage class methodsFor: 'catalog boundaries'!
catMetaStored ^ classStored!
catMetaStored: value classStored := value! !
!SECatalogTarget methodsFor: 'catalog boundaries'!
catDouble: number ^ number + number!
catInlineWith: log ^ self catDouble: (log add: 21)! !
