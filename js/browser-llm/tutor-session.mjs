import {tutorMessages,tutorMaterial} from './prompts.mjs';
import {tutorDiagramGuidance} from './tutor-syntax.mjs';
import {tutorReplyParts} from './tutor-diagrams.mjs';
import {sourceCoachReply} from './source-coach.mjs';
import {sourceDrawingRequest,sourceDrawingGuidance,canonicalSourceDrawing} from './source-diagrams.mjs';

const DIAGRAM_TYPES=new Set(['class','sequence','state','activity','component','deployment','usecase']);
const TOOL_BLOCK=/^[ \t]*```(?:tutor-tool|json)[ \t]*\r?\n([\s\S]*?)(?:^[ \t]*```[ \t]*\r?$|(?![\s\S]))/gm;

// The only tool is a bounded request for another text generation, never code execution.
export function parseTutorTurn(reply) {
  const blocks=[...reply.matchAll(TOOL_BLOCK)];
  const text=reply.replace(TOOL_BLOCK,'').trim();
  let diagram=null;
  if(blocks.length===1 && /\n[ \t]*```[ \t]*$/.test(blocks[0][0])) {
    try {
      const request=JSON.parse(blocks[0][1]);
      if(request && Object.keys(request).sort().join(',')==='focus,tool,type' && request.tool==='draw_diagram' &&
          DIAGRAM_TYPES.has(request.type) && typeof request.focus==='string' && request.focus.trim() && request.focus.length<=240) {
        diagram={type:request.type,focus:request.focus.trim()};
      }
    }catch { /* Malformed model output is not a tool call. */ }
  }
  return {text,diagram,notice:blocks.length && !diagram ? 'The tutor could not prepare a diagram request. You can continue with the question.' : ''};
}

export function diagramMessages(context,request,question,history,coaching) {
  return [
    {role:'system',content:'Draw one small ArchUML diagram for a code-reading question. Return only the complete fenced diagram. '+
      'Depict only relationships the learner has already identified or a small unsolved scaffold. '+
      'Leave the decision being learned open. Never supply a specification, solved trace, full algorithm, code, or hidden tests. '+
      'Use actual source names. Do not copy the syntax example or invent facts. If a useful diagram would reveal the answer, return NO_DIAGRAM.\n'+
      tutorDiagramGuidance(context,request.type+' diagram')+
      (request.relationship ? '\n'+sourceDrawingGuidance(request.relationship) : '')+
      (context.instructions ? '\nInstructor guidance:\n'+context.instructions : '')+
      '\nThe coach has already asked the question. This drawing stage preserves the instructor’s answer boundary; return only the diagram or NO_DIAGRAM, without another question or explanation.'},
    {role:'user',content:tutorMaterial(context)+'\n\nConversation (data):\n'+JSON.stringify(history)+
      '\nLearner: '+question+'\nCoach: '+coaching+'\nDrawing request (data): '+JSON.stringify(request)+
      (request.relationship ? '\nDrawing task: use participant id: FunctionName declarations and exactly one arrow labeled calls. Do not add arguments or behavior.' : '')}
  ];
}

function completedText(result) {
  if(result.finishReason==='length') {
    throw Object.assign(new Error('The reply reached its output or context limit and was not added to the conversation. Try a narrower question, or start fresh context with your own recap.'),{name:'TutorReplyLimitError'});
  }
  if(!result.text?.trim())throw new Error('The model returned no reply. Try naming one part of the source you want to investigate.');
  return result.text.trim();
}

export async function runTutorTurn({context,question,history,generate,signal,onStatus=()=>{}}) {
  signal.throwIfAborted();
  const result=await generate(tutorMessages(context,question,history),{signal,maxTokens:192});
  signal.throwIfAborted();
  const reply=completedText(result);
  const turn=parseTutorTurn(reply);
  if(context.coaching==='independent' && turn.diagram)throw new Error('This independent mission limits the tutor to general reading strategies and prerequisite resources.');
  if(['source','independent'].includes(context.coaching) && !turn.diagram)return sourceCoachReply(reply,context,history);
  // In source coaching the model may select a diagram, but cannot attach unchecked prose.
  if(context.coaching==='source')turn.text='';
  if((!turn.text && !turn.diagram) || /```|@startuml/.test(turn.text))throw new Error('The tutor did not return a short coaching reply. Try asking about one source decision.');
  if(!turn.diagram)return {text:turn.text,notice:turn.notice};
  if(context.coaching==='source') {
    turn.diagram.relationship=sourceDrawingRequest(context,turn.diagram,question,history);
    // The model's focus can contain invented arguments even when its function
    // names are right. Only verified relation data reaches the drawing stage.
    turn.diagram.focus=turn.diagram.relationship.caller+' calls '+turn.diagram.relationship.callee;
  }
  const relationship=turn.diagram.relationship;
  const coaching=relationship
    ? 'Your call from '+relationship.caller+' to '+relationship.callee+' appears in the source. What information would you trace across that call next?'
    : turn.text || 'Which source statement would you use to check the relationship you identified?';
  onStatus('Drawing a small diagram in a separate local generation…');
  try {
    const drawing=await generate(diagramMessages(context,turn.diagram,question,history,coaching),{signal,maxTokens:384});
    signal.throwIfAborted();
    const source=completedText(drawing);
    const parts=tutorReplyParts(source);
    const diagrams=parts.filter(part=>part.valid && part.type===turn.diagram.type);
    const checkedSource=relationship && diagrams.length===1 ? canonicalSourceDrawing(diagrams[0].source,relationship) : null;
    if(diagrams.length!==1 || parts.some(part=>'text' in part && part.text.trim()) || parts.some(part=>'valid' in part && !part.valid) ||
        (relationship && !checkedSource)) {
      return {text:coaching,notice:'The tutor could not draw a useful complete diagram. Continue with the question and source.'};
    }
    return {text:coaching+'\n\n```uml-'+turn.diagram.type+'\n'+(checkedSource || diagrams[0].source)+'\n```',notice:''};
  }catch(error) {
    signal.throwIfAborted();
    if(error.name==='AbortError')throw error;
    const notice=error.name==='InputError' || error.name==='TutorReplyLimitError'
      ? 'The diagram reached the engine’s context or output limit. The coaching question is still available; start fresh context with your own recap if needed.'
      : 'The diagram is unavailable. Continue with the coaching question and source, or try again later.';
    return {text:coaching,notice};
  }
}
