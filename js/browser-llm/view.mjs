export const formatBytes = bytes => bytes >= 1e9 ? (bytes/1e9).toFixed(2)+' GB' : (bytes/1e6).toFixed(1)+' MB';
export class ModelView {
  constructor(host,template) {
    this.element = template.content.firstElementChild.cloneNode(true);
    host.append(this.element);
    this.fields = Object.fromEntries([...this.element.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el]));
    this.buttons = Object.fromEntries([...this.element.querySelectorAll('[data-action]')].map(el=>[el.dataset.action,el]));
  }
  status(text) { this.fields.status.textContent = text; }
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
  controls({busy=false,ready=false,cached=false,prepared=false,suggestion=false,exercise=false,specificationOnly=false,deleting=false,comparable=false,operation}) {
    const usable = ready || cached;
    this.fields['model-state'].textContent = ready ? 'Ready · on your device' : operation === 'download' ? 'Setting up…' : cached ? 'Downloaded · on your device' : 'Optional · on your device';
    this.fields.setup.hidden = usable || !exercise;
    this.fields['check-hint'].hidden = !exercise;
    this.fields['check-hint'].textContent = specificationOnly
      ? 'Generates and checks an implementation from your prose. You only work on the specification.'
      : usable ? 'Checks the code in your editor.' : 'Checks the code in your editor. No download needed.';
    this.fields.engine.disabled = busy;
    this.buttons.download.hidden = usable || !exercise;
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
