import {BrowserLLM} from './runtime.mjs';
import {ModelView,formatBytes} from './view.mjs';
import {generationMessages,feedbackMessages,pythonFromResult,CATEGORIES} from './prompts.mjs';

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
    on(this.view.fields.specification,'input',()=>{
      this.specifications.set(this.tutorial.currentStep,this.view.fields.specification.value);
      this.invalidate();
    });
    on(window,'pagehide',()=>this.runtime.unload());
    this.setStep();
    this.prepare();
  }
  refresh() {
    this.view.controls({busy:!!this.operation,ready:this.runtime.ready,cached:!!this.plan?.cached,prepared:!!this.plan,
      suggestion:!!this.suggestion,exercise:!!this.exercise,deleting:this.operation?.kind === 'delete',comparable:!!this.plan?.comparable,operation:this.operation?.kind});
  }
  async prepare() {
    const request = this.prepareRequest = (this.prepareRequest || 0)+1;
    this.plan = null; this.refresh();
    try {
      const plan = await this.runtime.prepare(this.view.fields.engine.value);
      if (request !== this.prepareRequest || this.destroyed) return;
      this.plan = plan;
      this.view.fields.setup.textContent = plan.cached
        ? 'The downloaded model loads automatically when needed.'
        : 'Download '+formatBytes(plan.artifact.bytes)+' once to generate Python on this device.';
      this.view.fields.device.textContent = this.runtime.ready
        ? 'Running on this device: '+this.runtime.activeProfile.label+'.'
        : 'Selected: '+plan.profile.label+'. '+
        (plan.cached ? 'Downloaded; loads automatically when needed.' : 'Model download: '+formatBytes(plan.artifact.bytes)+'.')+
        (plan.profile.gpu ? '' : ' Uses '+plan.profile.threads+' processor thread'+(plan.profile.threads===1?'':'s')+'.');
      for (const option of this.view.fields.engine.options) {
        option.disabled = option.value !== 'auto' && !plan.available.includes(option.value === 'cpu' ? 'wllama-cpu' : option.value);
      }
      this.view.fields['browser-note'].textContent = plan.capabilities.firefox
        ? (plan.available.includes('onnx-gpu')
          ? 'For Firefox graphics, choose Graphics — ONNX. Automatic reuses compatible downloads first.'
          : 'Graphics options depend on this Firefox version and its device limits. Processor reuses the GGUF download. Compare downloaded engines when more than one compatible option is available.') : '';
    } catch(error) { if (request === this.prepareRequest && error.name !== 'AbortError') this.view.status(error.message); }
    this.refresh();
  }
  beforeStepChange() { this.cancel(); this.watchers.forEach(w=>w.dispose()); this.watchers=[]; }
  setStep() {
    this.beforeStepChange();
    this.suggestion = null;
    this.exercise = this.tutorial.steps[this.tutorial.currentStep]?.llm;
    this.view.fields.exercise.hidden = !this.exercise;
    this.view.fields.result.hidden = true;
    this.view.feedback('');
    if (this.exercise) {
      this.view.fields.contract.textContent = this.exercise.interface;
      this.view.fields.specification.value = this.specifications.get(this.tutorial.currentStep) ?? this.exercise.specification ?? '';
      this.watchers = Object.values(this.tutorial.editorModels).map(entry=>entry.model.onDidChangeContent(()=>this.invalidate()));
    }
    this.refresh();
  }
  invalidate() {
    this.suggestion = null;
    if (this.operation?.kind !== 'download' && this.operation?.kind !== 'delete') this.cancel();
    this.view.feedback('');
    this.refresh();
  }
  cancel() {
    if (!this.operation || this.operation.kind === 'delete') return;
    this.operation.controller.abort();
    this.operation = null;
    this.suggestion = null;
    this.view.clearProgress();
    this.view.status('Cancelled. Downloaded files remain until you delete them.');
    this.refresh();
  }
  async perform(kind,action) {
    if (this.operation) return;
    const operation = {kind,controller:new AbortController()};
    this.operation = operation; this.refresh();
    try { await action(operation.controller.signal); }
    catch(error) {
      if (this.operation === operation && error.name !== 'AbortError') this.view.status(error.message);
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.view.clearProgress();
      }
      this.refresh();
    }
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
    if (this.runtime.ready && focused === this.view.buttons.download && document.activeElement === document.body) this.view.buttons.generate.focus();
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
    this.view.status('Model unloaded from memory. The download is kept for next time.'); this.refresh();
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
      const messages = generationMessages(spec,this.exercise.interface);
      this.suggestion = null;
      this.view.fields.result.hidden = false;
      this.view.fields.code.value = '';
      const progress = value=>this.generationProgress(value,signal,'Generating Python locally…');
      const result = await this.runtime.generate(messages,{signal,onProgress:progress,onText:text=>{if (!signal.aborted) this.view.fields.code.value=text;}});
      if (signal.aborted || !this.tutorial.isLlmSnapshotCurrent(snapshot) || spec !== this.view.fields.specification.value) return;
      const code = pythonFromResult(result);
      this.suggestion = {snapshot,code};
      this.view.fields.code.value = code;
      this.view.status('Generation complete in '+(result.timing.elapsedMs/1000).toFixed(1)+' seconds. Review the program, then apply it to '+this.exercise.file+'.');
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
  destroy() {
    this.destroyed=true;this.prepareRequest++;
    this.cancel();this.runtime.destroy();this.listeners.abort();
    this.watchers.forEach(w=>w.dispose());this.view.destroy();
  }
}
export function mountTutorialModel(tutorial,template) {
  if (tutorial.config.backend !== 'pyodide' || tutorial._mixedBackendMode) throw new Error('The specification assistant requires a Python-only tutorial.');
  tutorial.llmAddon = new TutorialModelAddon(tutorial,template);
  return tutorial.llmAddon;
}
