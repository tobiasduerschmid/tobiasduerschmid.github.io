// Grammar fragments belong only to the drawing stage. Complete examples were
// copied verbatim by the small model, even when unrelated to the learner's code.
const SYNTAX = {
  class:'First check for actual class declarations. Standalone functions, constants and tuples are not classes; do not convert them into invented classes. If no classes are declared, explain this with NO_DIAGRAM: reason and suggest a sequence or activity view. Otherwise declare class Name { ... }. Members use +name: Type or +method(): Type. Relationships use Name --> Other : label.',
  sequence:'Declare participants with participant id: SourceName. Aliases are short bare identifiers, without quotes, paths or parentheses. Use function names as SourceName for procedural code. Calls use id -> other: label and replies use other --> id: label. A found message from outside the diagram uses o-> id: label; no invented caller is needed. For branches use alt condition, calls, else other condition, calls, end. Represent repetition with loop condition, calls, end rather than expanding each iteration.',
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
    'Aim for a readable view of about 5 nodes; an overview may use more. No HTML, URLs or layout directives. Use actual source identifiers and source-derived relationships, not the placeholder words in this grammar.\n'+SYNTAX[type];
}
