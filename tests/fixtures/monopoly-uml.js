module.exports = {
  class: `@startuml
class Player { +takeTurn(); +setState(state: PlayerState); }
interface PlayerState { +takeTurn(player: Player): void; }
class NormalState { +takeTurn(player: Player): void; }
class JailState { +takeTurn(player: Player): void; }
class BankruptState { +takeTurn(player: Player): void; }
Player o-- "1" PlayerState : currentState
NormalState ..|> PlayerState
JailState ..|> PlayerState
BankruptState ..|> PlayerState
@enduml`,
  state: `@startuml
state NormalState
state JailState
state BankruptState
NormalState --> JailState : third double
JailState --> NormalState : fee paid
NormalState --> BankruptState : cannot pay debt
@enduml`,
  sequence: `@startuml
participant player: Player
participant normal: NormalState
participant jail: JailState
player -> normal: takeTurn(player)
normal -> player: setState(jail)
player -> jail: takeTurn(player)
@enduml`
};
