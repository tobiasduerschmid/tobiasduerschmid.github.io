// Runs in the disposable JVM frame. A pending native Promise suspends Java at
// its actual bytecode line while the parent debugger remains interactive.
(function () {
  'use strict';
  let session;

  function send(s, event) { s.port.postMessage({type:'debug-event', event}); }
  function configureBreakpoints(s, changes) {
    for (const change of changes || []) {
      const key = change.file + ':' + change.line;
      if (change.op === 'remove' || change.remove || change.enabled === false) s.breakpoints.delete(key);
      else s.breakpoints.set(key, {...change,hits:0});
    }
  }
  function operand(expression, frame) {
    if (expression === 'true' || expression === 'false')
      return {kind:'primitive',type:'boolean',repr:expression};
    if (/^-?\d+[lL]?$/.test(expression))
      return {kind:'primitive',type:'long',repr:expression.replace(/[lL]$/,'')};
    if (/^-?(?:\d+\.\d*|\d*\.\d+)$/.test(expression))
      return {kind:'primitive',type:'double',repr:expression};
    if (expression === 'null') return {kind:'primitive',type:'null',repr:'null'};
    const path = expression.match(/^([$\w]+)((?:\.[$\w]+|\[\d+\])*)$/u);
    if (!path) throw new Error('Use a local, field, array element, or numeric comparison.');
    let value = Object.hasOwn(frame.locals,path[1]) ? frame.locals[path[1]] : frame.locals.this?.attrs?.[path[1]];
    for (const [,field,index] of path[2].matchAll(/\.([$\w]+)|\[(\d+)\]/gu))
      value = field === 'length' && value?.kind === 'collection'
        ? {kind:'primitive',type:'int',repr:String(value.len)} : field ? value?.attrs?.[field] : value?.children?.[Number(index)];
    if (!value?.kind) throw new Error('Value unavailable in this frame.');
    return value;
  }
  function comparable(value) {
    if (value.type === 'null') return null;
    if (value.type === 'java.lang.Boolean' || value.type === 'boolean') return value.repr === 'true';
    if (/^(long|int|java\.lang\.(Integer|Long|Byte|Short))$/.test(value.type)) return BigInt(value.repr);
    if (/^(double|java\.lang\.(Double|Float))$/.test(value.type)) return Number(value.repr);
    throw new Error('Compare numeric or boolean values, or compare an object with null.');
  }
  function watch(expression, frame) {
    try {
      const comparison = /^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(expression);
      if (!comparison) {
        const value = operand(expression.trim(),frame);
        // Inspection handles are ephemeral. A Java reference watch changes when
        // another object gets assigned, independently of which fields were opened.
        return value.oid != null ? {kind:'reference',type:value.type,repr:value.repr,oid:value.oid} : value;
      }
      const left = operand(comparison[1].trim(),frame), right = operand(comparison[3].trim(),frame);
      const op = comparison[2];
      let result;
      if ((op === '==' || op === '!=') && (left.type === 'null' || right.type === 'null')) {
        result = (left.type === right.type) === (op === '==');
      } else {
        let a = comparable(left), b = comparable(right);
        // Java promotes to floating point when either operand is floating point.
        if ((typeof a === 'number' || typeof b === 'number') && typeof a !== 'boolean' && typeof b !== 'boolean') {
          a = Number(a); b = Number(b);
        }
        if (typeof a !== typeof b || a === null || (typeof a === 'boolean' && !['==','!='].includes(op)))
          throw new Error('The operands have incompatible Java types.');
        result = op === '==' ? a === b : op === '!=' ? a !== b : op === '<' ? a < b :
          op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
      }
      return {kind:'primitive',type:'boolean',repr:String(result)};
    } catch (error) { return {error:error.message}; }
  }

  async function inspectValue(s, value) {
    if (!value?.handle || value.inspected) return;
    const trace = await s.library.sebook.javaeditor.Trace;
    const members = JSON.parse(await trace.inspect(value.handle));
    Object.assign(value, members, {inspected:true});
    if (!members.kind) value.note = 'Value no longer available.';
  }
  async function prepareWatch(s, expression, frame) {
    // Fetch only the object fields requested by a watch or breakpoint.
    for (const [path] of expression.matchAll(/[$\w]+(?:\.[$\w]+|\[\d+\])*/gu)) {
      const root = /^[$\w]+/u.exec(path)[0];
      let value = frame.locals[root];
      if (!value && frame.locals.this && !/^(?:null|true|false|\d)/.test(root)) {
        await inspectValue(s,frame.locals.this);
        value = frame.locals.this.attrs?.[root];
      }
      for (const [,field,index] of path.slice(root.length).matchAll(/\.([$\w]+)|\[(\d+)\]/gu)) {
        if (field === 'length' && value?.kind === 'collection') break;
        await inspectValue(s,value);
        value = field ? value?.attrs?.[field] : value?.children?.[Number(index)];
      }
    }
  }
  async function fillWatches(s,snap) {
    const top = snap.stack[snap.stack.length-1];
    for (const expr of s.watches) await prepareWatch(s,expr,top);
    snap.watches = Object.fromEntries(s.watches.map(expr => [expr,watch(expr,top)]));
  }

  async function record(s, library, raw) {
    if (!s || s !== session || s.count >= s.limit) {
      if (s === session && s && !s.capped) {
        s.capped = true;
        send(s,{type:'capReached',limit:s.limit});
      }
      return false;
    }
    s.library = library;
    const snap = JSON.parse(raw);
    const previous = s.stacks.get(snap.thread) || [];
    snap.stack.forEach((frame,i) => {
      const prior = previous[i];
      const same = prior?.function === frame.function && prior.file === frame.file &&
        (!frame.call_id || prior.call_id === frame.call_id);
      frame.call_id ||= same ? prior.call_id : ++s.nextId;
      if (frame.line < 1 && same) frame.line = prior.line;
      frame.locals = same ? prior.locals : {};
      frame.globals = {};
    });
    const top = snap.stack[snap.stack.length-1];
    if (snap.event !== 'exception') top.locals = snap.locals;
    delete snap.locals;
    Object.assign(snap,{file:top.file,line:top.line,depth:snap.stack.length,call_id:top.call_id,source_mapped:true});
    await fillWatches(s,snap);
    s.stacks.set(snap.thread,snap.stack);
    s.snapshots.push(snap);
    snap.sequence = ++s.count;
    const bp = s.breakpoints.get(snap.file + ':' + snap.line);
    let hit = false;
    if (bp && snap.event === 'line') {
      if (bp.condition) await prepareWatch(s,bp.condition,top);
      const condition = bp.condition && watch(bp.condition,top);
      if (condition && (condition.error || !['boolean','java.lang.Boolean'].includes(condition.type))) {
        const error = condition.error || 'A Java breakpoint condition must be boolean.';
        if (error !== bp.error) send(s,{type:'breakpointError',file:snap.file,line:snap.line,error});
        bp.error = error;
      } else if (!condition || condition.repr === 'true') hit = ++bp.hits >= (bp.hitCount || 1);
    }
    const exception = snap.exception;
    const thrown = exception && s.exceptions.some(e => {
      if (e.enabled === false || e.type && exception.type !== e.type && !exception.type.endsWith('.' + e.type)) return false;
      if (e.mode === 'uncaught') return exception.phase === 'uncaught';
      // Continue stops once per exception, even if its catch or escape is later recorded.
      return exception.phase === 'throw' || !s.observedThrows.has(exception.oid);
    });
    if (exception?.phase === 'throw') s.observedThrows.add(exception.oid);
    if (exception?.phase === 'catch') s.observedThrows.delete(exception.oid);
    if (!(s.count === 1 || hit || thrown || s.mode === 2 || (snap.thread === s.thread &&
        (s.mode === 3 && snap.depth <= s.depth || s.mode === 4 && snap.depth < s.depth)))) return true;
    s.depth = snap.depth; s.thread = snap.thread; s.last = snap;
    const waiting = new Promise(resolve => { s.resume = resolve; });
    send(s,{type:'paused',snapshots:s.snapshots.splice(0)});
    await waiting;
    return s === session;
  }

  globalThis.JavaTutorialDebugger = {
    natives:{
      Java_sebook_javaeditor_Trace_event(_library,json) {
        const s = session;
        if (!s) return false;
        // Serialize simultaneous Java threads at probes. Resume affects only
        // this suspended event, preserving coherent stack and history order.
        const job = s.tail.then(() => record(s,_library,json));
        s.tail = job.catch(() => {});
        return job;
      },
    },
    start(port,config) {
      const limit = Number(config.options?.max_history || config.options?.max_snapshots) || 2000;
      session = {port,mode:2,depth:0,thread:null,last:null,resume:null,snapshots:[],count:0,nextId:0,
        limit:Math.max(1,Math.min(limit,10000)),watches:config.watches || [],exceptions:config.exceptionBreakpoints || [],
        breakpoints:new Map(),stacks:new Map(),observedThrows:new Set(),tail:Promise.resolve()};
      configureBreakpoints(session,config.breakpoints);
    },
    async command(command) {
      const s = session;
      if (!s) return;
      if (command?.type === 'breakpoints') configureBreakpoints(s,command.changes);
      else if (command?.type === 'watches') s.watches = command.watches;
      else if (command?.type === 'exceptions') s.exceptions = command.exceptions;
      else if (command?.type === 'inspect' && s.resume) {
        const current = s.last;
        if (command.sequence !== current.sequence) return;
        let value = current.stack[command.frame]?.locals;
        for (const [i,part] of command.path.entries()) {
          value = i === 0 ? value?.[part] : /^\[\d+\]$/.test(part) ?
            value?.children?.[Number(part.slice(1,-1))] : value?.attrs?.[part];
        }
        await inspectValue(s,value);
        if (s.resume && current === s.last) send(s,{type:'paused',snapshots:[current],replace_last:true});
      } else if (command === 6 && s.resume) {
        const current = s.last;
        await fillWatches(s,current);
        if (s.resume && current === s.last) send(s,{type:'paused',snapshots:[current],replace_last:true});
      } else if (s.resume && [1,2,3,4].includes(command)) {
        s.mode = command;
        const resume = s.resume;
        s.resume = null;
        send(s,{type:'continued'});
        resume();
      }
    },
    finish() {
      const snapshots = session?.snapshots || [];
      session = null;
      return snapshots;
    },
  };
})();
