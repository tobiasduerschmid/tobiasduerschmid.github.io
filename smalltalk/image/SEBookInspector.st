Object subclass: #SEBookInspector
    instanceVariableNames: 'handles serial generation pageLimit previewLimit'
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookInspector methodsFor: 'initialization'!
initialize
    super initialize.
    handles := Dictionary new. serial := 0. pageLimit := 100. previewLimit := 256!
configure: options generation: identity
    generation := identity. handles := Dictionary new. serial := 0.
    pageLimit := options at: 'pageSize'.
    previewLimit := options at: 'previewCharacters'! !
!SEBookInspector methodsFor: 'values'!
summary: object
    | result text handle class |
    class := object class.
    text := 'a ', class name.
    object == nil ifTrue: [text := 'nil'].
    object == true ifTrue: [text := 'true'].
    object == false ifTrue: [text := 'false'].
    ({SmallInteger. LargePositiveInteger. LargeNegativeInteger. Float. Fraction. Character} includes: class)
        ifTrue: [text := object printString].
    ({ByteString. WideString. ByteSymbol. WideSymbol} includes: class)
        ifTrue: [text := object copyFrom: 1 to: (object size min: previewLimit)].
    text size > previewLimit ifTrue: [text := text copyFrom: 1 to: previewLimit].
    result := Dictionary new at: 'className' put: class name; at: 'text' put: text; yourself.
    (object == true or: [object == false]) ifTrue: [result at: 'booleanValue' put: object].
    serial := serial + 1. handle := generation, ':', serial asString.
    handles at: handle put: object. result at: 'handle' put: handle.
    ^ result!
inspect: payload
    | object names total offset limit slots end |
    object := handles at: (payload at: 'handle') ifAbsent: [self error: 'STALE_HANDLE'].
    names := object class allInstVarNames.
    total := names size + object basicSize.
    offset := payload at: 'offset'. limit := (payload at: 'limit') min: pageLimit.
    end := offset + limit min: total.
    slots := OrderedCollection new.
    offset + 1 to: end do: [:index |
        slots add: (Dictionary new
            at: 'name' put: (index <= names size ifTrue: [names at: index] ifFalse: [(index - names size) asString]);
            at: 'value' put: (self summary: (index <= names size
                ifTrue: [object instVarAt: index] ifFalse: [object basicAt: index - names size])); yourself)].
    ^ Dictionary new at: 'className' put: object class name; at: 'slots' put: slots asArray;
        at: 'nextOffset' put: (end < total ifTrue: [end] ifFalse: [nil]); yourself!
release: payload
    | released |
    released := 0.
    (payload at: 'handles') do: [:handle |
        (handles includesKey: handle) ifTrue: [handles removeKey: handle. released := released + 1]].
    ^ Dictionary new at: 'released' put: released; yourself! !
