// Grammar fragments belong only to the drawing stage. Complete examples were
// copied verbatim by the small model, even when unrelated to the learner's code.
const SYNTAX = {
  class:'Declare actual classes with class Name { ... }. Members use +name: Type or +method(): Type. Relationships use Name --> Other : label. Do not invent classes for standalone functions.',
  sequence:'Declare real callers and callees with participant id: SourceName. Calls use id -> other: label and replies use other --> id: label. Use function names as SourceName for procedural code.',
  state:'Declare each state as state Name. Transitions use Name --> Other : label. Initial/final states use [*].',
  activity:'Use (*) for start/end and quoted action names: (*) --> "Action". Connect quoted actions with -->. Branches use if "condition" then, --> [yes] "Action", else, --> [no] "Other action", endif. Do not use start/stop keywords.',
  component:'Declare component Name. Relationships use Name --> Other : label.',
  deployment:'Declare node Name. Relationships use Name --> Other : label.',
  usecase:'Declare actor Name and usecase "Goal" as id. Relationships use Name --> id.'
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
  return 'Use '+type+'. Return a fenced uml-'+type+' block with @startuml and @enduml on their own lines. '+
    'One diagram, at most 5 nodes; no HTML, URLs or layout directives. Use actual source identifiers and learner-established relationships, not the placeholder words in this grammar.\n'+SYNTAX[type];
}
