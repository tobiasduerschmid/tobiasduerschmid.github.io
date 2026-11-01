import {BrowserLLM} from './runtime.mjs';
import {renderTutorReply} from './tutor-diagrams.mjs';
import {ModelView} from './view.mjs';
import {feedbackMessages,CATEGORIES,wantsTutorDiagram} from './prompts.mjs';
import {generateStandalonePython,generationProblem,GENERATION_PHASES} from './program-generation.mjs';
import {runTutorTurn} from './tutor-session.mjs';
import {checkSpecification,specificationFeedback,specificationStatus} from './specification-exercise.mjs';

async function addSourceEvidence(context,signal,{optional}) {
  try {
    if(!window.SEBookPythonAst)throw new Error('Source analysis is unavailable. Reload this page, or use the lesson and ask a TA.');
    const model=await window.SEBookPythonAst.analyze(context.files.filter(file=>file.path.endsWith('.py'))
      .map(file=>({filename:file.path,content:file.content})));
    signal.throwIfAborted();
    if(model.errors?.length)throw new Error('The Python source could not be parsed. Restore the supplied source before asking about its statements.');
    context.sourceModel=model;
  } catch(error) {
    signal.throwIfAborted();
    if(!optional)throw error;
    // A drawing still gets the complete source when this optional outline is unavailable.
  }
}

class TutorialModelAddon {
  constructor(tutorial,template) {
    this.tutorial = tutorial;
    this.view = new ModelView(tutorial.stepContentWrapEl,template);
    this.runtime = new BrowserLLM({onChange:message=>{this.cancel();this.view.status(message);this.prepare();}});
    this.specifications = new Map();
    this.listeners = new AbortController();
    this.watchers = [];
    const on = (element,event,handler) => element.addEventListener(event,handler,{signal:this.listeners.signal});
    const actions = {download:()=>this.download(),unload:()=>{this.unload();this.prepare();},delete:()=>this.remove(),
      cancel:()=>this.cancel(),compare:()=>this.compare(),generate:()=>this.generate(),apply:()=>this.apply(),check:()=>this.check()};
    for (const [name,handler] of Object.entries(actions)) on(this.view.buttons[name],'click',handler);
    on(this.view.fields.engine,'change',()=>{this.unload();this.prepare();});
    on(this.view.fields.model,'change',()=>{
      this.view.fields.engine.value = 'auto';
      this.unload();this.prepare();
    });
    on(this.view.fields.memory,'change',()=>{this.unload();this.prepare();});
    on(this.view.fields.specification,'input',()=>{
      this.specifications.set(this.specificationKey(),this.view.fields.specification.value);
      this.invalidate();
    });
    on(window,'pagehide',()=>this.runtime.unload());
    this.setStep();
    this.prepare();
  }
  refresh() {
    this.view.controls({busy:!!this.operation,ready:this.runtime.ready,cached:!!this.plan?.cached && !!this.plan?.canLoad,prepared:!!this.plan?.canLoad,
      suggestion:!!this.suggestion,exercise:!!this.exercise,specificationOnly:this.exercise?.mode === 'specification',
      chat:this.tutorial.config.ai_tutor === true,
      deleting:this.operation?.kind === 'delete',comparable:!!this.plan?.comparable,operation:this.operation?.kind});
  }
  async prepare() {
    const request = this.prepareRequest = (this.prepareRequest || 0)+1;
    this.plan = null; this.refresh();
    this.view.describeSelection();
    try {
      const plan = await this.runtime.prepare(this.view.fields.engine.value,this.view.selection());
      if (request !== this.prepareRequest || this.destroyed) return;
      this.plan = plan;
      this.view.showPlan(plan,this.runtime);
    } catch(error) {
      if (request === this.prepareRequest && error.name !== 'AbortError') {
        this.view.status(error.message);
        this.view.fields.setup.textContent = error.message;
        this.view.fields.device.textContent = 'No compatible engine selected.';
      }
    }
    this.refresh();
  }
  beforeStepChange() { this.cancel(); this.view.clearInspection(); this.chat?.destroy(); this.chat=null; this.watchers.forEach(w=>w.dispose()); this.watchers=[]; }
  specificationKey() { return this.exercise?.draft_id ?? this.tutorial.currentStep; }
  setStep() {
    this.beforeStepChange();
    this.suggestion = null;
    this.exercise = this.tutorial.steps[this.tutorial.currentStep]?.llm;
    this.view.positionBeforeInstructions(this.exercise?.mode === 'specification');
    this.view.fields.exercise.hidden = !this.exercise;
    this.view.fields.result.hidden = true;
    this.view.feedback('');
    if (!this.operation) this.view.status('');
    if (this.exercise) {
      this.view.fields.contract.textContent = this.exercise.interface;
      this.view.fields.specification.value = this.specifications.get(this.specificationKey()) ?? this.exercise.specification ?? '';
    }
    this.watchers = Object.values(this.tutorial.editorModels).map(entry=>entry.model.onDidChangeContent(()=>this.invalidate()));
    this.refresh();
    if (this.tutorial.config.ai_tutor === true && window.TutorChat) {
      this.chat = window.TutorChat.createLocal(this.view.element,
        (question,history,onStatus)=>this.askTutor(question,history,onStatus),
        ()=>{if (this.operation?.kind === 'chat') this.cancel();},renderTutorReply);
    }
  }
  invalidate() {
    this.suggestion = null;
    this.view.clearInspection();
    if (this.operation?.kind !== 'download' && this.operation?.kind !== 'delete') this.cancel();
    this.view.feedback('');
    if (!this.operation) this.view.status('');
    this.refresh();
  }
  cancel() {
    if (!this.operation || this.operation.kind === 'delete') return;
    if (this.operation.kind === 'check') this.view.clearInspection();
    this.operation.controller.abort();
    this.operation = null;
    this.suggestion = null;
    this.view.clearProgress();
    this.view.status('Cancelled. Downloaded files remain until you delete them.');
    this.refresh();
  }
  async perform(kind,action,{rethrow=false}={}) {
    if (this.operation) { if (rethrow) throw new Error('Wait for the current model operation, or cancel it first.'); return; }
    const operation = {kind,controller:new AbortController()};
    this.operation = operation; this.refresh();
    try { return await action(operation.controller.signal); }
    catch(error) {
      if (this.operation === operation && error.name !== 'AbortError') this.view.status(error.message);
      if (rethrow) throw error;
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.view.clearProgress();
      }
      this.refresh();
    }
  }
  async askTutor(question,history,onStatus) {
    if (!this.runtime.ready && !this.plan?.cached) throw new Error('Download the model using the button above, then send your question.');
    const step = this.tutorial.steps[this.tutorial.currentStep];
    const context = {title:step.title,contract:this.exercise?.interface,instructions:step.ai_tutor_instructions,
      coaching:step.ai_tutor_mode || this.tutorial.config.ai_tutor_mode,
      specification:this.exercise ? this.view.fields.specification.value : '',
      files:this.tutorial.captureTutorFiles()};
    try {
      return await this.perform('chat',async signal=>{
        if(context.coaching==='source') {
          onStatus('Reading source structure…');
          await addSourceEvidence(context,signal,{optional:wantsTutorDiagram(question)});
        }
        let stage='Writing a local coaching reply…';
        const result = await runTutorTurn({context,question,history,signal,
          onStatus:message=>{stage=message;onStatus(message);},
          generate:(messages,options)=>this.runtime.generate(messages,{...options,onProgress:value=>{
            this.generationProgress(value,signal,stage);
            onStatus(value.phase === 'generating' ? stage : value.message || 'Loading model into memory…');
          }})});
        this.view.status('Tutor reply ready.');
        return result;
      },{rethrow:true});
    } catch(error) {
      if (error.name==='InputError') {
        throw new Error(history.length
          ? 'The conversation and source exceed this engine’s context limit. Your messages and question are unchanged. Use Start fresh context, then include your own short recap with the next question. No source or instructions were shortened.'
          : 'This step’s source and instructions exceed this engine’s input limit even in fresh context. Try Processor in Model & storage. No files were shortened; you can also use the lesson or ask a TA.');
      }
      throw error;
    } finally { if (!this.runtime.ready && !this.operation) await this.prepare(); }
  }
  async download() {
    const focused = document.activeElement;
    await this.perform('download',async signal=>{
      this.view.status('Downloading the selected model. You can cancel or delete it at any time.');
      const profile = await this.runtime.load({signal,onProgress:progress=>this.view.progress(progress)});
      this.view.fields.device.textContent = 'Running on this device: '+profile.label+'.';
      this.view.status('Model ready.');
    });
    await this.prepare();
    if (this.runtime.ready && focused === this.view.buttons.download && document.activeElement === document.body) {
      if(this.exercise)(this.exercise.mode === 'specification' ? this.view.buttons.check : this.view.buttons.generate).focus();
      else this.chat?.focus();
    }
  }
  async compare() {
    await this.perform('compare',async signal=>{
      this.view.status('Comparing downloaded engines with the same short local task…');
      const result = await this.runtime.compare({signal,onProgress:value=>this.view.progress(value)});
      this.view.status(result.measured
        ? 'Comparison complete. Using '+result.profile.label+', the fastest measured option for this short task. Longer programs may differ.'
        : 'Comparison complete. Outputs differed, so the automatic compatibility choice is retained: '+result.profile.label+'.');
    });
    await this.prepare();
  }
  unload() {
    this.cancel(); this.runtime.unload();
    this.view.status(this.runtime.shared
      ? 'Model released for this tab. Other tabs may still use it; the download is kept for next time.'
      : 'Model unloaded from memory. The download is kept for next time.'); this.refresh();
  }
  async remove() {
    this.cancel();
    await this.perform('delete',async()=>{
      this.view.status('Deleting complete and partial model downloads…');
      await this.runtime.deleteModels();
      this.view.status('Downloaded model deleted. Your Python files and tutorial progress are unchanged.');
    });
    await this.prepare();
  }
  async generate() {
    await this.perform('generate',async signal=>{
      const snapshot = this.tutorial.captureLlmSnapshot(this.exercise.file);
      const spec = this.view.fields.specification.value;
      this.suggestion = null;
      this.view.fields.result.hidden = false;
      this.view.fields.code.value = '';
      const started = performance.now();
      let phase = 'generating';
      const result = await generateStandalonePython({specification:spec,contract:this.exercise.interface,signal,
        isCurrent:()=>this.tutorial.isLlmSnapshotCurrent(snapshot) && spec === this.view.fields.specification.value,
        onPhase:value=>{phase=value;this.view.status(GENERATION_PHASES[value]);},
        inspect:source=>this.tutorial.inspectLlmProgram({...snapshot,source},signal),
        generate:(messages,options)=>this.runtime.generate(messages,{...options,
          onProgress:value=>this.generationProgress(value,signal,GENERATION_PHASES[phase]),
          onText:text=>{if (!signal.aborted) this.view.fields.code.value=text;}})});
      if (!result) return;
      if (signal.aborted || !this.tutorial.isLlmSnapshotCurrent(snapshot) || spec !== this.view.fields.specification.value) return;
      if (result.source) this.view.fields.code.value = result.source;
      if (result.status !== 'complete') {this.view.status(generationProblem(result));return;}
      const code = result.source;
      this.suggestion = {snapshot,code};
      this.view.fields.code.value = code;
      this.view.status('Generation complete in '+((performance.now()-started)/1000).toFixed(1)+' seconds. Review the program, then apply it to '+this.exercise.file+'.');
    });
    if (!this.runtime.ready && !this.operation) await this.prepare();
  }
  generationProgress(value,signal,message) {
    if (signal.aborted) return;
    this.view.progress(value);
    if (value.phase === 'generating') {
      this.view.fields.device.textContent = 'Running on this device: '+this.runtime.activeProfile.label+'.';
      this.view.status(message);
    }
  }
  apply() {
    if (!this.suggestion) return;
    const {snapshot,code} = this.suggestion;
    this.suggestion = null;
    try { this.tutorial.applyLlmProgram(snapshot,code); this.view.status('Generated Python applied. Check it before trusting it.'); }
    catch(error) { this.view.status(error.message); }
    this.refresh();
  }
  async check() {
    if (this.exercise.mode === 'specification') return this.checkProse();
    await this.perform('check',async signal=>{
      const snapshot = this.tutorial.captureLlmSnapshot(this.exercise.file);
      const spec = this.view.fields.specification.value;
      this.view.status('Checking the current Python file…');
      const result = await this.tutorial.runLlmChecks(snapshot,this.exercise,signal);
      if (!result || signal.aborted) return;
      const messages = {
        syntax:'The Python file has a syntax error. Repair the code or generate again. This does not show that your specification is wrong.',
        runtime:'The Python program raised an error while being checked. Review the implementation. This does not show that your specification is wrong.',
        unavailable:'The checks could not finish. Stop any running program, shorten its work, and try again.'
      };
      if (result.status !== 'checked') { this.view.feedback(messages[result.status]);this.view.status('Check finished. Read the feedback below.');return; }
      const failed = result.failed.filter(category=>Object.hasOwn(CATEGORIES,category));
      if (!failed.length) {
        this.view.feedback('The implementation passed these checks. That does not prove the specification is unambiguous or complete. Explain which rules it states and choose a new case yourself.');
        this.view.status('Checks passed. Read the reflection prompt below.');return;
      }
      const summary = 'The implementation did not satisfy every check. Review '+failed.map(key=>CATEGORIES[key]).join('; ')+'. The specification may be unclear, or the implementation may be faulty.';
      this.view.feedback(summary);
      if ((this.runtime.ready || this.plan?.cached) && spec.trim()) {
        const progress = value=>this.generationProgress(value,signal,'Generating conceptual questions locally…');
        const advice=await this.runtime.generate(feedbackMessages(spec,this.exercise.interface,failed),{signal,maxTokens:220,onProgress:progress});
        if (signal.aborted || !this.tutorial.isLlmSnapshotCurrent(snapshot)) return;
        if (advice.finishReason !== 'length' && advice.text.trim()) this.view.feedback(summary+'\n\nModel suggestions — verify them yourself:\n'+advice.text.trim());
      }
      this.view.status('Check finished. Read the conceptual feedback below.');
    });
    if (!this.runtime.ready && !this.operation) await this.prepare();
  }
  async checkProse() {
    await this.perform('check',async signal=>{
      const snapshot = this.tutorial.captureLlmSnapshot(this.exercise.file);
      const specification = this.view.fields.specification.value;
      this.view.feedback('');
      this.view.clearInspection();
      let phase = 'generating';
      const result = await checkSpecification({
        specification,exercise:this.exercise,snapshot,signal,
        isCurrent:captured=>this.tutorial.isLlmSnapshotCurrent(captured) && specification === this.view.fields.specification.value,
        generate:(messages,options)=>this.runtime.generate(messages,{...options,
          onProgress:value=>this.generationProgress(value,signal,GENERATION_PHASES[phase])}),
        inspect:source=>this.tutorial.inspectLlmProgram({...snapshot,source},signal),
        runChecks:(candidate,exercise,checkSignal)=>this.tutorial.runLlmChecks(candidate,exercise,checkSignal),
        onGenerated:source=>this.view.showInspection(source),
        onPhase:value=>{phase=value;this.view.status(value === 'checking'
          ? 'Checking the generated implementation…' : GENERATION_PHASES[value]);}
      });
      if (!result) return;
      this.view.feedback(specificationFeedback(result));
      this.view.status(specificationStatus(result));
    });
    if (!this.runtime.ready && !this.operation) await this.prepare();
  }
  destroy() {
    this.destroyed=true;this.prepareRequest++;
    this.cancel();this.chat?.destroy();this.runtime.destroy();this.listeners.abort();
    this.watchers.forEach(w=>w.dispose());this.view.destroy();
  }
}
export function mountTutorialModel(tutorial,template) {
  if (tutorial.config.backend !== 'pyodide' || tutorial._mixedBackendMode) throw new Error('The specification assistant requires a Python-only tutorial.');
  tutorial.llmAddon = new TutorialModelAddon(tutorial,template);
  return tutorial.llmAddon;
}
