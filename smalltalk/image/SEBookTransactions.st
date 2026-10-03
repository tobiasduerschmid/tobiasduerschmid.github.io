Object subclass: #SEBookTransactions
    instanceVariableNames: 'service records pending'
    classVariableNames: '' poolDictionaries: '' category: 'SEBook-Runtime'!
!SEBookTransactions methodsFor: 'lifecycle'!
service: aService
    service := aService. records := Dictionary new!
prepare: payload revision: revision
    | identity record |
    identity := payload at: 'id'.
    record := records at: identity ifAbsent: [nil].
    record ifNotNil: [
        ((record at: 'digest') = (payload at: 'digest') and: [(record at: 'payload') = payload]) ifFalse: [self error: 'PRECONDITION_FAILED'].
        ^ self status: payload].
    pending ifNotNil: [self error: 'PRECONDITION_FAILED'].
    record := Dictionary new at: 'id' put: identity; at: 'digest' put: (payload at: 'digest');
        at: 'baseRevision' put: revision; at: 'state' put: 'prepared'; at: 'payload' put: payload; yourself.
    records at: identity put: record. pending := identity.
    ^ self status: payload!
commit: payload
    | record result |
    record := self record: payload.
    (payload at: 'acknowledge' ifAbsent: [false]) ifTrue: [
        (#('committed' 'acknowledged') includes: (record at: 'state')) ifFalse: [self error: 'PRECONDITION_FAILED'].
        record at: 'state' put: 'acknowledged'. pending := nil.
        ^ self status: payload].
    (#('committed' 'acknowledged') includes: (record at: 'state')) ifTrue: [^ self status: payload].
(record at: 'state') = 'staged' ifTrue: [
        (payload includesKey: 'baseline') ifFalse: [^ self status: payload].
        result := service finalizeFileMutation: (record at: 'payload') baseline: (payload at: 'baseline').
        record at: 'result' put: result; at: 'state' put: 'committed'.
        ^ self status: payload].
    (record at: 'state') = 'prepared' ifFalse: [self error: 'PRECONDITION_FAILED'].
    record at: 'state' put: 'applying'.
    result := service applyMutation: (record at: 'payload').
    record at: 'result' put: result; at: 'state' put: (((record at: 'payload') at: 'action') = 'acceptFile' ifTrue: ['staged'] ifFalse: ['committed']).
    ^ self status: payload!
record: payload
    | record |
    record := records at: (payload at: 'id') ifAbsent: [self error: 'PRECONDITION_FAILED'].
    (record at: 'digest') = (payload at: 'digest') ifFalse: [self error: 'PRECONDITION_FAILED'].
    ^ record!
status: payload
    | record result |
    record := self record: payload.
    result := Dictionary new at: 'id' put: (record at: 'id'); at: 'state' put: (record at: 'state'); yourself.
    record at: 'result' ifPresent: [:value | result at: 'result' put: value].
    ^ result!
abort: payload
    | record |
    record := self record: payload.
    (record at: 'state') = 'prepared' ifFalse: [self error: 'PRECONDITION_FAILED'].
    record at: 'state' put: 'aborted'. pending := nil.
    ^ self status: payload!
isPending
    ^ pending notNil! !

!SEBookTransactions methodsFor: 'structural exclusion identity'!
structuralMutationIdentity
    pending ifNil: [self error: 'PRECONDITION_FAILED'].
    ((records at: pending) at: 'state') = 'applying' ifFalse: [self error: 'PRECONDITION_FAILED'].
    ^ pending! !
