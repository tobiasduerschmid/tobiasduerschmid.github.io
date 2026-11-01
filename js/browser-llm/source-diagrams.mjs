import {wantsTutorDiagram} from './prompts.mjs';

// A code-reading diagram may restate one call the learner identified. It cannot
// smuggle a solved algorithm into labels or introduce unverified relationships.
export function sourceDrawingRequest(context,request,question,history=[]) {
  if(!wantsTutorDiagram(question) || request.type!=='sequence') {
    throw new Error('This tutor can draw one sequence diagram of a call you identified. Name the caller and callee in your request.');
  }
  const files=Object.values(context.sourceModel?.files || {});
  const functions=files.flatMap(file=>file.functions).filter(fn=>!fn.className);
  const learnerText=[...history.filter(turn=>turn.role==='user').map(turn=>turn.content),question].join('\n');
  const mentions=[...learnerText.matchAll(/\b([A-Za-z_]\w*)\s*(?:\([^\n)]*\))?\s*(?:calling\b|calls?\b|->|→)\s*([A-Za-z_]\w*)\b/g)];
  const focusNames=new Set(request.focus.match(/[A-Za-z_]\w*/g) || []);
  const pairs=new Map();
  for(const [,caller,callee] of mentions) {
    if(!focusNames.has(caller) || !focusNames.has(callee))continue;
    const senders=functions.filter(fn=>fn.name===caller),receivers=functions.filter(fn=>fn.name===callee);
    if(senders.length!==1 || receivers.length!==1 || senders[0].filename!==receivers[0].filename)continue;
    const fn=senders[0];
    const calls=context.sourceModel.files[fn.filename].calls;
    if(calls.some(call=>call.scope===caller && !call.className && !call.receiver && call.name===callee &&
        call.range.startLine>=fn.startLine && call.range.endLine<=fn.endLine))pairs.set(caller+'->'+callee,{caller,callee});
  }
  if(pairs.size!==1)throw new Error('Identify one source call first, for example “caller calls callee”, then request its diagram. The tutor could not verify one relationship from your message.');
  return [...pairs.values()][0];
}

export function sourceDrawingGuidance({caller,callee}) {
  return 'Draw only the verified call from '+caller+' to '+callee+'. Use exactly two participant declarations, with these function names as their labels, and one forward arrow labeled calls. '+
    'No returns, conditions, notes, extra participants, or other labels. Keep @startuml and @enduml.';
}

export function validSourceDrawing(source,{caller,callee}) {
  const lines=source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(lines.length!==5 || lines[0]!=='@startuml' || lines[4]!=='@enduml')return false;
  const names=new Map();
  for(const line of lines.slice(1,3)) {
    const match=line.match(/^participant ([A-Za-z_]\w*)(?::\s*([A-Za-z_]\w*))?$/);
    const label=match && (match[2] || match[1]);
    if(!match || names.has(match[1]) || ![caller,callee].includes(label))return false;
    names.set(match[1],label);
  }
  const call=lines[3].match(/^([A-Za-z_]\w*)\s*->\s*([A-Za-z_]\w*)(?::[^\r\n]*)?$/);
  return !!call && names.get(call[1])===caller && names.get(call[2])===callee;
}

export function canonicalSourceDrawing(source,relationship) {
  if(!validSourceDrawing(source,relationship))return null;
  // Aliases and arrow labels are untrusted, including in source/history. The
  // verified graph is rendered with fixed aliases and the authored label calls.
  return '@startuml\nparticipant a: '+relationship.caller+'\nparticipant b: '+relationship.callee+'\na -> b: calls\n@enduml';
}
