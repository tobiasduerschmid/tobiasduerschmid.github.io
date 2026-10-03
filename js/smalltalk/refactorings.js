(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  /** Native catalog/model facade. Workspace alone owns serialization and publication. */
  class Refactorings {
    #workspace;
    static create(workspace) { return new Refactorings(workspace); }
    constructor(workspace) { this.#workspace = workspace; }
    catalog(target) { return this.#workspace.refactoringQuery('refactoringCatalog', { target }); }
    prepare(request) { return this.#workspace.refactoringQuery('prepareRefactoring', request); }
    async cancel(preview) { await this.#workspace.refactoringQuery('cancelRefactoring', { token: preview.token }, { sessionId: preview.sessionId }); }
    apply(preview) {
      return this.#workspace.commit({ baseRevision: preview.baseRevision, action: 'applyRefactoring', params: { token: preview.token } });
    }
    undo() { return this.#historyMutation('undoRefactoring'); }
    redo() { return this.#historyMutation('redoRefactoring'); }
    #historyMutation(action) {
      return this.#workspace.commit({ baseRevision: this.#workspace.snapshot().revision, action, params: {} });
    }
    historyState() { return this.#workspace.historyState(); }
  }
  api.Refactorings = Refactorings;
})(window);
