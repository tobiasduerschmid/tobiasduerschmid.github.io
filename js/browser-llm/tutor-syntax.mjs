// Small, renderer-tested examples. Send only the relevant card, not the
// ArchUML manual or every diagram grammar on every chat turn.
const CARDS = {
  class:'class Item {\n  +name: str\n  +label(): str\n}\nclass Catalog\nCatalog --> Item : contains',
  sequence:'participant a: Client\nparticipant b: Service\na -> b: request\nb --> a: reply',
  state:'[*] --> Ready\nReady --> Done : finish\nDone --> [*]',
  activity:'(*) --> "Check input"\nif "Valid?" then\n  --> [yes] "Accept"\nelse\n  --> [no] "Reject"\nendif\n"Accept" --> (*)\n"Reject" --> (*)',
  component:'component Client\ncomponent Service\nClient --> Service : request',
  deployment:'node Client\nnode Server\nClient --> Server : request',
  usecase:'actor Student\nusecase "Ask question" as Ask\nStudent --> Ask'
};

function requestedType(text) {
  if (/\b(use.?case|user goals?)\b/i.test(text)) return 'usecase';
  if (/\b(deployment|infrastructure|hosting)\b/i.test(text)) return 'deployment';
  if (/\b(sequence|interactions?|messages?|calls?)\b/i.test(text)) return 'sequence';
  if (/\b(states?|transitions?|lifecycle)\b/i.test(text)) return 'state';
  if (/\b(activity|flowcharts?|workflow|algorithm|loops?)\b/i.test(text)) return 'activity';
  if (/\b(class(?:es)?|inheritance|interfaces?)\b/i.test(text)) return 'class';
  if (/\b(architecture|components?|services?)\b/i.test(text)) return 'component';
  return null;
}

export function tutorDiagramGuidance({files=[],instructions=''},question,history=[]) {
  const previous = history.filter(message=>message.role==='user').at(-1)?.content || '';
  const type = requestedType(question) || requestedType(previous) || requestedType(instructions) ||
    (files.some(file=>/^\s*class\s+\w+/m.test(file.content)) ? 'class' : 'activity');
  return 'For modeling, visualization or architecture, default to ArchUML with a one-sentence takeaway. Use '+type+
    '. Syntax example only: use actual names and behavior from the source, never invent classes for standalone functions. One diagram, at most 5 nodes; no HTML, URLs or layout directives.\n'+
    '```uml-'+type+'\n@startuml\n'+CARDS[type]+'\n@enduml\n```';
}
