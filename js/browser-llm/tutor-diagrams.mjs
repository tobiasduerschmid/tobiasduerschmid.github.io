const TYPES = new Set(['class','sequence','state','activity','component','deployment','usecase']);

export function inferDiagramType(source) {
  if (/^\s*(?:class|interface|enum|abstract\s+class)\s+/m.test(source)) return 'class';
  if (/^\s*usecase\s+/m.test(source)) return 'usecase';
  if (/^\s*node\s+/m.test(source)) return 'deployment';
  if (/^\s*component\s+/m.test(source)) return 'component';
  if (/\[\*\]/.test(source) || /^\s*state\s+/m.test(source)) return 'state';
  if (/\(\*\)/.test(source) || /^\s*"[^"\n]+"\s*-->/m.test(source)) return 'activity';
  if (/^\s*participant\s+/m.test(source) || /^\s*\w+\s*(?:->|-->)\s*\w+\s*:/m.test(source)) return 'sequence';
  return null;
}

// Consume unknown code fences intact so marker-like text inside Python/HTML
// cannot accidentally become a diagram. Bare UML still needs complete markers.
export function tutorReplyParts(reply) {
  const parts = [];
  const blocks = /^[ \t]*```([^\n]*)\n([\s\S]*?)(?:^[ \t]*```[ \t]*\r?$|(?![\s\S]))|^[ \t]*(@startuml[ \t]*\r?\n[\s\S]*?^[ \t]*@enduml[ \t]*\r?$)/gm;
  let end = 0, diagrams = 0;
  for (const match of reply.matchAll(blocks)) {
    const language = (match[1] || '').trim().toLowerCase();
    const source = (match[2] ?? match[3]).trim();
    const generic = ['uml','archuml','plantuml',''].includes(language);
    if (!generic && !/^(?:archuml|uml)-/.test(language)) continue;
    const type = generic ? inferDiagramType(source) : language.replace(/^(?:archuml|uml)-/, '');
    if (!TYPES.has(type)) continue;
    if (match.index > end) parts.push({text:reply.slice(end,match.index)});
    const valid = /^@startuml\s*\n[\s\S]*\n@enduml$/.test(source) && source.length <= 2400 && source.split('\n').length <= 45;
    parts.push({type,source,valid:valid && ++diagrams <= 1});
    end = match.index + match[0].length;
  }
  if (end < reply.length) parts.push({text:reply.slice(end)});
  return parts;
}

export function normalizeDiagramSource(source) {
  // Only relationship lines, not return types or prose inside method bodies.
  return source.replace(/^([ \t]*[\w.]+)[ \t]+→[ \t]+([\w.]+)/gm,'$1 --> $2');
}

function diagramSVG(type,source,signal) {
  return new Promise((resolve,reject)=>{
    signal.throwIfAborted();
    const worker = new Worker(new URL('../uml-worker.js',import.meta.url));
    const finish = (error,svg)=>{
      clearTimeout(timer); worker.terminate(); signal.removeEventListener('abort',abort);
      if (error) reject(error); else resolve(svg);
    };
    const abort = ()=>finish(new DOMException('Reply stopped.','AbortError'));
    const timer = setTimeout(()=>finish(new Error('Diagram rendering timed out.')),10000);
    signal.addEventListener('abort',abort,{once:true});
    worker.onerror = ()=>finish(new Error('Diagram renderer is unavailable.'));
    worker.onmessageerror = ()=>finish(new Error('Could not read the diagram.'));
    worker.onmessage = ({data})=>{
      if (data.type !== 'renderResult' || data.id !== 1) return;
      finish(data.ok ? null : new Error('The diagram could not be rendered.'),data.svg);
    };
    worker.postMessage({id:1,type:'renderDiagram',diagramType:type,syntax:source});
  });
}

export function sanitizedDiagram(svg,purifier) {
  const fragment = purifier.sanitize(svg,{USE_PROFILES:{svg:true,svgFilters:true},RETURN_DOM_FRAGMENT:true,
    FORBID_TAGS:['style','foreignObject','image','feImage','use','a','animate','animateMotion','animateTransform','set'],
    FORBID_ATTR:['style','href','xlink:href']});
  // SVG paint/filter attributes may reference URLs even without href.
  for (const element of fragment.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const urls = [...attribute.value.matchAll(/url\((.*?)\)/gi)];
      if (urls.some(match=>!/^\s*['"]?#[\w:-]+['"]?\s*$/.test(match[1]))) element.removeAttribute(attribute.name);
    }
  }
  return fragment;
}

async function renderDiagram(host,part,signal) {
  const figure = document.createElement('figure');
  figure.className = 'tvm-tutor-diagram';
  const canvas = document.createElement('div');
  canvas.className = 'tvm-tutor-diagram-canvas';
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Tutor '+part.type+' diagram');
  const status = document.createElement('p');
  status.textContent = 'Drawing diagram…';
  const source = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Diagram source (ArchUML)';
  const code = document.createElement('pre');
  code.textContent = part.source;
  source.append(summary,code); figure.append(status,canvas,source); host.appendChild(figure);
  try {
    if (!part.valid) throw new Error('Use one complete diagram of up to 45 lines.');
    // Rendering runs in a disposable worker. Untrusted SVG is sanitized before
    // it reaches the document; never run model markup in a live render surface.
    const renderSource = normalizeDiagramSource(part.source);
    const svg = await diagramSVG(part.type,renderSource,signal);
    signal.throwIfAborted();
    const fragment = sanitizedDiagram(svg,window.DOMPurify);
    if (!fragment.querySelector('svg')) throw new Error('The model did not produce a drawable diagram.');
    canvas.replaceChildren(fragment);
    window.UMLShared.prepareDiagramContainer(canvas,part.type);
    window.UMLShared.fitSVGToContent(canvas);
    window.UMLShared.applySvgAccessibility(canvas,part.type,renderSource);
    status.remove();
  } catch(error) {
    if (error.name === 'AbortError') {figure.remove(); throw error;}
    canvas.remove(); source.open = true;
    status.textContent = 'Diagram unavailable. You can read its source below or ask the tutor to simplify it.';
  }
}

export async function renderTutorReply(host,reply,signal) {
  for (const part of tutorReplyParts(reply)) {
    signal.throwIfAborted();
    if ('text' in part) {
      if (!part.text.trim()) continue;
      const text = document.createElement('p');
      text.textContent = part.text.trim(); host.appendChild(text);
    } else await renderDiagram(host,part,signal);
  }
}
