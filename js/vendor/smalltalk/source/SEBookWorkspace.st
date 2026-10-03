Object subclass: #SEBookWorkspace
    instanceVariableNames: 'bindings source diagnostic'
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookWorkspace methodsFor: 'initialization'!
initialize
    super initialize.
    bindings := Dictionary new! !
!SEBookWorkspace methodsFor: 'compiler requestor'!
bindingOf: name
    name first isUppercase ifTrue: [^ nil].
    ^ bindings associationAt: name ifAbsent: [bindings at: name put: nil. bindings associationAt: name]!
notify: message at: position in: ignored
    ^ self notify: message at: position!
notify: message at: position
    diagnostic := Dictionary new
        at: 'code' put: 'COMPILE_ERROR'; at: 'message' put: message;
        at: 'location' put: (Dictionary new
            at: 'start' put: (self utf16Offset: position - 1);
            at: 'end' put: (self utf16Offset: position);
            yourself); yourself.
    self error: 'COMPILE_ERROR'!
utf16Offset: count
    | total |
    total := 0.
    1 to: ((count max: 0) min: source size) do: [:index |
        total := total + ((source at: index) asInteger > 65535 ifTrue: [2] ifFalse: [1])].
    ^ total!
text
    ^ source asText!
wantsInteractiveErrorCorrection
    ^ false!
selectionInterval
    ^ 1 to: 0! !
!SEBookWorkspace methodsFor: 'evaluation'!
evaluate: text
    source := text. diagnostic := nil.
    ^ Compiler new evaluate: text in: nil to: nil notifying: self ifFail: [self error: 'COMPILE_ERROR'] logged: false!
diagnostic
    ^ diagnostic! !

Object subclass: #SEBookTranscript
    instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookTranscript methodsFor: 'stream'!
nextPutAll: text
    self emit: text asString utf8Encoded.
    ^ text!
nextPut: character
    self nextPutAll: (String with: character).
    ^ character!
show: object
    self nextPutAll: object asString!
showln: object
    self show: object; cr!
cr
    self nextPut: Character lf!
lf
    self cr!
space
    self nextPut: Character space!
flush
    ^ self!
endEntry
    ^ self!
clear
    ^ self!
emit: bytes
    <primitive: 'primitiveOutput' module: 'SEBookPlugin'>
    ^ self! !

Error subclass: #SEBookRuntimeError
    instanceVariableNames: 'details' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookRuntimeError methodsFor: 'accessing'!
details: value
    details := value!
runtimeDetails
    ^ details! !
!SEBookRuntimeError class methodsFor: 'signaling'!
signalDetails: value
    ^ self new details: value; signal: (value at: 'message')! !

ReadStream subclass: #SEBookSourceStream
    instanceVariableNames: 'path chunkStart'
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookSourceStream methodsFor: 'source positions'!
path: name
    path := name!
name
    ^ path!
nextChunk
    self skipSeparators.
    chunkStart := self position.
    ^ super nextChunk!
syntaxDetails: error
    | prefix rawOffset start end |
    prefix := error errorCode asString copyFrom: 1 to: (error location - 1 max: 0).
    rawOffset := chunkStart + (prefix copyReplaceAll: '!!' with: '!!!!') size.
    start := self utf16Offset: rawOffset.
    end := self utf16Offset: rawOffset + 1.
    ^ Dictionary new at: 'code' put: 'COMPILE_ERROR'; at: 'message' put: error errorMessage;
        at: 'location' put: (Dictionary new at: 'path' put: path; at: 'start' put: start; at: 'end' put: end; yourself); yourself!
utf16Offset: count
    | total |
    total := 0.
    1 to: ((count max: 0) min: collection size) do: [:index |
        total := total + ((collection at: index) asInteger > 65535 ifTrue: [2] ifFalse: [1])].
    ^ total! !

WebUtils subclass: #SEBookJSON
    instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookJSON class methodsFor: 'json decoding'!
jsonMapFrom: stream
    "Pinned WebUtils leaves the closing brace unread for an empty object."
    | map key delimiter |
    map := Dictionary new.
    stream next = ${ ifFalse: [self error: 'JSON object expected'].
    stream skipSeparators.
    stream peek = $} ifTrue: [stream next. ^ map].
    [
        stream skipSeparators. key := self jsonStringFrom: stream.
        stream skipSeparators. stream next = $: ifFalse: [self error: 'JSON key-value pair expected'].
        map at: key put: (self jsonDecode: stream).
        stream skipSeparators. delimiter := stream next.
        delimiter = $}
    ] whileFalse: [delimiter = $, ifFalse: [self error: 'JSON comma expected']].
    ^ map! !

!SEBookJSON class methodsFor: 'json encoding'!
jsonChar: character on: stream
    "WebUtils emits only four hexadecimal digits, truncating supplementary Unicode.
    JSON permits these characters literally; the transport encodes the result as UTF-8."
    character asInteger > 65535 ifTrue: [^ stream nextPut: character].
    ^ super jsonChar: character on: stream! !

!SEBookWorkspace methodsFor: 'accepting source'!
acceptMethod: text in: class protocol: protocol
    | selector |
    source := text. diagnostic := nil.
    [selector := class compile: source classified: protocol notifying: self] on: Error do: [:error |
        diagnostic ifNotNil: [SEBookRuntimeError signalDetails: diagnostic]. error pass].
    selector ifNil: [self error: 'COMPILE_ERROR'].
    ^ selector! !
