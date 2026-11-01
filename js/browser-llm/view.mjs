import {MODELS} from './catalog.mjs';

export const formatBytes = bytes => bytes >= 1e9 ? (bytes/1e9).toFixed(2)+' GB' : (bytes/1e6).toFixed(1)+' MB';
export class ModelView {
  constructor(host,template) {
    this.element = template.content.firstElementChild.cloneNode(true);
    host.append(this.element);
    this.fields = Object.fromEntries([...this.element.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el]));
    this.buttons = Object.fromEntries([...this.element.querySelectorAll('[data-action]')].map(el=>[el.dataset.action,el]));
  }
  status(text) { this.fields.status.textContent = text; }
  selection() {
    return {model:this.fields.model.value,memoryConfirmed:this.fields.memory.value === '16'};
  }
  describeSelection() {
    const model = MODELS[this.fields.model.value];
    this.fields['model-note'].textContent = model.memoryNote+
      (model.requiresMemoryConfirmation ? ' 7B is available only with compatible WebLLM graphics acceleration.' : '');
    this.fields['memory-confirmation'].hidden = !model.requiresMemoryConfirmation;
    for (const option of this.fields.engine.options) {
      option.disabled = model.requiresMemoryConfirmation && !['auto','webllm-gpu'].includes(option.value);
    }
    this.fields.device.textContent = 'Checking this selection…';
    this.fields['browser-note'].textContent = '';
  }
  showPlan(plan,{ready,activeProfile}) {
    this.fields['sharing-note'].textContent = plan.sharing?.message || '';
    const downloaded = plan.canLoad ? 'Downloaded; loads automatically when needed.' : 'Downloaded; memory confirmation required.';
    this.fields.setup.textContent = plan.cached
      ? downloaded
      : 'Download '+formatBytes(plan.artifact.bytes)+' once to use '+plan.model.label+' on this device.';
    if (!plan.canLoad) this.fields.setup.textContent += ' Confirm at least 16 GB of device memory in Model & storage first.';
    this.fields.device.textContent = ready
      ? 'Running on this device: '+plan.model.label+' · '+activeProfile.label+'.'
      : 'Selected: '+plan.model.label+' · '+plan.profile.label+'. '+
      (plan.cached ? downloaded : 'Model download: '+formatBytes(plan.artifact.bytes)+'.')+
      (plan.profile.gpu ? '' : ' Uses '+plan.profile.threads+' processor thread'+(plan.profile.threads===1?'':'s')+'.');
    for (const option of this.fields.engine.options) {
      option.disabled = option.value !== 'auto' && !plan.available.includes(option.value === 'cpu' ? 'wllama-cpu' : option.value);
    }
    this.fields['browser-note'].textContent = plan.model.requiresMemoryConfirmation
      ? '7B has no processor or ONNX fallback. If graphics initialization runs out of memory, select 3B.'
      : plan.capabilities.firefox
        ? (plan.available.includes('onnx-gpu')
          ? 'For Firefox graphics, choose Graphics — ONNX. Automatic reuses compatible downloads first.'
          : 'Graphics options depend on this Firefox version and its device limits. Processor reuses the GGUF download. Compare downloaded engines when more than one compatible option is available.') : '';
  }
  feedback(text) {
    this.fields.feedback.textContent = text;
    this.fields['feedback-wrap'].hidden = !text;
  }
  clearInspection() {
    this.fields.inspection.hidden = true;
    this.fields.inspection.open = false;
    this.fields['inspection-code'].replaceChildren();
  }
  showInspection(source) {
    // The shared highlighter creates text nodes and spans, never model HTML.
    this.fields['inspection-code'].replaceChildren(globalThis.ObjectReferenceCode.highlight(source));
    this.fields.inspection.hidden = false;
  }
  positionBeforeInstructions(before) {
    const host = this.element.parentElement;
    if (before) host.prepend(this.element);
    else host.append(this.element);
  }
  controls({busy=false,ready=false,cached=false,prepared=false,suggestion=false,exercise=false,chat=false,specificationOnly=false,deleting=false,comparable=false,operation}) {
    const usable = ready || cached;
    this.fields['model-state'].textContent = ready ? 'Ready · on your device' : operation === 'download' ? 'Setting up…' : cached ? 'Downloaded · on your device' : 'Optional · on your device';
    this.fields.setup.hidden = usable || !(exercise || chat);
    this.fields['check-hint'].hidden = !exercise;
    this.fields['check-hint'].textContent = specificationOnly
      ? 'Generates and checks an implementation from your prose. You only work on the specification.'
      : usable ? 'Checks the code in your editor.' : 'Checks the code in your editor. No download needed.';
    this.fields.engine.disabled = busy;
    this.fields.model.disabled = busy;
    this.fields.memory.disabled = busy;
    this.buttons.download.hidden = usable || !(exercise || chat);
    this.buttons.download.disabled = busy || ready || !prepared;
    this.buttons.unload.disabled = busy || !ready;
    this.buttons.generate.hidden = !usable || !exercise || specificationOnly;
    this.buttons.generate.disabled = busy || !usable || !exercise;
    this.buttons.check.hidden = !exercise;
    this.buttons.check.textContent = specificationOnly ? 'Test my work' : 'Check Python';
    this.buttons.check.disabled = busy || !exercise || (specificationOnly && !usable);
    this.buttons.apply.disabled = busy || !suggestion;
    this.buttons.cancel.hidden = !busy || deleting;
    this.buttons.compare.hidden = !comparable;
    this.buttons.compare.disabled = busy;
    this.buttons.delete.disabled = deleting;
  }
  clearProgress() {
    this.fields['progress-wrap'].hidden = true;
    this.fields.loading.hidden = true;
  }
  progress(value) {
    this.clearProgress();
    if (value.phase === 'generating') return;
    const progress = this.fields.progress;
    if (value.phase === 'download') {
      this.fields['progress-wrap'].hidden = false;
      progress.max = value.total; progress.value = value.loaded;
      this.fields.bytes.textContent = Math.floor(value.loaded/value.total*100)+'% · '+formatBytes(value.loaded)+' of '+formatBytes(value.total);
    } else {
      this.fields.loading.hidden = false;
      this.status(value.message || 'Loading model into memory…');
    }
  }
  destroy() { this.element.remove(); }
}
