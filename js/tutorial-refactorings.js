/**
 * Shared browser-only tutorial refactorings.
 *
 * The module is deliberately host-neutral: it knows Monaco models and a small
 * workspace/apply contract, not TutorialCode internals. Main tutorial windows
 * and detached popup windows both attach the same controller and reuse the
 * same Python adapter, preview modal, and popup request helper.
 *
 * Language adapters consume a shared source model:
 *   { files: { [filename]: { classes, functions, calls, assignments, imports, statements, symbols } } }
 * Each adapter owns its parser/analyzer and returns Monaco edit plans. Python is
 * the first implementation and is backed by Python's stdlib ast module through
 * js/python-ast-worker.js; JS/TS/JSX can plug into the same contract later.
 */
(function (global) {
  'use strict';

  var PYTHON_KEYWORDS = new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
    'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
    'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
    'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
  ]);

  var PYTHON_BUILTINS = new Set([
    'abs', 'all', 'any', 'bool', 'bytes', 'callable', 'chr', 'dict', 'dir',
    'enumerate', 'filter', 'float', 'format', 'frozenset', 'getattr', 'hasattr',
    'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'map', 'max',
    'min', 'next', 'object', 'open', 'print', 'range', 'repr', 'reversed',
    'round', 'set', 'str', 'sum', 'super', 'tuple', 'type', 'zip',
  ]);

  var IDENT_RE = /^[A-Za-z_]\w*$/;
  var REFACTOR_ACTIONS = [
    {
      id: 'sebook.refactor.rename',
      label: 'Refactor: Rename Symbol...',
      key: 'sebookCanRenameSymbol',
      prop: 'rename',
      order: 1,
      runner: 'runRename',
    },
    {
      id: 'sebook.refactor.extract',
      label: 'Refactor: Extract Function/Method...',
      key: 'sebookCanExtractFunction',
      prop: 'extract',
      order: 2,
      runner: 'runExtract',
    },
    {
      id: 'sebook.refactor.parameterObject',
      label: 'Refactor: Introduce Parameter Object...',
      key: 'sebookCanIntroduceParameterObject',
      prop: 'parameterObject',
      order: 3,
      runner: 'runParameterObject',
    },
    {
      id: 'sebook.refactor.extractClass',
      label: 'Refactor: Extract Class...',
      key: 'sebookCanExtractClass',
      prop: 'extractClass',
      order: 4,
      runner: 'runExtractClass',
    },
    {
      id: 'sebook.refactor.moveMethod',
      label: 'Refactor: Move Method...',
      key: 'sebookCanMoveMethod',
      prop: 'moveMethod',
      order: 5,
      runner: 'runMoveMethod',
    },
    {
      id: 'sebook.refactor.moveField',
      label: 'Refactor: Move Field...',
      key: 'sebookCanMoveField',
      prop: 'moveField',
      order: 6,
      runner: 'runMoveField',
    },
  ];
  var LanguageAdapters = {};
  var SCRIPT_URL = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var _styleInstalled = false;

  function attach(opts) {
    return new RefactoringController(opts || {});
  }

  function registerLanguageAdapter(language, adapter) {
    if (!language || !adapter) return;
    LanguageAdapters[language] = adapter;
  }

  function RefactoringController(opts) {
    this.monaco = opts.monaco || global.monaco;
    this.editors = opts.editors || [];
    this.getActiveFileName = opts.getActiveFileName || function () { return null; };
    this.getWorkspace = opts.getWorkspace;
    this.applyEdits = opts.applyEdits;
    this.notify = opts.notify || defaultNotify;
    this._disposables = [];
    installStyles();
    this.attachEditors(this.editors);
  }

  RefactoringController.prototype.attachEditors = function (editors) {
    var self = this;
    (editors || []).forEach(function (editor) {
      if (!editor || editor.__sebookRefactoringsAttached) return;
      editor.__sebookRefactoringsAttached = true;
      var contextKeys = createActionContextKeys(editor);
      editor.__sebookRefactoringContextKeys = contextKeys;
      setActionContextKeys(contextKeys, emptyActionAvailability());

      function updateContext() {
        self._scheduleAvailabilityRefresh(editor, contextKeys, 120);
      }
      updateContext();
      if (editor.onDidChangeModel) self._disposables.push(editor.onDidChangeModel(updateContext));
      if (editor.onDidChangeModelContent) self._disposables.push(editor.onDidChangeModelContent(updateContext));
      if (editor.onDidChangeCursorPosition) self._disposables.push(editor.onDidChangeCursorPosition(updateContext));
      if (editor.onDidChangeCursorSelection) self._disposables.push(editor.onDidChangeCursorSelection(updateContext));
      if (editor.onMouseDown) {
        self._disposables.push(editor.onMouseDown(function () {
          self._scheduleAvailabilityRefresh(editor, contextKeys, 0);
        }));
      }

      REFACTOR_ACTIONS.forEach(function (action) {
        self._addAction(editor, action, function () {
          return self[action.runner](editor);
        });
      });
    });
  };

  RefactoringController.prototype._addAction = function (editor, action, run) {
    if (!editor.addAction) return;
    editor.addAction({
      id: action.id,
      label: action.label,
      precondition: action.key,
      contextMenuGroupId: 'sebook-refactor',
      contextMenuOrder: action.order,
      run: run,
    });
  };

  RefactoringController.prototype._scheduleAvailabilityRefresh = function (editor, contextKeys, delay) {
    var self = this;
    if (!contextKeys) return;
    if (editor.__sebookRefactorAvailabilityTimer) {
      clearTimeout(editor.__sebookRefactorAvailabilityTimer);
    }
    editor.__sebookRefactorAvailabilityTimer = setTimeout(function () {
      self._refreshAvailability(editor, contextKeys);
    }, delay || 0);
  };

  RefactoringController.prototype._refreshAvailability = function (editor, contextKeys) {
    var self = this;
    var runId = (editor.__sebookRefactorAvailabilityRun || 0) + 1;
    editor.__sebookRefactorAvailabilityRun = runId;

    var model = editor.getModel && editor.getModel();
    var lang = model && model.getLanguageId ? model.getLanguageId() : '';
    var activeFile = this.getActiveFileName(editor) || '';
    if (!model || !isPythonFile(lang, activeFile)) {
      setActionContextKeys(contextKeys, emptyActionAvailability());
      return;
    }

    this._workspace(editor).then(function (workspace) {
      var file = workspace.activeFile || activeFile;
      var sourceFile = getWorkspaceFile(workspace, file);
      if (!sourceFile || !isPythonFile(sourceFile.language, sourceFile.filename)) {
        return null;
      }
      return self._pythonAnalysis(workspace).then(function (analysis) {
        var pos = editor.getPosition && editor.getPosition();
        var selection = editor.getSelection && editor.getSelection();
        var selectedIdentifier = selectedIdentifierFromSelection(sourceFile.content, selection);
        var wordInfo = model && pos ? model.getWordAtPosition(pos) : null;
        return computePythonActionAvailability(
          workspace,
          analysis,
          file,
          selectedIdentifier ? selectedIdentifier.position : pos,
          selection,
          selectedIdentifier ? selectedIdentifier.name : (wordInfo && wordInfo.word)
        );
      });
    }).then(function (availability) {
      if (editor.__sebookRefactorAvailabilityRun !== runId) return;
      setActionContextKeys(contextKeys, availability || emptyActionAvailability());
    }).catch(function (err) {
      if (editor.__sebookRefactorAvailabilityRun !== runId) return;
      setActionContextKeys(contextKeys, emptyActionAvailability());
      if (global.console && console.warn) console.warn('Refactoring availability failed:', err);
    });
  };

  RefactoringController.prototype._workspace = function (editor) {
    if (typeof this.getWorkspace !== 'function') {
      return Promise.reject(new Error('Refactoring workspace provider is not configured.'));
    }
    return Promise.resolve(this.getWorkspace({
      editor: editor,
      activeFile: this.getActiveFileName(editor),
    })).then(function (workspace) {
      workspace = workspace || {};
      workspace.files = workspace.files || [];
      if (!workspace.activeFile && workspace.files[0]) workspace.activeFile = workspace.files[0].filename;
      return workspace;
    });
  };

  RefactoringController.prototype._pythonAnalysis = function (workspace) {
    return PythonAstService.analyze(workspace);
  };

  RefactoringController.prototype._applyPlan = function (plan, workspace) {
    var self = this;
    if (!plan || !plan.edits || !plan.edits.length) {
      this.notify('No safe refactoring edits were produced.', 'warn');
      return Promise.resolve(false);
    }
    return showPreview(plan, workspace).then(function (accepted) {
      if (!accepted) return false;
      return Promise.resolve(self.applyEdits(plan.edits, plan)).then(function () {
        self.notify((plan.title || 'Refactoring') + ' applied.', 'ok');
        return true;
      });
    });
  };

  RefactoringController.prototype.runRename = function (editor, testOptions) {
    var self = this;
    testOptions = testOptions || {};
    return this._workspace(editor).then(function (workspace) {
      var file = workspace.activeFile || self.getActiveFileName(editor);
      var sourceFile = getWorkspaceFile(workspace, file);
      if (!sourceFile || !isPythonFile(sourceFile.language, sourceFile.filename)) {
        self.notify('Python refactorings are available in Python files.', 'warn');
        return false;
      }
      var model = editor.getModel();
      var pos = editor.getPosition();
      var wordInfo = model && pos ? model.getWordAtPosition(pos) : null;
      var oldName = wordInfo && wordInfo.word;
      if (!isIdentifier(oldName) || PYTHON_KEYWORDS.has(oldName)) {
        self.notify('Place the cursor on a Python identifier to rename it.', 'warn');
        return false;
      }
      return self._pythonAnalysis(workspace).then(function (analysis) {
        var ask = testOptions.newName
          ? Promise.resolve(testOptions.newName)
          : askText({
              title: 'Rename Symbol',
              label: 'New name',
              value: oldName,
              validate: function (value) {
                var msg = validateIdentifier(value);
                if (!msg && value === oldName) msg = 'Choose a different name.';
                if (!msg) {
                  msg = PythonAdapter.planRename(workspace, analysis, file, pos, oldName, value).error || '';
                }
                return msg;
              },
            });
        return ask.then(function (newName) {
          if (!newName || newName === oldName) return false;
          var plan = PythonAdapter.planRename(workspace, analysis, file, pos, oldName, newName);
          if (plan.error) { self.notify(plan.error, 'warn'); return false; }
          return self._applyPlan(plan, workspace);
        });
      });
    }).catch(function (err) {
      self.notify(err.message || String(err), 'bad');
      return false;
    });
  };

  RefactoringController.prototype.runExtract = function (editor, testOptions) {
    var self = this;
    testOptions = testOptions || {};
    return this._workspace(editor).then(function (workspace) {
      var file = workspace.activeFile || self.getActiveFileName(editor);
      var sourceFile = getWorkspaceFile(workspace, file);
      if (!sourceFile || !isPythonFile(sourceFile.language, sourceFile.filename)) {
        self.notify('Python refactorings are available in Python files.', 'warn');
        return false;
      }
      var selection = editor.getSelection && editor.getSelection();
      if (!selection || selection.isEmpty()) {
        self.notify('Select the statements to extract first.', 'warn');
        return false;
      }
      return self._pythonAnalysis(workspace).then(function (analysis) {
        var defaultName = PythonAdapter.defaultExtractName(workspace, file, selection);
        var ask = testOptions.name
          ? Promise.resolve(testOptions.name)
          : askText({
              title: 'Extract Function/Method',
              label: 'Function or method name',
              value: defaultName,
              validate: function (value) {
                return validateIdentifier(value)
                  || (PythonAdapter.planExtract(workspace, analysis, file, selection, value).error || '');
              },
            });
        return ask.then(function (name) {
          if (!name) return false;
          var plan = PythonAdapter.planExtract(workspace, analysis, file, selection, name);
          if (plan.error) { self.notify(plan.error, 'warn'); return false; }
          return self._applyPlan(plan, workspace);
        });
      });
    }).catch(function (err) {
      self.notify(err.message || String(err), 'bad');
      return false;
    });
  };

  RefactoringController.prototype.runParameterObject = function (editor, testOptions) {
    var self = this;
    testOptions = testOptions || {};
    return this._workspace(editor).then(function (workspace) {
      var file = workspace.activeFile || self.getActiveFileName(editor);
      var sourceFile = getWorkspaceFile(workspace, file);
      if (!sourceFile || !isPythonFile(sourceFile.language, sourceFile.filename)) {
        self.notify('Python refactorings are available in Python files.', 'warn');
        return false;
      }
      var pos = editor.getPosition();
      return self._pythonAnalysis(workspace).then(function (analysis) {
        var func = findAstFunctionAt(analysis, file, pos.lineNumber - 1);
        if (!func) {
          self.notify('Place the cursor inside the function or method to refactor.', 'warn');
          return false;
        }
        var defaultName = pascalCase(func.name) + 'Params';
        var dataParams = func.params.filter(function (p) { return p.name !== 'self' && p.name !== 'cls'; });
        var selection = editor.getSelection && editor.getSelection();
        var selectedParams = selectedParametersFromSelection(analysis, file, selection, sourceFile.content);
        var defaultSelectedParamNames = selectedParams.functionName === func.name && selectedParams.names.length >= 2
          ? selectedParams.names
          : dataParams.map(function (p) { return p.name; });
        var ask = testOptions.objectName
          ? Promise.resolve({
              objectName: testOptions.objectName,
              selectedParamNames: testOptions.selectedParamNames || defaultSelectedParamNames,
            })
          : askParameterObject({
              title: 'Introduce Parameter Object',
              objectName: defaultName,
              params: dataParams,
              selectedParamNames: defaultSelectedParamNames,
              validateState: function (state) {
                var plan = PythonAdapter.planParameterObject(
                  workspace,
                  analysis,
                  file,
                  pos,
                  state.objectName,
                  state.selectedParamNames
                );
                return plan.error || '';
              },
            });
        return ask.then(function (result) {
          if (!result || !result.objectName) return false;
          var plan = PythonAdapter.planParameterObject(
            workspace,
            analysis,
            file,
            pos,
            result.objectName,
            result.selectedParamNames
          );
          if (plan.error) { self.notify(plan.error, 'warn'); return false; }
          return self._applyPlan(plan, workspace);
        });
      });
    }).catch(function (err) {
      self.notify(err.message || String(err), 'bad');
      return false;
    });
  };

  RefactoringController.prototype.runExtractClass = function (editor, testOptions) {
    var self = this;
    testOptions = testOptions || {};
    return this._workspace(editor).then(function (workspace) {
      var file = workspace.activeFile || self.getActiveFileName(editor);
      var sourceFile = getWorkspaceFile(workspace, file);
      if (!sourceFile || !isPythonFile(sourceFile.language, sourceFile.filename)) {
        self.notify('Python refactorings are available in Python files.', 'warn');
        return false;
      }
      var pos = editor.getPosition();
      var selection = editor.getSelection && editor.getSelection();
      return self._pythonAnalysis(workspace).then(function (analysis) {
        var owner = findExtractClassOwner(analysis, file, pos, selection, sourceFile.content);
        if (!owner) {
          self.notify('Place the cursor inside a class or select class members to extract.', 'warn');
          return false;
        }
        var selected = extractClassSelectionFromEditor(analysis, file, owner, selection, sourceFile.content);
        var defaults = extractClassDefaultSelections(analysis, file, owner, selected);
        var ask = testOptions.className
          ? Promise.resolve({
              className: testOptions.className,
              delegateName: testOptions.delegateName || snakeCase(testOptions.className),
              selectedFieldNames: testOptions.selectedFieldNames || defaults.fieldNames,
              selectedMethodNames: testOptions.selectedMethodNames || defaults.methodNames,
            })
          : askExtractClass({
              title: 'Extract Class',
              ownerName: owner.name,
              className: defaultExtractClassName(owner.name),
              delegateName: snakeCase(defaultExtractClassName(owner.name)),
              fields: defaults.fields,
              methods: defaults.methods,
              selectedFieldNames: defaults.fieldNames,
              selectedMethodNames: defaults.methodNames,
              validateState: function (state) {
                var plan = PythonAdapter.planExtractClass(
                  workspace,
                  analysis,
                  file,
                  { lineNumber: owner.startLine + 1, column: owner.indent + 1 },
                  state.className,
                  state.delegateName,
                  state.selectedFieldNames,
                  state.selectedMethodNames
                );
                return plan.error || '';
              },
            });
        return ask.then(function (result) {
          if (!result || !result.className) return false;
          var plan = PythonAdapter.planExtractClass(
            workspace,
            analysis,
            file,
            { lineNumber: owner.startLine + 1, column: owner.indent + 1 },
            result.className,
            result.delegateName,
            result.selectedFieldNames,
            result.selectedMethodNames
          );
          if (plan.error) { self.notify(plan.error, 'warn'); return false; }
          return self._applyPlan(plan, workspace);
        });
      });
    }).catch(function (err) {
      self.notify(err.message || String(err), 'bad');
      return false;
    });
  };

  RefactoringController.prototype.runMoveMethod = function (editor, testOptions) {
    var self = this;
    testOptions = testOptions || {};
    return this._workspace(editor).then(function (workspace) {
      var file = workspace.activeFile || self.getActiveFileName(editor);
      var sourceFile = getWorkspaceFile(workspace, file);
      if (!sourceFile || !isPythonFile(sourceFile.language, sourceFile.filename)) {
        self.notify('Python refactorings are available in Python files.', 'warn');
        return false;
      }
      var pos = editor.getPosition();
      return self._pythonAnalysis(workspace).then(function (analysis) {
        var method = findAstFunctionAt(analysis, file, pos.lineNumber - 1);
        if (!method || !method.className) {
          self.notify('Place the cursor inside a Python method to move it.', 'warn');
          return false;
        }
        var targets = collectAnalysisClasses(analysis)
          .filter(function (c) { return !(c.name === method.className && c.filename === file); });
        if (!targets.length) {
          self.notify('No target class was found in this step.', 'warn');
          return false;
        }
        var labels = targets.map(function (c) { return classChoiceLabel(c, targets); });
        var choose = testOptions.targetClass
          ? Promise.resolve(testOptions.targetClass)
          : askChoice({
              title: 'Move Method',
              label: 'Target class',
              options: labels,
              validateChoice: function (targetChoice) {
                var target = targetFromChoice(targetChoice, targets, labels);
                return PythonAdapter.planMoveMethod(workspace, analysis, file, pos, target).error || '';
              },
            });
        return choose.then(function (targetChoice) {
          if (!targetChoice) return false;
          var target = targetFromChoice(targetChoice, targets, labels);
          var plan = PythonAdapter.planMoveMethod(workspace, analysis, file, pos, target);
          if (plan.error) { self.notify(plan.error, 'warn'); return false; }
          return self._applyPlan(plan, workspace);
        });
      });
    }).catch(function (err) {
      self.notify(err.message || String(err), 'bad');
      return false;
    });
  };

  RefactoringController.prototype.runMoveField = function (editor, testOptions) {
    var self = this;
    testOptions = testOptions || {};
    return this._workspace(editor).then(function (workspace) {
      var file = workspace.activeFile || self.getActiveFileName(editor);
      var sourceFile = getWorkspaceFile(workspace, file);
      if (!sourceFile || !isPythonFile(sourceFile.language, sourceFile.filename)) {
        self.notify('Python refactorings are available in Python files.', 'warn');
        return false;
      }
      var pos = editor.getPosition();
      var selection = editor.getSelection && editor.getSelection();
      return self._pythonAnalysis(workspace).then(function (analysis) {
        var selectedField = selectedSelfFieldAssignmentFromSelection(analysis, file, selection, sourceFile.content);
        var fieldPosition = selectedField
          ? { lineNumber: selectedField.range.startLine, column: selectedField.range.startCol + 1 }
          : pos;
        var ownerClass = findAstClassAt(analysis, file, fieldPosition.lineNumber - 1);
        var field = selectedField || findAstSelfFieldAssignmentAt(analysis, file, fieldPosition.lineNumber - 1);
        if (!ownerClass || !field) {
          self.notify('Place the cursor on a simple self.field assignment to move it.', 'warn');
          return false;
        }
        var targets = collectAnalysisClasses(analysis)
          .filter(function (c) { return !(c.name === ownerClass.name && c.filename === file); });
        if (!targets.length) {
          self.notify('No target class was found in this step.', 'warn');
          return false;
        }
        var labels = targets.map(function (c) { return classChoiceLabel(c, targets); });
        var choose = testOptions.targetClass
          ? Promise.resolve(testOptions.targetClass)
          : askChoice({
              title: 'Move Field',
              label: 'Target class',
              options: labels,
              validateChoice: function (targetChoice) {
                var target = targetFromChoice(targetChoice, targets, labels);
                return PythonAdapter.planMoveField(workspace, analysis, file, fieldPosition, target).error || '';
              },
            });
        return choose.then(function (targetChoice) {
          if (!targetChoice) return false;
          var target = targetFromChoice(targetChoice, targets, labels);
          var plan = PythonAdapter.planMoveField(workspace, analysis, file, fieldPosition, target);
          if (plan.error) { self.notify(plan.error, 'warn'); return false; }
          return self._applyPlan(plan, workspace);
        });
      });
    }).catch(function (err) {
      self.notify(err.message || String(err), 'bad');
      return false;
    });
  };

  RefactoringController.prototype.dispose = function () {
    this._disposables.forEach(function (d) {
      if (d && d.dispose) d.dispose();
    });
    this._disposables = [];
  };

  /* ------------------------------------------------------------------------ */
  /* Popup helper                                                             */
  /* ------------------------------------------------------------------------ */

  function createPopupHost(client, opts) {
    opts = opts || {};
    var pending = {};

    function request(type, payload, responseType) {
      var requestId = 'rf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      payload = payload || {};
      payload.requestId = requestId;
      payload.role = client.role;
      if (typeof opts.getActiveFileName === 'function') payload.activeFile = opts.getActiveFileName();
      if (typeof opts.getActiveContent === 'function') payload.activeContent = opts.getActiveContent();
      return new Promise(function (resolve, reject) {
        pending[requestId] = {
          responseType: responseType,
          resolve: resolve,
          reject: reject,
          timer: setTimeout(function () {
            delete pending[requestId];
            reject(new Error('Refactoring request timed out.'));
          }, 8000),
        };
        client.post(type, payload);
      });
    }

    return {
      getWorkspace: function () {
        if (typeof opts.flush === 'function') opts.flush();
        return request('request-refactor-workspace', {}, 'refactor-workspace')
          .then(function (msg) { return msg.workspace; });
      },
      applyEdits: function (edits, plan) {
        if (typeof opts.flush === 'function') opts.flush();
        return request('apply-refactor-edits', {
          edits: edits || [],
          meta: {
            title: plan && plan.title,
            changedFiles: unique((edits || []).map(function (e) { return e.filename; })),
          },
        }, 'refactor-applied').then(function (msg) {
          if (msg && msg.error) throw new Error(msg.error);
          return msg;
        });
      },
      handleMessage: function (msg) {
        if (!msg || !msg.requestId || !pending[msg.requestId]) return false;
        if (msg.targetSourceId && msg.targetSourceId !== client.sourceId) return false;
        var p = pending[msg.requestId];
        if (msg.type !== p.responseType) return false;
        clearTimeout(p.timer);
        delete pending[msg.requestId];
        if (msg.ok === false) p.reject(new Error(msg.error || 'Refactoring failed.'));
        else p.resolve(msg);
        return true;
      },
    };
  }

  var PythonAstService = (function () {
    var worker = null;
    var nextId = 1;
    var pending = {};
    var cacheKey = '';
    var cacheValue = null;

    function ensureWorker() {
      if (worker) return worker;
      worker = new Worker(pythonAstWorkerUrl());
      worker.onmessage = function (event) {
        var msg = event.data || {};
        if (msg.type !== 'analysis' || !pending[msg.id]) return;
        var entry = pending[msg.id];
        clearTimeout(entry.timer);
        delete pending[msg.id];
        if (msg.ok) entry.resolve(msg.analysis);
        else entry.reject(new Error(msg.error || 'Python AST analysis failed.'));
      };
      worker.onerror = function (event) {
        Object.keys(pending).forEach(function (id) {
          pending[id].reject(new Error(event.message || 'Python AST worker failed.'));
        });
        pending = {};
      };
      return worker;
    }

    function keyFor(workspace) {
      return (workspace.files || []).map(function (f) {
        return f.filename + ':' + (f.content || '').length + ':' + hashString(f.content || '');
      }).join('|');
    }

    function analyze(workspace) {
      var key = keyFor(workspace);
      if (cacheValue && key === cacheKey) return Promise.resolve(cacheValue);
      var id = nextId++;
      var files = (workspace.files || []).filter(function (f) {
        return isPythonFile(f.language, f.filename);
      });
      return new Promise(function (resolve, reject) {
        pending[id] = {
          resolve: function (analysis) {
            cacheKey = key;
            cacheValue = analysis;
            resolve(analysis);
          },
          reject: reject,
          timer: setTimeout(function () {
            delete pending[id];
            reject(new Error('Python AST analysis timed out.'));
          }, 60000),
        };
        ensureWorker().postMessage({ type: 'analyze', id: id, files: files });
      });
    }

    return { analyze: analyze };
  })();

  /* ------------------------------------------------------------------------ */
  /* Python adapter                                                           */
  /* ------------------------------------------------------------------------ */

  var PythonAdapter = {
    defaultExtractName: function () { return 'extracted_code'; },

    planRename: function (workspace, analysis, activeFile, position, oldName, newName) {
      if (!isIdentifier(newName)) return { error: 'Use a valid Python identifier.' };
      var scope = inferRenameScopeFromAnalysis(analysis, activeFile, position, oldName);
      if (!scope) return { error: 'Place the cursor on a Python symbol to rename it.' };
      var conflict = renameConflictFromAnalysis(analysis, activeFile, scope, oldName, newName);
      if (conflict) return { error: conflict };
      var hazardError = renameDynamicHazardError(analysis, activeFile, oldName);
      if (hazardError) return { error: hazardError };
      var warnings = collectRenameDynamicWarnings(analysis, activeFile, oldName);
      var edits = [];
      workspace.files.forEach(function (f) {
        if (!isPythonFile(f.language, f.filename)) return;
        var fileAnalysis = analysisFile(analysis, f.filename);
        (fileAnalysis && fileAnalysis.symbols || []).forEach(function (symbol) {
          if (symbol.name !== oldName) return;
          if (!symbolMatchesRenameScope(scope, symbol, f.filename)) return;
          edits.push({
            filename: f.filename,
            range: astRangeToMonaco(symbol.range),
            text: newName,
          });
        });
        if (scope.type === 'local' && scope.kind === 'parameter' && !scope.className) {
          edits = edits.concat(keywordRenameEditsForFunction(
            fileAnalysis,
            f.filename,
            activeFile,
            scope.scope,
            oldName,
            newName
          ));
        }
      });
      var plan = {
        title: 'Rename ' + oldName + ' to ' + newName,
        edits: edits,
        summary: 'Renames Python identifier occurrences in the safe detected scope.',
      };
      if (warnings.length) plan.warnings = warnings;
      return plan;
    },

    planExtract: function (workspace, analysis, activeFile, selection, name) {
      if (!isIdentifier(name)) return { error: 'Use a valid Python identifier.' };
      var file = getWorkspaceFile(workspace, activeFile);
      if (!file) return { error: 'Select complete Python statements to extract.' };
      var lines = file.content.split('\n');
      var preciseSelection = selectedStatementBoundsFromAnalysis(analysis, activeFile, selection, file.content);
      if (preciseSelection.error) return { error: preciseSelection.error };
      var start = preciseSelection.startLine;
      var end = preciseSelection.endLine;
      var container = findAstFunctionAt(analysis, activeFile, start) || findAstClassAt(analysis, activeFile, start);
      if (container && end > container.endLine) {
        return { error: 'The selected statements must stay inside one block.' };
      }
      if (containsUnsafeExtractStatementFromAnalysis(analysis, activeFile, start, end)) {
        return { error: 'Selections containing return, break, continue, or yield are not extracted yet.' };
      }
      var baseIndent = minIndent(lines, start, end);
      if (baseIndent < 0) return { error: 'Select at least one non-empty statement.' };
      for (var i = start; i <= end; i++) {
        if (trimCode(lines[i]) && indentOf(lines[i]) < baseIndent) {
          return { error: 'Select complete statements with consistent indentation.' };
        }
      }

      var functionContainer = findAstFunctionAt(analysis, activeFile, start);
      if (functionContainer && functionContainer.async) {
        return { error: 'Async function extraction is not supported yet.' };
      }
      if (helperNameConflicts(analysis, activeFile, functionContainer, name)) {
        return { error: 'A symbol named ' + name + ' already exists in this scope.' };
      }
      var isMethod = !!(functionContainer && functionContainer.className);
      var firstParam = functionContainer && functionContainer.params && functionContainer.params[0];
      var receiverName = isMethod && firstParam && (firstParam.name === 'self' || firstParam.name === 'cls')
        ? firstParam.name
        : null;
      var declaredBefore = collectDeclaredBeforeFromAnalysis(analysis, activeFile, functionContainer, start);
      var selectedIds = collectSymbolsInRange(analysis, activeFile, start, end, 'load', functionContainer);
      var assignedInside = collectSymbolsInRange(analysis, activeFile, start, end, 'store', functionContainer);
      var usedAfter = collectSymbolsInRange(
        analysis,
        activeFile,
        end + 1,
        functionContainer ? functionContainer.endLine : lines.length - 1,
        'load',
        functionContainer
      );
      var params = [];
      selectedIds.forEach(function (id) {
        if (receiverName && id === receiverName) return;
        if (declaredBefore.has(id) && !assignedInside.has(id) && !PYTHON_BUILTINS.has(id)) params.push(id);
      });
      var outputs = [];
      assignedInside.forEach(function (id) {
        if (usedAfter.has(id)) outputs.push(id);
      });

      var helperIndent = isMethod ? (functionContainer.indent || 0) : 0;
      var bodyIndent = helperIndent + 4;
      var selectedBody = lines.slice(start, end + 1)
        .map(function (ln) { return repeat(' ', bodyIndent) + stripIndent(ln, baseIndent); });
      if (outputs.length === 1) selectedBody.push(repeat(' ', bodyIndent) + 'return ' + outputs[0]);
      else if (outputs.length > 1) selectedBody.push(repeat(' ', bodyIndent) + 'return ' + outputs.join(', '));

      var annotationMap = {};
      if (functionContainer && functionContainer.params) {
        functionContainer.params.forEach(function (p) {
          if (p.annotation) annotationMap[p.name] = p.annotation;
        });
      }
      var helperParams = params.map(function (paramName) {
        return annotationMap[paramName] ? (paramName + ': ' + annotationMap[paramName]) : paramName;
      });
      if (receiverName) helperParams.unshift(receiverName);
      var returnAnnotation = outputs.length === 0 ? ' -> None' : '';
      var helperLines = [
        repeat(' ', helperIndent) + 'def ' + name + '(' + helperParams.join(', ') + ')' + returnAnnotation + ':',
      ].concat(selectedBody);

      var callExpr = (receiverName ? receiverName + '.' : '') + name + '(' + params.join(', ') + ')';
      var callLine;
      if (outputs.length === 1) callLine = repeat(' ', baseIndent) + outputs[0] + ' = ' + callExpr;
      else if (outputs.length > 1) callLine = repeat(' ', baseIndent) + outputs.join(', ') + ' = ' + callExpr;
      else callLine = repeat(' ', baseIndent) + callExpr;

      var replaceEdit = {
        filename: file.filename,
        range: lineRange(lines, start, end),
        text: callLine,
        oldText: lines.slice(start, end + 1).join('\n'),
      };
      var insertAfter = functionContainer ? functionContainer.endLine : end;
      var helperInsertion = '\n\n' + helperLines.join('\n');
      if (insertAfter + 1 < lines.length) helperInsertion += '\n';
      var insertEdit = {
        filename: file.filename,
        range: insertionRangeAtLineEnd(lines, insertAfter),
        text: helperInsertion,
        oldText: '',
      };

      return {
        title: 'Extract ' + name,
        summary: 'Creates a parameterized Python ' + (isMethod ? 'method' : 'function') + '.',
        edits: [replaceEdit, insertEdit],
      };
    },

    planParameterObject: function (workspace, analysis, activeFile, position, objectName, selectedParamNames) {
      if (!/^[A-Z]\w*$/.test(objectName)) {
        return { error: 'Use a class-style name such as PaymentParams.' };
      }
      var file = getWorkspaceFile(workspace, activeFile);
      var func = findAstFunctionAt(analysis, activeFile, position.lineNumber - 1);
      if (!func) return { error: 'Place the cursor inside the function or method to refactor.' };
      if (hasVarArgsOrKwargs(func)) {
        return { error: 'Introduce Parameter Object does not support *args or **kwargs yet.' };
      }
      if (hasKeywordOnlyParams(func)) {
        return { error: 'Introduce Parameter Object does not support keyword-only parameters yet.' };
      }
      if (symbolExistsInFile(analysisFile(analysis, activeFile), objectName)) {
        return { error: 'A symbol named ' + objectName + ' already exists in this file.' };
      }
      if (hasWildcardImportFromSource(analysis, file.filename)) {
        return { error: 'Wildcard imports from this module make call-site rewriting unsafe.' };
      }
      var selectedNameSet = new Set(selectedParamNames || []);
      var hasExplicitSelection = selectedNameSet.size > 0;
      var selected = [];
      func.params.forEach(function (p) {
        if (p.name === 'self' || p.name === 'cls') return;
        if (!hasExplicitSelection || selectedNameSet.has(p.name)) selected.push(p);
      });
      if (selected.length < 2) {
        return { error: 'Select at least two parameters that travel together.' };
      }
      var unsupportedDefault = selected.filter(function (param) {
        return param.default && !isSupportedParamDefault(param.default);
      })[0];
      if (unsupportedDefault) {
        return {
          error: 'Introduce Parameter Object cannot move parameter ' + unsupportedDefault.name
            + ' because its default ' + unsupportedDefault.default + ' is not a literal or empty container.',
        };
      }
      var variableName = snakeCase(objectName);
      var edits = [];
      workspace.files.forEach(function (f) {
        if (!isPythonFile(f.language, f.filename)) return;
        var fileAnalysis = analysisFile(analysis, f.filename);
        var newContent = rewriteCallsForParameterObject(
          f.content,
          fileAnalysis,
          f.filename,
          file.filename,
          func,
          selected,
          objectName,
          variableName
        );
        if (f.filename === file.filename) {
          newContent = rewriteDefinitionForParameterObject(
            newContent,
            fileAnalysis,
            func,
            selected,
            objectName,
            variableName
          );
          newContent = ensureDataclassObject(newContent, fileAnalysis, func, selected, objectName);
        } else if (newContent !== f.content) {
          newContent = ensureParameterObjectImport(newContent, fileAnalysis, file.filename, objectName);
        }
        if (newContent !== f.content) edits.push(fullFileEdit(f.filename, f.content, newContent));
      });
      return {
        title: 'Introduce ' + objectName,
        summary: 'Rewrites the function signature and call sites in all files listed for this step.',
        edits: edits,
      };
    },

    planExtractClass: function (
      workspace,
      analysis,
      activeFile,
      position,
      className,
      delegateName,
      selectedFieldNames,
      selectedMethodNames
    ) {
      var classNameError = validateClassName(className);
      if (classNameError) return { error: classNameError };
      if (!isIdentifier(delegateName)) return { error: 'Use a valid Python attribute name for the delegate.' };
      var file = getWorkspaceFile(workspace, activeFile);
      if (!file) return { error: 'Select class members to extract.' };
      var fileAnalysis = analysisFile(analysis, activeFile);
      var owner = findAstClassAt(analysis, activeFile, position.lineNumber - 1);
      if (!owner) return { error: 'Place the cursor inside the class to extract from.' };
      if (symbolExistsInFile(fileAnalysis, className)) {
        return { error: 'A symbol named ' + className + ' already exists in this file.' };
      }
      var selected = resolveExtractClassMembers(
        analysis,
        activeFile,
        owner,
        selectedFieldNames || [],
        selectedMethodNames || []
      );
      var selectedFieldNameSet = new Set(selectedFieldNames || []);
      var selectedMethodNameSet = new Set(selectedMethodNames || []);
      if (selected.fields.length !== selectedFieldNameSet.size) {
        return { error: 'Extract Class can only move fields assigned directly on self in __init__.' };
      }
      if (selected.methods.length !== selectedMethodNameSet.size) {
        return { error: 'Extract Class can only move methods defined directly on the source class.' };
      }
      var safety = unsafeExtractClassReason(analysis, activeFile, owner, selected, className, delegateName);
      if (safety) return { error: safety };

      var newContents = {};
      workspace.files.forEach(function (f) { newContents[f.filename] = f.content; });
      Object.keys(newContents).forEach(function (filename) {
        if (!isPythonFile('', filename)) return;
        var currentAnalysis = analysisFile(analysis, filename);
        newContents[filename] = rewriteExtractedClassMethodCallSites(
          newContents[filename],
          currentAnalysis,
          owner,
          activeFile,
          selected.methods.map(function (method) { return method.name; }),
          delegateName
        );
        newContents[filename] = rewriteExtractedClassFieldReferences(
          newContents[filename],
          currentAnalysis,
          filename,
          owner,
          activeFile,
          selected,
          delegateName
        );
      });
      newContents[activeFile] = extractClassInSourceFile(
        file.content,
        newContents[activeFile],
        analysis,
        activeFile,
        owner,
        selected,
        className,
        delegateName
      );

      var edits = [];
      workspace.files.forEach(function (f) {
        if (newContents[f.filename] !== f.content) {
          edits.push(fullFileEdit(f.filename, f.content, newContents[f.filename]));
        }
      });
      return {
        title: 'Extract ' + className,
        summary: 'Extracts selected Python fields and methods into a new class.',
        edits: edits,
      };
    },

    planMoveMethod: function (workspace, analysis, activeFile, position, targetClass) {
      var file = getWorkspaceFile(workspace, activeFile);
      var method = findAstFunctionAt(analysis, activeFile, position.lineNumber - 1);
      var target = normalizeAnalysisTargetClass(analysis, targetClass);
      if (!method || !method.className) return { error: 'Place the cursor inside a method to move it.' };
      if (!target) return { error: 'Target class not found in this step.' };
      if (method.className === target.name && file.filename === target.filename) {
        return { error: 'Choose a different target class.' };
      }
      var moveSafety = unsafeMoveMethodReason(analysis, activeFile, method);
      if (moveSafety) return { error: moveSafety };
      var targetParam = inferMoveTargetParam(method, target.name);
      if (!targetParam) {
        return { error: 'Move Method needs a parameter whose type or name matches the target class.' };
      }
      var newContents = {};
      workspace.files.forEach(function (f) { newContents[f.filename] = f.content; });

      if (targetParam) {
        workspace.files.forEach(function (f) {
          var fileAnalysis = analysisFile(analysis, f.filename);
          newContents[f.filename] = rewriteMovedMethodCallSites(
            newContents[f.filename],
            fileAnalysis,
            method,
            method.name,
            method.params,
            targetParam.name
          );
        });
      }

      var sourceLines = newContents[file.filename].split('\n');
      var methodLines = sourceLines.slice(method.startLine, method.endLine + 1);
      var wrapperLines = buildMoveMethodWrapper(methodLines, method, targetParam);
      sourceLines.splice(method.startLine, method.endLine - method.startLine + 1, wrapperLines.join('\n'));
      newContents[file.filename] = sourceLines.join('\n');
      var lineDelta = wrapperLines.length - (method.endLine - method.startLine + 1);

      if (targetParam) {
        methodLines[0] = removeParamFromHeader(methodLines[0], targetParam.name);
        methodLines = replaceNameReferencesInMethodBody(
          methodLines,
          analysis,
          activeFile,
          method,
          targetParam.name,
          'self'
        );
      }

      var targetNode = {
        name: target.name,
        startLine: target.startLine,
        endLine: target.endLine,
        indent: target.indent || 0,
      };
      if (target.filename === file.filename && method.startLine < target.startLine) {
        targetNode.startLine += lineDelta;
        targetNode.endLine += lineDelta;
      }
      var block = methodLines
        .map(function (ln) { return repeat(' ', targetNode.indent + 4) + stripIndent(ln, method.indent); });
      var targetLines = newContents[target.filename].split('\n');
      targetLines.splice(targetNode.endLine + 1, 0, '', block.join('\n'));
      newContents[target.filename] = targetLines.join('\n');

      var edits = [];
      workspace.files.forEach(function (f) {
        if (newContents[f.filename] !== f.content) {
          edits.push(fullFileEdit(f.filename, f.content, newContents[f.filename]));
        }
      });
      return {
        title: 'Move ' + method.name + ' to ' + target.name,
        summary: 'Moves the method and rewrites straightforward call sites in all files listed for this step.',
        edits: edits,
      };
    },

    planMoveField: function (workspace, analysis, activeFile, position, targetClass) {
      var file = getWorkspaceFile(workspace, activeFile);
      var owner = findAstClassAt(analysis, activeFile, position.lineNumber - 1);
      var target = normalizeAnalysisTargetClass(analysis, targetClass);
      var lines = file.content.split('\n');
      var lineIdx = position.lineNumber - 1;
      var assignment = findAstSelfFieldAssignmentAt(analysis, activeFile, lineIdx);
      if (!owner || !target || !assignment) {
        return { error: 'Place the cursor on a simple self.field assignment.' };
      }
      var fieldSafety = unsafeMoveFieldReason(analysis, activeFile, owner, assignment, target);
      if (fieldSafety) return { error: fieldSafety };
      if (!isSimpleMovableAssignment(assignment)) {
        return { error: 'Move Field currently supports literal or constructor-style initializers only.' };
      }
      if (!target) return { error: 'Target class not found in this step.' };
      var referencePlan = planMoveFieldReferenceRewrites(analysis, activeFile, owner, assignment, target);
      if (referencePlan.error) return { error: referencePlan.error };
      var newContents = {};
      workspace.files.forEach(function (f) { newContents[f.filename] = f.content; });
      Object.keys(referencePlan.replacementsByFile || {}).forEach(function (filename) {
        newContents[filename] = applyAstRangeReplacements(
          newContents[filename],
          referencePlan.replacementsByFile[filename]
        );
      });
      var sourceLines = newContents[file.filename].split('\n');
      sourceLines.splice(lineIdx, 1);
      newContents[file.filename] = sourceLines.join('\n');

      var targetNode = {
        name: target.name,
        startLine: target.startLine,
        endLine: target.endLine,
        indent: target.indent || 0,
      };
      if (target.filename === file.filename && lineIdx < target.startLine) {
        targetNode.startLine -= 1;
        targetNode.endLine -= 1;
      }
      var targetLines = newContents[target.filename].split('\n');
      var targetMethods = (analysisFile(analysis, target.filename).functions || []).filter(function (fn) {
        return fn.className === target.name;
      });
      var init = targetMethods.filter(function (fn) { return fn.name === '__init__'; })[0];
      var insertLine = repeat(' ', (targetNode.indent || 0) + 8) + 'self.' + assignment.name + ' = ' + assignment.value;
      if (init) {
        var initEnd = init.endLine - 1;
        if (target.filename === file.filename && lineIdx < initEnd) initEnd -= 1;
        targetLines.splice(initEnd + 1, 0, insertLine);
      } else {
        var passLine = findRemovableClassPassLine(analysis, target.filename, target);
        if (target.filename === file.filename && lineIdx < passLine) passLine -= 1;
        if (passLine !== -1) targetLines.splice(passLine, 1);
        var insertAt = targetNode.startLine + 1;
        var initBlock = [
          repeat(' ', (targetNode.indent || 0) + 4) + 'def __init__(self):',
          insertLine,
        ];
        if (insertAt < targetLines.length && trimCode(targetLines[insertAt] || '') !== '') initBlock.push('');
        targetLines.splice(insertAt, 0, initBlock.join('\n'));
      }
      newContents[target.filename] = targetLines.join('\n');
      var edits = [];
      workspace.files.forEach(function (f) {
        if (newContents[f.filename] !== f.content) {
          edits.push(fullFileEdit(f.filename, f.content, newContents[f.filename]));
        }
      });
      return {
        title: 'Move field ' + assignment.name + ' to ' + target.name,
        summary: 'Moves a simple instance-field initializer to the target class and rewrites straightforward references.',
        edits: edits,
      };
    },
  };

  registerLanguageAdapter('python', PythonAdapter);

  function pythonAstWorkerUrl() {
    if (SCRIPT_URL && global.URL) {
      return new global.URL('python-ast-worker.js', SCRIPT_URL).href;
    }
    return '/js/python-ast-worker.js';
  }

  /* ------------------------------------------------------------------------ */
  /* Python parsing and text utilities                                         */
  /* ------------------------------------------------------------------------ */

  function analysisFile(analysis, filename) {
    return analysis && analysis.files ? analysis.files[filename] : null;
  }

  function findAstFunctionAt(analysis, filename, lineIdx) {
    var file = analysisFile(analysis, filename);
    if (!file) return null;
    var line = lineIdx + 1;
    var best = null;
    (file.functions || []).forEach(function (fn) {
      if (line >= fn.startLine && line <= fn.endLine) {
        if (!best || fn.col >= best.col) best = fn;
      }
    });
    return best ? normalizeAstBlock(best) : null;
  }

  function findAstClassAt(analysis, filename, lineIdx) {
    var file = analysisFile(analysis, filename);
    if (!file) return null;
    var line = lineIdx + 1;
    var best = null;
    (file.classes || []).forEach(function (cls) {
      if (line >= cls.startLine && line <= cls.endLine) {
        if (!best || cls.col >= best.col) best = cls;
      }
    });
    return best ? normalizeAstBlock(best) : null;
  }

  function normalizeAstBlock(node) {
    var copy = {};
    for (var k in node) copy[k] = node[k];
    copy.startLine = (node.startLine || 1) - 1;
    copy.endLine = (node.endLine || node.startLine || 1) - 1;
    if (node.classStartLine) copy.classStartLine = node.classStartLine - 1;
    copy.indent = node.col || 0;
    return copy;
  }

  function collectAnalysisClasses(analysis) {
    var out = [];
    if (!analysis || !analysis.files) return out;
    Object.keys(analysis.files).forEach(function (filename) {
      (analysis.files[filename].classes || []).forEach(function (cls) {
        out.push({
          name: cls.name,
          filename: filename,
          startLine: cls.startLine - 1,
          endLine: cls.endLine - 1,
          indent: cls.col || 0,
        });
      });
    });
    return out;
  }

  function astRangeToMonaco(range) {
    return {
      startLineNumber: range.startLine,
      startColumn: range.startCol + 1,
      endLineNumber: range.endLine,
      endColumn: range.endCol + 1,
    };
  }

  function emptyActionAvailability() {
    return {
      rename: false,
      extract: false,
      parameterObject: false,
      extractClass: false,
      moveMethod: false,
      moveField: false,
    };
  }

  function createActionContextKeys(editor) {
    var keys = {};
    if (!editor.createContextKey) return keys;
    REFACTOR_ACTIONS.forEach(function (action) {
      keys[action.prop] = editor.createContextKey(action.key, false);
    });
    return keys;
  }

  function setActionContextKeys(keys, availability) {
    availability = availability || emptyActionAvailability();
    REFACTOR_ACTIONS.forEach(function (action) {
      if (keys && keys[action.prop]) keys[action.prop].set(!!availability[action.prop]);
    });
  }

  function computePythonActionAvailability(workspace, analysis, activeFile, position, selection, oldName) {
    var availability = emptyActionAvailability();
    var file = getWorkspaceFile(workspace, activeFile);
    if (!file || !isPythonFile(file.language, file.filename) || !analysisFile(analysis, activeFile)) {
      return availability;
    }

    var selectedIdentifier = selectedIdentifierFromSelection(file.content, selection);
    var selectedParams = selectedParametersFromSelection(analysis, activeFile, selection, file.content);
    var selectionOwner = findExtractClassOwner(analysis, activeFile, position, selection, file.content);
    var selectedClassMembers = selectionOwner
      ? extractClassSelectionFromEditor(analysis, activeFile, selectionOwner, selection, file.content)
      : { fields: [], methods: [] };
    var selectedFieldAssignment = selectedSelfFieldAssignmentFromSelection(analysis, activeFile, selection, file.content);
    var hasBlockSelection = selectionHasText(selection) && !selectedIdentifier;
    if (hasBlockSelection) {
      availability.extract = !PythonAdapter.planExtract(
        workspace,
        analysis,
        activeFile,
        selection,
        PythonAdapter.defaultExtractName()
      ).error;
      if (selectedParams.names.length >= 2) {
        availability.parameterObject = !PythonAdapter.planParameterObject(
          workspace,
          analysis,
          activeFile,
          {
            lineNumber: selectedParams.functionStartLine + 1,
            column: 1,
          },
          defaultParameterObjectName(selectedParams.functionName),
          selectedParams.names
        ).error;
      }
      if (selectionOwner && (selectedClassMembers.fields.length || selectedClassMembers.methods.length)) {
        var classCandidates = extractClassAllCandidates(analysis, activeFile, selectionOwner);
        availability.extractClass = classCandidates.fields.length > 0
          && classCandidates.fields.length + classCandidates.methods.length >= 2;
      }
      if (selectedFieldAssignment) {
        var selectedFieldLine = selectedFieldAssignment.range.startLine - 1;
        var selectedFieldOwner = findAstClassAt(analysis, activeFile, selectedFieldLine);
        var selectedFieldTargets = collectAnalysisClasses(analysis);
        availability.moveField = canMoveFieldToAnyTarget(
          analysis,
          activeFile,
          selectedFieldOwner,
          selectedFieldAssignment,
          selectedFieldTargets
        );
      }
      return availability;
    }

    var symbolName = selectedIdentifier ? selectedIdentifier.name : oldName;
    var symbolPosition = selectedIdentifier ? selectedIdentifier.position : position;
    if (isIdentifier(symbolName) && !PYTHON_KEYWORDS.has(symbolName)) {
      availability.rename = !!inferRenameScopeFromAnalysis(analysis, activeFile, symbolPosition, symbolName);
    }

    var lineIdx = symbolPosition && symbolPosition.lineNumber ? symbolPosition.lineNumber - 1 : 0;
    var fn = findAstFunctionAt(analysis, activeFile, lineIdx);
    var dataParams = fn && fn.params
      ? fn.params.filter(function (p) { return p.name !== 'self' && p.name !== 'cls'; })
      : [];
    availability.parameterObject = !!(fn && dataParams.length >= 2 && !PythonAdapter.planParameterObject(
      workspace,
      analysis,
      activeFile,
      symbolPosition || { lineNumber: fn.startLine + 1, column: 1 },
      defaultParameterObjectName(fn.name),
      selectedParams.names
    ).error);

    var ownerForExtractClass = findAstClassAt(analysis, activeFile, lineIdx);
    if (ownerForExtractClass) {
      var extractDefaults = extractClassDefaultSelections(
        analysis,
        activeFile,
        ownerForExtractClass,
        { fields: [], methods: [] }
      );
      availability.extractClass = extractDefaults.fields.length + extractDefaults.methods.length >= 2;
    }

    var targetClasses = collectAnalysisClasses(analysis);
    availability.moveMethod = !!(fn && fn.className && targetClasses.some(function (target) {
      return !(target.name === fn.className && target.filename === activeFile)
        && !unsafeMoveMethodReason(analysis, activeFile, fn)
        && !!inferMoveTargetParam(fn, target.name);
    }));

    var owner = findAstClassAt(analysis, activeFile, lineIdx);
    var assignment = findAstSelfFieldAssignmentAt(analysis, activeFile, lineIdx);
    availability.moveField = canMoveFieldToAnyTarget(analysis, activeFile, owner, assignment, targetClasses);

    return availability;
  }

  function canMoveFieldToAnyTarget(analysis, activeFile, owner, assignment, targetClasses) {
    return !!(owner
      && assignment
      && isSimpleMovableAssignment(assignment)
      && (targetClasses || []).some(function (target) {
        return !(target.name === owner.name && target.filename === activeFile)
          && !unsafeMoveFieldReason(analysis, activeFile, owner, assignment, target)
          && !planMoveFieldReferenceRewrites(analysis, activeFile, owner, assignment, target).error;
      }));
  }

  function findAstSymbolAtPosition(analysis, filename, position, name) {
    var file = analysisFile(analysis, filename);
    if (!file || !position) return null;
    var line = position.lineNumber || 1;
    var col = (position.column || 1) - 1;
    var matches = (file.symbols || []).filter(function (symbol) {
      return symbol.name === name && symbol.range && rangeContainsPosition(symbol.range, line, col);
    });
    matches.sort(function (a, b) {
      return rangeSize(a.range) - rangeSize(b.range);
    });
    if (matches[0]) return matches[0];
    matches = (file.symbols || []).filter(function (symbol) {
      if (symbol.kind !== 'attribute' || symbol.name !== name || !symbol.range || !symbol.receiver) return false;
      if (symbol.range.startLine !== line) return false;
      var expressionStartCol = Math.max(0, symbol.range.startCol - symbol.receiver.length - 1);
      return rangeContainsPosition({
        startLine: symbol.range.startLine,
        startCol: expressionStartCol,
        endLine: symbol.range.endLine,
        endCol: symbol.range.endCol,
      }, line, col);
    });
    matches.sort(function (a, b) {
      return rangeSize(a.range) - rangeSize(b.range);
    });
    return matches[0] || null;
  }

  function rangeContainsPosition(range, line, col) {
    if (line < range.startLine || line > range.endLine) return false;
    if (line === range.startLine && col < range.startCol) return false;
    if (line === range.endLine && col > range.endCol) return false;
    return true;
  }

  function rangeSize(range) {
    return (range.endLine - range.startLine) * 10000 + (range.endCol - range.startCol);
  }

  function selectionHasText(selection) {
    var normalized = normalizeSelection(selection);
    return !!(normalized && !normalized.empty);
  }

  function selectedIdentifierFromSelection(content, selection) {
    var normalized = normalizeSelection(selection, content);
    if (!normalized || normalized.empty || normalized.startLine !== normalized.endLine) return null;
    var line = (content.split('\n')[normalized.startLine - 1] || '');
    var selected = line.slice(normalized.startCol, normalized.endCol);
    if (!isIdentifier(selected)) return null;
    return {
      name: selected,
      position: {
        lineNumber: normalized.startLine,
        column: normalized.startCol + 1,
      },
    };
  }

  function selectedParametersFromSelection(analysis, filename, selection, content) {
    var normalized = normalizeSelection(selection, content);
    var out = { names: [], functionName: '', functionStartLine: null };
    if (!normalized || normalized.empty) return out;
    var file = analysisFile(analysis, filename);
    if (!file) return out;
    var selected = [];
    (file.functions || []).forEach(function (fn) {
      (fn.params || []).forEach(function (param) {
        if (param.name === 'self' || param.name === 'cls' || !param.range) return;
        if (!rangeWithinSelection(param.range, normalized)) return;
        selected.push({
          name: param.name,
          fn: fn,
          index: (fn.params || []).indexOf(param),
        });
      });
    });
    if (!selected.length) return out;
    selected.sort(function (a, b) {
      if (a.fn.startLine !== b.fn.startLine) return a.fn.startLine - b.fn.startLine;
      return a.index - b.index;
    });
    var target = selected[0].fn;
    selected = selected.filter(function (item) {
      return item.fn === target;
    });
    out.functionName = target.name;
    out.functionStartLine = target.startLine - 1;
    out.names = selected.map(function (item) { return item.name; });
    return out;
  }

  function selectedStatementBoundsFromAnalysis(analysis, filename, selection, content) {
    var normalized = normalizeSelection(selection, content);
    if (!normalized || normalized.empty) {
      return { error: 'Select complete Python statements to extract.' };
    }
    var file = analysisFile(analysis, filename);
    if (!file) return { error: 'Select complete Python statements to extract.' };

    var statements = (file.statements || []).filter(function (statement) {
      return statement.range && isExtractableStatementKind(statement.kind);
    });
    var selected = statements.filter(function (statement) {
      return rangeWithinSelection(statement.range, normalized);
    });
    if (!selected.length) return { error: 'Select complete Python statements, not partial lines or whitespace.' };

    var partial = statements.some(function (statement) {
      return rangesIntersectSelection(statement.range, normalized)
        && !rangeWithinSelection(statement.range, normalized)
        && !selectionWithinRange(normalized, statement.range);
    });
    if (partial) return { error: 'Select complete Python statements, not partial expressions.' };

    selected = selected.filter(function (statement) {
      return !selected.some(function (other) {
        return other !== statement && rangeContainsRange(other.range, statement.range);
      });
    }).sort(function (a, b) {
      if (a.range.startLine !== b.range.startLine) return a.range.startLine - b.range.startLine;
      return a.range.startCol - b.range.startCol;
    });

    var first = selected[0].range;
    var last = selected[selected.length - 1].range;
    if (first.startLine !== normalized.startLine || first.startCol !== normalized.startCol) {
      return { error: 'Start the selection on the first token of the statement to extract.' };
    }
    if (!selectionEndMatchesStatement(content, normalized, last)) {
      return { error: 'End the selection on the last token of the statement to extract.' };
    }
    return {
      startLine: first.startLine - 1,
      endLine: last.endLine - 1,
    };
  }

  function isExtractableStatementKind(kind) {
    return kind !== 'functiondef' && kind !== 'asyncfunctiondef' && kind !== 'classdef';
  }

  function normalizeSelection(selection, content) {
    if (!selection) return null;
    var startLine = selection.startLineNumber;
    var startColumn = selection.startColumn;
    var endLine = selection.endLineNumber;
    var endColumn = selection.endColumn;
    if (!startLine || !startColumn || !endLine || !endColumn) return null;
    if (startLine > endLine || (startLine === endLine && startColumn > endColumn)) {
      var tmpLine = startLine;
      var tmpColumn = startColumn;
      startLine = endLine;
      startColumn = endColumn;
      endLine = tmpLine;
      endColumn = tmpColumn;
    }
    var lines = content ? content.split('\n') : null;
    if (lines && endColumn === 1 && endLine > startLine) {
      endLine -= 1;
      endColumn = (lines[endLine - 1] || '').length + 1;
    }
    return {
      startLine: startLine,
      startCol: startColumn - 1,
      endLine: endLine,
      endCol: endColumn - 1,
      empty: startLine === endLine && startColumn === endColumn,
    };
  }

  function rangeWithinSelection(range, selection) {
    return comparePositions(range.startLine, range.startCol, selection.startLine, selection.startCol) >= 0
      && comparePositions(range.endLine, range.endCol, selection.endLine, selection.endCol) <= 0;
  }

  function selectionWithinRange(selection, range) {
    return comparePositions(selection.startLine, selection.startCol, range.startLine, range.startCol) >= 0
      && comparePositions(selection.endLine, selection.endCol, range.endLine, range.endCol) <= 0;
  }

  function rangesIntersectSelection(range, selection) {
    return comparePositions(range.endLine, range.endCol, selection.startLine, selection.startCol) > 0
      && comparePositions(range.startLine, range.startCol, selection.endLine, selection.endCol) < 0;
  }

  function rangeContainsRange(outer, inner) {
    return comparePositions(inner.startLine, inner.startCol, outer.startLine, outer.startCol) >= 0
      && comparePositions(inner.endLine, inner.endCol, outer.endLine, outer.endCol) <= 0;
  }

  function comparePositions(aLine, aCol, bLine, bCol) {
    if (aLine !== bLine) return aLine < bLine ? -1 : 1;
    if (aCol === bCol) return 0;
    return aCol < bCol ? -1 : 1;
  }

  function selectionEndMatchesStatement(content, selection, lastRange) {
    if (comparePositions(selection.endLine, selection.endCol, lastRange.endLine, lastRange.endCol) < 0) {
      return false;
    }
    var start = offsetAtAstPosition(content, lastRange.endLine, lastRange.endCol);
    var end = offsetAtAstPosition(content, selection.endLine, selection.endCol);
    return /^\s*$/.test(content.slice(start, end));
  }

  function inferRenameScopeFromAnalysis(analysis, filename, position, oldName) {
    var lineIdx = position && position.lineNumber ? position.lineNumber - 1 : 0;
    var target = findAstSymbolAtPosition(analysis, filename, position, oldName);
    if (!target) return null;
    if (target.kind === 'attribute') {
      if (target.receiver === 'self' && target.className) {
        return {
          type: 'self-attribute',
          filename: filename,
          className: target.className,
          receiver: target.receiver,
        };
      }
      var attrFn = findAstFunctionAt(analysis, filename, lineIdx);
      return {
        type: 'receiver-attribute',
        filename: filename,
        receiver: target.receiver || '',
        scope: target.scope || null,
        className: target.className || null,
        startLine: attrFn ? attrFn.startLine : 0,
        endLine: attrFn ? attrFn.endLine : Number.MAX_SAFE_INTEGER,
      };
    }
    if (target.kind === 'parameter' || target.kind === 'name') {
      var fn = findAstFunctionAt(analysis, filename, lineIdx);
      if (!fn) return { type: 'global', filename: filename };
      return {
        type: 'local',
        filename: filename,
        scope: fn.name,
        className: fn.className || null,
        kind: target.kind,
        startLine: fn.startLine,
        endLine: fn.endLine,
      };
    }
    return { type: 'global', filename: filename };
  }

  function symbolMatchesRenameScope(scope, symbol, filename) {
    if (!symbol || !symbol.range) return false;
    if (!scope) return true;
    if (scope.type === 'global') return filename === scope.filename;
    var line = symbol.range.startLine - 1;
    if (scope.type === 'local') {
      return filename === scope.filename
        && (symbol.kind === 'parameter' || symbol.kind === 'name')
        && symbol.scope === scope.scope
        && (symbol.className || null) === scope.className
        && line >= scope.startLine
        && line <= scope.endLine;
    }
    if (scope.type === 'self-attribute') {
      return filename === scope.filename
        && symbol.kind === 'attribute'
        && symbol.receiver === scope.receiver
        && symbol.className === scope.className;
    }
    if (scope.type === 'receiver-attribute') {
      return filename === scope.filename
        && symbol.kind === 'attribute'
        && symbol.receiver === scope.receiver
        && (symbol.scope || null) === scope.scope
        && (symbol.className || null) === scope.className
        && line >= scope.startLine
        && line <= scope.endLine;
    }
    return false;
  }

  function renameConflictFromAnalysis(analysis, filename, scope, oldName, newName) {
    var file = analysisFile(analysis, filename);
    if (!file || oldName === newName) return '';
    if (scope.type === 'local') {
      var conflicts = (file.symbols || []).some(function (symbol) {
        if (!symbol.range || symbol.name !== newName) return false;
        if (symbol.scope !== scope.scope || (symbol.className || null) !== scope.className) return false;
        if (symbol.kind !== 'parameter' && symbol.kind !== 'name') return false;
        return true;
      });
      return conflicts ? 'Renaming would collide with an existing name in this scope.' : '';
    }
    if (scope.type === 'global') {
      return symbolExistsInFile(file, newName)
        ? 'Renaming would collide with an existing top-level symbol.'
        : '';
    }
    if (scope.type === 'self-attribute') {
      var attrConflict = (file.symbols || []).some(function (symbol) {
        return symbol.kind === 'attribute'
          && symbol.name === newName
          && symbol.receiver === scope.receiver
          && symbol.className === scope.className;
      });
      return attrConflict ? 'Renaming would collide with an existing attribute on this class.' : '';
    }
    return '';
  }

  function keywordRenameEditsForFunction(fileAnalysis, currentFilename, sourceFilename, functionName, oldName, newName) {
    var edits = [];
    if (!fileAnalysis) return edits;
    (fileAnalysis.calls || []).forEach(function (call) {
      if (!callMatchesParameterObjectFunction(fileAnalysis, currentFilename, sourceFilename, functionName, call)) return;
      (call.keywords || []).forEach(function (kw) {
        if (kw.name !== oldName || !kw.nameRange) return;
        edits.push({
          filename: currentFilename,
          range: astRangeToMonaco(kw.nameRange),
          text: newName,
        });
      });
    });
    return edits;
  }

  function symbolBelongsToFunction(symbol, fn) {
    if (!fn) return true;
    return symbol.scope === fn.name && (symbol.className || null) === (fn.className || null);
  }

  function collectDeclaredBeforeFromAnalysis(analysis, filename, fn, startLine) {
    var out = new Set();
    if (!fn) return out;
    (fn.params || []).forEach(function (p) { out.add(p.name); });
    var file = analysisFile(analysis, filename);
    (file && file.symbols || []).forEach(function (s) {
      if (s.kind !== 'name' || s.ctx !== 'store' || !symbolBelongsToFunction(s, fn)) return;
      var line = s.range.startLine - 1;
      if (line >= fn.startLine && line < startLine) out.add(s.name);
    });
    return out;
  }

  function collectSymbolsInRange(analysis, filename, startLine, endLine, ctx, fn) {
    var out = new Set();
    var file = analysisFile(analysis, filename);
    (file && file.symbols || []).forEach(function (s) {
      if (s.kind !== 'name' && s.kind !== 'parameter') return;
      if (ctx && s.ctx !== ctx) return;
      if (!symbolBelongsToFunction(s, fn)) return;
      var line = s.range.startLine - 1;
      if (line < startLine || line > endLine) return;
      if (!PYTHON_KEYWORDS.has(s.name) && !PYTHON_BUILTINS.has(s.name)) out.add(s.name);
    });
    return out;
  }

  function normalizeAnalysisTargetClass(analysis, target) {
    if (!target) return null;
    if (typeof target === 'object' && target.name && target.filename) return target;
    var targets = collectAnalysisClasses(analysis);
    var labelMatch = String(target).match(/^(.+)\s+\((.+)\)$/);
    if (labelMatch) {
      return targets.filter(function (t) {
        return t.name === labelMatch[1] && t.filename === labelMatch[2];
      })[0] || null;
    }
    return targets.filter(function (t) { return t.name === target; })[0] || null;
  }

  function findAstSelfFieldAssignmentAt(analysis, filename, lineIdx) {
    var file = analysisFile(analysis, filename);
    if (!file) return null;
    var line = lineIdx + 1;
    var candidates = (file.assignments || []).filter(function (assignment) {
      return assignment.receiver === 'self'
        && assignment.range
        && line >= assignment.range.startLine
        && line <= assignment.range.endLine;
    });
    candidates.sort(function (a, b) {
      return (b.range.startCol || 0) - (a.range.startCol || 0);
    });
    return candidates[0] || null;
  }

  function selectedSelfFieldAssignmentFromSelection(analysis, filename, selection, content) {
    var normalized = normalizeSelection(selection, content);
    if (!normalized || normalized.empty) return null;
    var file = analysisFile(analysis, filename);
    if (!file) return null;
    var candidates = (file.assignments || []).filter(function (assignment) {
      if (assignment.receiver !== 'self') return false;
      return (assignment.targetRange && rangesIntersectSelection(assignment.targetRange, normalized))
        || (assignment.range && rangeWithinSelection(assignment.range, normalized))
        || (assignment.range && selectionWithinRange(normalized, assignment.range));
    });
    candidates = uniqueObjectsByName(candidates);
    return candidates.length === 1 ? candidates[0] : null;
  }

  function findRemovableClassPassLine(analysis, filename, targetClass) {
    var file = analysisFile(analysis, filename);
    if (!file || !targetClass) return -1;
    var passes = (file.statements || []).filter(function (statement) {
      var line = statement.range && statement.range.startLine ? statement.range.startLine - 1 : -1;
      return statement.kind === 'pass'
        && statement.className === targetClass.name
        && !statement.scope
        && line > targetClass.startLine
        && line <= targetClass.endLine;
    });
    return passes.length === 1 ? passes[0].range.startLine - 1 : -1;
  }

  function containsUnsafeExtractStatementFromAnalysis(analysis, filename, startLine, endLine) {
    var file = analysisFile(analysis, filename);
    var unsafe = {
      return: true,
      break: true,
      continue: true,
      yield: true,
      global: true,
      nonlocal: true,
      with: true,
      try: true,
      asyncwith: true,
      asyncfor: true,
    };
    return (file && file.statements || []).some(function (statement) {
      if (!unsafe[statement.kind] || !statement.range) return false;
      var line = statement.range.startLine - 1;
      return line >= startLine && line <= endLine;
    });
  }

  function helperNameConflicts(analysis, filename, fn, name) {
    var file = analysisFile(analysis, filename);
    if (!file) return false;
    return (file.symbols || []).some(function (symbol) {
      if (symbol.name !== name || !symbol.range) return false;
      if (!fn) return symbol.scope === null;
      // local conflict inside the function we are extracting from
      if (symbol.scope === fn.name && (symbol.className || null) === (fn.className || null)) return true;
      // module-level conflict only when extracting from a free function
      if (symbol.scope === null && !fn.className) return true;
      // sibling-method (or class-body assignment) conflict on the same class
      if (fn.className && symbol.className === fn.className && symbol.scope === null
          && (symbol.kind === 'function' || (symbol.kind === 'name' && symbol.ctx === 'store'))) return true;
      return false;
    });
  }

  function hasVarArgsOrKwargs(fn) {
    return !!(fn && fn.params || []).some(function (param) {
      return param.kind === 'vararg' || param.kind === 'kwarg';
    });
  }

  function hasKeywordOnlyParams(fn) {
    return !!(fn && fn.params || []).some(function (param) {
      return param.kind === 'kwonly';
    });
  }

  function symbolExistsInFile(fileAnalysis, name) {
    return !!(fileAnalysis && fileAnalysis.symbols || []).some(function (symbol) {
      if (symbol.name !== name || !symbol.range) return false;
      if (symbol.kind === 'class' || symbol.kind === 'function') return symbol.scope === null && !symbol.className;
      return symbol.kind === 'name'
        && symbol.ctx === 'store'
        && symbol.scope === null
        && !symbol.className;
    });
  }

  function hasWildcardImportFromSource(analysis, sourceFilename) {
    var moduleName = moduleNameFromFilename(sourceFilename);
    if (!moduleName || !analysis || !analysis.files) return false;
    return Object.keys(analysis.files).some(function (filename) {
      if (filename === sourceFilename) return false;
      return (analysis.files[filename].imports || []).some(function (item) {
        return item.kind === 'from'
          && item.module === moduleName
          && (item.names || []).indexOf('*') !== -1;
      });
    });
  }

  function defaultParameterObjectName(functionName) {
    return pascalCase(functionName || 'value') + 'Params';
  }

  function unsafeMoveMethodReason(analysis, filename, method) {
    if (!method) return 'Place the cursor inside a method to move it.';
    if (method.async) return 'Move Method does not support async methods yet.';
    if ((method.decorators || []).length) return 'Move Method does not support decorated methods yet.';
    if (hasVarArgsOrKwargs(method) || hasKeywordOnlyParams(method)) {
      return 'Move Method does not support variable or keyword-only parameters yet.';
    }
    if (isDunderName(method.name)) {
      return 'Move Method does not move special/dunder methods because Python looks them up on the type, not the instance.';
    }
    if (functionContainsCallNamed(analysis, filename, method, 'super')) {
      return 'Move Method does not support super() calls yet.';
    }
    if (methodUsesNameMangledAttribute(analysis, filename, method)) {
      return 'Move Method does not move methods that use name-mangled __private attributes; rename them first.';
    }
    if (methodUsesSourceSelfState(analysis, filename, method)) {
      return 'Move Method would move source-object state; extract that dependency first.';
    }
    return '';
  }

  function isDunderName(name) {
    return /^__\w+__$/.test(String(name || ''));
  }

  // ---- Dynamic-hazard detector (P1.1) -------------------------------------
  // Python's reflective APIs let code refer to a symbol indirectly. A naive
  // text/AST rewriter cannot follow these references, so we either refuse the
  // refactoring (when continuing would silently miss a use) or warn the user.

  var DYNAMIC_NAME_APIS = ['getattr', 'setattr', 'hasattr', 'delattr'];
  var DYNAMIC_EXEC_APIS = ['eval', 'exec'];

  function renameDynamicHazardError(analysis, activeFile, oldName) {
    if (!analysis || !analysis.files) return '';
    var fileNames = Object.keys(analysis.files);
    for (var f = 0; f < fileNames.length; f++) {
      var file = analysis.files[fileNames[f]];
      var calls = (file && file.calls) || [];
      for (var c = 0; c < calls.length; c++) {
        var call = calls[c];
        if (DYNAMIC_EXEC_APIS.indexOf(call.name) === -1) continue;
        var arg = call.args && call.args[0];
        if (arg && stringLiteralContains(arg.text, oldName)) {
          return 'Rename refused: ' + call.name + '() in ' + fileNames[f]
            + ' references "' + oldName + '" as a string. Resolve manually before renaming.';
        }
      }
    }
    return '';
  }

  function collectRenameDynamicWarnings(analysis, activeFile, oldName) {
    var warnings = [];
    if (!analysis || !analysis.files) return warnings;
    Object.keys(analysis.files).forEach(function (filename) {
      var file = analysis.files[filename];
      (file && file.calls || []).forEach(function (call) {
        if (DYNAMIC_NAME_APIS.indexOf(call.name) === -1) return;
        var second = call.args && call.args[1];
        if (!second) return;
        if (stringLiteralEquals(second.text, oldName)) {
          warnings.push(call.name + '("' + oldName + '") in ' + filename
            + ' must be updated by hand — string-based attribute access is not rewritten.');
        }
      });
    });
    return warnings;
  }

  function stringLiteralEquals(text, value) {
    var stripped = stripStringLiteral(text);
    return stripped !== null && stripped === value;
  }

  function stringLiteralContains(text, value) {
    var stripped = stripStringLiteral(text);
    return stripped !== null && stripped.indexOf(value) !== -1;
  }

  function stripStringLiteral(text) {
    var t = String(text || '').trim();
    var match = t.match(/^[rRbBfFuU]{0,2}(['"])((?:\\.|[^\\])*?)\1$/);
    return match ? match[2] : null;
  }

  function methodUsesNameMangledAttribute(analysis, filename, method) {
    var file = analysisFile(analysis, filename);
    if (!file || !method) return false;
    return (file.symbols || []).some(function (symbol) {
      if (symbol.kind !== 'attribute' || !symbol.range) return false;
      if (symbol.scope !== method.name) return false;
      if ((symbol.className || null) !== (method.className || null)) return false;
      var name = String(symbol.name || '');
      // Name-mangled attributes start with two underscores and do not end with two underscores.
      return /^__/.test(name) && !/__$/.test(name);
    });
  }

  function functionContainsCallNamed(analysis, filename, fn, callName) {
    var file = analysisFile(analysis, filename);
    return !!(file && file.calls || []).some(function (call) {
      return call.name === callName && callWithinFunction(call, fn);
    });
  }

  function methodUsesSourceSelfState(analysis, filename, method) {
    var file = analysisFile(analysis, filename);
    return !!(file && file.symbols || []).some(function (symbol) {
      return symbol.kind === 'attribute'
        && symbol.receiver === 'self'
        && symbol.className === method.className
        && symbol.scope === method.name
        && symbol.range
        && symbol.range.startLine - 1 > method.startLine
        && symbol.range.startLine - 1 <= method.endLine;
    });
  }

  function callWithinFunction(call, fn) {
    if (!call || !call.range || !fn) return false;
    var line = call.range.startLine - 1;
    return line >= fn.startLine
      && line <= fn.endLine
      && call.scope === fn.name
      && (call.className || null) === (fn.className || null);
  }

  function buildMoveMethodWrapper(methodLines, method, targetParam) {
    var header = methodLines[0] || '';
    var bodyIndent = (method.indent || 0) + 4;
    var args = (method.params || [])
      .filter(function (param) {
        return param.name !== 'self' && param.name !== 'cls' && param.name !== targetParam.name;
      })
      .map(function (param) { return param.name; });
    return [
      header,
      repeat(' ', bodyIndent) + 'return ' + targetParam.name + '.' + method.name + '(' + args.join(', ') + ')',
    ];
  }

  function unsafeMoveFieldReason(analysis, filename, owner, assignment, target) {
    var file = analysisFile(analysis, filename);
    var targetFile = target ? analysisFile(analysis, target.filename) : null;
    if (!owner || !assignment || !target) return 'Place the cursor on a simple self.field assignment.';
    if (assignment.scope !== '__init__') {
      return 'Move Field only supports instance fields initialized in __init__.';
    }
    if (classHasDecorator(file, owner.name, 'dataclass') || classHasDecorator(targetFile, target.name, 'dataclass')) {
      return 'Move Field does not support dataclasses yet.';
    }
    if (classHasNameStore(file, owner.name, '__slots__') || classHasNameStore(targetFile, target.name, '__slots__')) {
      return 'Move Field does not support classes with __slots__ yet.';
    }
    if (classHasProperty(file, owner.name) || classHasProperty(targetFile, target.name)) {
      return 'Move Field does not support classes with properties yet.';
    }
    if (fieldAssignmentCount(file, owner.name, assignment.name) !== 1) {
      return 'Move Field needs exactly one assignment to that field in the source class.';
    }
    if (fieldAssignmentCount(targetFile, target.name, assignment.name) > 0) {
      return 'The target class already defines this field.';
    }
    var initOrder = unresolvedNameInTargetInit(analysis, file, targetFile, target, assignment);
    if (initOrder) return initOrder;
    return '';
  }

  function unresolvedNameInTargetInit(analysis, sourceFile, targetFile, target, assignment) {
    if (!assignment.valueRange) return '';
    var targetInit = findClassInit(analysis, target.filename, target.name);
    var targetParams = new Set();
    (targetInit && targetInit.params || []).forEach(function (p) { targetParams.add(p.name); });
    var moduleNames = collectModuleLevelNames(targetFile);
    var names = symbolsInAstRange(sourceFile, assignment.valueRange, 'name', 'load');
    for (var i = 0; i < names.length; i++) {
      var name = names[i].name;
      if (name === 'self' || name === 'cls') continue;
      if (PYTHON_BUILTINS.has(name) || PYTHON_KEYWORDS.has(name)) continue;
      if (targetParams.has(name) || moduleNames.has(name)) continue;
      return 'Move Field cannot move ' + assignment.name
        + ' because its initializer uses ' + name
        + ', which is not available in ' + target.name + ".__init__.";
    }
    var attrs = symbolsInAstRange(sourceFile, assignment.valueRange, 'attribute', null);
    for (var j = 0; j < attrs.length; j++) {
      var attr = attrs[j];
      if (attr.receiver === 'self') {
        return 'Move Field cannot move ' + assignment.name
          + ' because its initializer references self.' + attr.name
          + ' on the source class.';
      }
    }
    return '';
  }

  function collectModuleLevelNames(fileAnalysis) {
    var out = new Set();
    if (!fileAnalysis) return out;
    (fileAnalysis.classes || []).forEach(function (cls) { out.add(cls.name); });
    (fileAnalysis.functions || []).forEach(function (fn) {
      if (!fn.className) out.add(fn.name);
    });
    (fileAnalysis.imports || []).forEach(function (item) {
      importAliases(item).forEach(function (alias) {
        if (alias.name === '*') return;
        out.add(alias.asname || alias.name);
      });
    });
    (fileAnalysis.assignments || []).forEach(function (assignment) {
      if (!assignment.className && !assignment.scope && assignment.receiver === '') {
        out.add(assignment.name);
      }
    });
    return out;
  }

  function planMoveFieldReferenceRewrites(analysis, filename, owner, assignment, target) {
    var references = collectMovedFieldReferences(analysis, filename, owner, assignment);
    if (!references.length) return { replacementsByFile: {} };

    var delegates = inferMoveFieldDelegates(analysis, filename, owner, assignment, target);
    if (!delegates.length) {
      return {
        error: 'Move Field found references to self.' + assignment.name
          + ' but no existing self.<field> reference to ' + target.name + ' to rewrite through.',
      };
    }
    if (delegates.length > 1) {
      return {
        error: 'Move Field found multiple references from ' + owner.name + ' to ' + target.name
          + '. Keep one delegate field before moving this field.',
      };
    }

    var delegateName = delegates[0].name;
    var replacementsByFile = {};
    references.forEach(function (ref) {
      if (!replacementsByFile[ref.filename]) replacementsByFile[ref.filename] = [];
      replacementsByFile[ref.filename].push({
        range: ref.range,
        text: delegateName + '.' + assignment.name,
      });
    });
    return {
      delegateName: delegateName,
      replacementsByFile: replacementsByFile,
    };
  }

  function collectMovedFieldReferences(analysis, filename, owner, assignment) {
    var out = [];
    if (!analysis || !analysis.files || !owner || !assignment) return out;
    Object.keys(analysis.files).forEach(function (currentFilename) {
      var file = analysisFile(analysis, currentFilename);
      (file && file.symbols || []).forEach(function (symbol) {
        if (symbol.kind !== 'attribute' || symbol.name !== assignment.name || !symbol.range) return;
        if (assignment.targetRange && currentFilename === filename && rangeContainsRange(assignment.targetRange, symbol.range)) {
          return;
        }
        if (symbol.receiver === 'self' && currentFilename === filename && symbol.className === owner.name) {
          out.push(symbol);
          return;
        }
        if (symbolReceiverHasType(file, symbol, owner.name)) {
          out.push(symbol);
        }
      });
    });
    return out;
  }

  function inferMoveFieldDelegates(analysis, filename, owner, assignment, target) {
    var file = analysisFile(analysis, filename);
    if (!file || !owner || !target) return [];
    var init = findClassInit(analysis, filename, owner.name);
    var initParams = {};
    (init && init.params || []).forEach(function (param) {
      initParams[param.name] = param;
    });
    var delegates = (file.assignments || []).filter(function (candidate) {
      return candidate.className === owner.name
        && candidate.receiver === 'self'
        && candidate.name !== assignment.name
        && candidate.scope === '__init__'
        && assignmentPointsAtClass(candidate, target.name, initParams);
    });
    return uniqueObjectsByName(delegates);
  }

  function assignmentPointsAtClass(assignment, className, initParams) {
    if (baseTypeName(assignment.annotation) === className) return true;
    if (callExpressionBaseName(assignment.value) === className) return true;
    var value = String(assignment.value || '').trim();
    var param = initParams && initParams[value];
    return !!(param && baseTypeName(param.annotation) === className);
  }

  function callExpressionBaseName(value) {
    value = String(value || '').trim();
    var open = value.indexOf('(');
    if (open === -1) return '';
    return baseTypeName(value.slice(0, open).trim());
  }

  function symbolReceiverHasType(fileAnalysis, symbol, className) {
    return receiverExpressionHasType(fileAnalysis, symbol.receiver, className, symbol);
  }

  function receiverExpressionHasType(fileAnalysis, receiver, className, usage) {
    if (!fileAnalysis || !receiver || !className || !usage) return false;
    if (expressionMatchesClass(receiver, className, fileAnalysis)) return true;
    var fn = findAnalysisFunctionForSymbol(fileAnalysis, usage) || findAnalysisFunctionForCall(fileAnalysis, usage);
    if (!fn) return false;
    if ((fn.params || []).some(function (param) {
      return param.name === receiver
        && (typeNameMatchesClass(param.annotation, className, fileAnalysis)
          || fixtureReturnMatchesClass(fileAnalysis, param.name, className));
    })) {
      return true;
    }
    return !!(fileAnalysis.assignments || []).some(function (assignment) {
      return assignment.receiver === ''
        && assignment.name === receiver
        && assignment.scope === fn.name
        && (assignment.className || null) === (fn.className || null)
        && assignment.range
        && usage.range
        && comparePositions(
          assignment.range.startLine,
          assignment.range.startCol,
          usage.range.startLine,
          usage.range.startCol
        ) < 0
        && assignmentValueMatchesClass(assignment, className, fileAnalysis);
    });
  }

  function assignmentValueMatchesClass(assignment, className, fileAnalysis) {
    if (typeNameMatchesClass(assignment.annotation, className, fileAnalysis)) return true;
    return expressionMatchesClass(assignment.value, className, fileAnalysis);
  }

  function expressionMatchesClass(expression, className, fileAnalysis) {
    var callee = callExpressionBaseName(expression);
    if (!callee) return typeNameMatchesClass(expression, className, fileAnalysis);
    return typeNameMatchesClass(callee, className, fileAnalysis)
      || functionReturnMatchesClass(fileAnalysis, callee, className);
  }

  function typeNameMatchesClass(typeName, className, fileAnalysis) {
    typeName = baseTypeName(typeName);
    if (!typeName) return false;
    if (typeName === className) return true;
    return !!(fileAnalysis && fileAnalysis.imports || []).some(function (item) {
      return importAliases(item).some(function (alias) {
        return alias.name === className && (alias.asname || alias.name) === typeName;
      });
    });
  }

  function fixtureReturnMatchesClass(fileAnalysis, fixtureName, className) {
    return functionReturnMatchesClass(fileAnalysis, fixtureName, className);
  }

  function functionReturnMatchesClass(fileAnalysis, functionName, className) {
    functionName = baseTypeName(functionName);
    return !!(fileAnalysis && fileAnalysis.functions || []).some(function (fn) {
      return !fn.className && fn.name === functionName && typeNameMatchesClass(fn.returns, className, fileAnalysis);
    });
  }

  function classHasDecorator(fileAnalysis, className, decoratorName) {
    var cls = findClassRecord(fileAnalysis, className);
    return !!(cls && cls.decorators || []).some(function (decorator) {
      return decoratorBaseName(decorator) === decoratorName;
    });
  }

  function classHasProperty(fileAnalysis, className) {
    return !!(fileAnalysis && fileAnalysis.functions || []).some(function (fn) {
      return fn.className === className
        && (fn.decorators || []).some(function (decorator) {
          return decoratorBaseName(decorator) === 'property';
        });
    });
  }

  function decoratorBaseName(decorator) {
    decorator = String(decorator || '').trim();
    var call = decorator.indexOf('(');
    if (call !== -1) decorator = decorator.slice(0, call);
    return baseTypeName(decorator);
  }

  function classHasNameStore(fileAnalysis, className, name) {
    return !!(fileAnalysis && fileAnalysis.symbols || []).some(function (symbol) {
      return symbol.kind === 'name'
        && symbol.ctx === 'store'
        && symbol.name === name
        && symbol.className === className
        && !symbol.scope;
    });
  }

  function fieldAssignmentCount(fileAnalysis, className, fieldName) {
    return (fileAnalysis && fileAnalysis.assignments || []).filter(function (item) {
      return item.receiver === 'self'
        && item.name === fieldName
        && item.className === className;
    }).length;
  }

  function findClassRecord(fileAnalysis, className) {
    return (fileAnalysis && fileAnalysis.classes || []).filter(function (cls) {
      return cls.name === className;
    })[0] || null;
  }

  function findExtractClassOwner(analysis, filename, position, selection, content) {
    var normalized = normalizeSelection(selection, content);
    if (normalized && !normalized.empty) {
      var file = analysisFile(analysis, filename);
      var selectedClasses = [];
      (file && file.classes || []).forEach(function (cls) {
        var block = normalizeAstBlock(cls);
        var range = {
          startLine: block.startLine + 1,
          startCol: block.indent,
          endLine: block.endLine + 1,
          endCol: Number.MAX_SAFE_INTEGER,
        };
        if (rangesIntersectSelection(range, normalized) || selectionWithinRange(normalized, range)) {
          selectedClasses.push(block);
        }
      });
      selectedClasses.sort(function (a, b) {
        return (b.indent || 0) - (a.indent || 0);
      });
      if (selectedClasses[0]) return selectedClasses[0];
    }
    if (position && position.lineNumber) {
      return findAstClassAt(analysis, filename, position.lineNumber - 1);
    }
    return null;
  }

  function extractClassSelectionFromEditor(analysis, filename, owner, selection, content) {
    var normalized = normalizeSelection(selection, content);
    if (!normalized || normalized.empty || !owner) return { fields: [], methods: [] };
    var file = analysisFile(analysis, filename);
    var fields = (file && file.assignments || []).filter(function (assignment) {
      return assignment.className === owner.name
        && assignment.receiver === 'self'
        && assignment.scope === '__init__'
        && assignment.range
        && rangeWithinSelection(assignment.range, normalized);
    });
    var methods = (file && file.functions || []).filter(function (fn) {
      if (fn.className !== owner.name || fn.name === '__init__' || !fn.range) return false;
      var lines = String(content || '').split('\n');
      var range = {
        startLine: fn.startLine,
        startCol: fn.col || 0,
        endLine: fn.endLine,
        endCol: (lines[fn.endLine - 1] || '').length,
      };
      return rangeWithinSelection(range, normalized);
    }).map(normalizeAstBlock);
    return { fields: fields, methods: methods };
  }

  function extractClassDefaultSelections(analysis, filename, owner, selected) {
    var all = extractClassAllCandidates(analysis, filename, owner);
    var selectedFieldNames = new Set((selected.fields || []).map(function (field) { return field.name; }));
    var selectedMethodNames = new Set((selected.methods || []).map(function (method) { return method.name; }));
    var hasExplicit = selectedFieldNames.size > 0 || selectedMethodNames.size > 0;
    var fields = hasExplicit
      ? all.fields.filter(function (field) { return selectedFieldNames.has(field.name); })
      : all.fields;
    var methods = hasExplicit
      ? all.methods.filter(function (method) { return selectedMethodNames.has(method.name); })
      : all.methods;
    return {
      fields: fields,
      methods: methods,
      fieldNames: fields.map(function (field) { return field.name; }),
      methodNames: methods.map(function (method) { return method.name; }),
    };
  }

  function extractClassAllCandidates(analysis, filename, owner) {
    var file = analysisFile(analysis, filename);
    if (!file || !owner) return { fields: [], methods: [] };
    var fields = (file.assignments || []).filter(function (assignment) {
      return assignment.className === owner.name
        && assignment.receiver === 'self'
        && assignment.scope === '__init__';
    });
    fields = uniqueObjectsByName(fields);
    var methods = (file.functions || []).filter(function (fn) {
      return fn.className === owner.name
        && fn.name !== '__init__'
        && !(fn.name.indexOf('__') === 0 && fn.name.lastIndexOf('__') === fn.name.length - 2);
    }).map(normalizeAstBlock);
    return { fields: fields, methods: methods };
  }

  function uniqueObjectsByName(items) {
    var seen = {};
    var out = [];
    (items || []).forEach(function (item) {
      if (!item || !item.name || seen[item.name]) return;
      seen[item.name] = true;
      out.push(item);
    });
    return out;
  }

  function resolveExtractClassMembers(analysis, filename, owner, fieldNames, methodNames) {
    var all = extractClassAllCandidates(analysis, filename, owner);
    var fieldSet = new Set(fieldNames || []);
    var methodSet = new Set(methodNames || []);
    return {
      fields: all.fields.filter(function (field) { return fieldSet.has(field.name); }),
      methods: all.methods.filter(function (method) { return methodSet.has(method.name); }),
    };
  }

  function unsafeExtractClassReason(analysis, filename, owner, selected, className, delegateName) {
    var file = analysisFile(analysis, filename);
    if (selected.fields.length + selected.methods.length < 2) {
      return 'Extract Class needs at least two selected fields or methods.';
    }
    if (fieldAssignmentCount(file, owner.name, delegateName) > 0) {
      return 'The source class already defines self.' + delegateName + '.';
    }
    var fieldNames = new Set(selected.fields.map(function (field) { return field.name; }));
    var methodNames = new Set(selected.methods.map(function (method) { return method.name; }));
    for (var i = 0; i < selected.fields.length; i++) {
      if (fieldAssignmentCount(file, owner.name, selected.fields[i].name) !== 1) {
        return 'Extract Class needs exactly one assignment for each selected field.';
      }
      var fieldSafety = unsafeExtractedFieldInitializerReason(analysis, filename, owner, selected.fields[i], fieldNames);
      if (fieldSafety) return fieldSafety;
    }
    for (var j = 0; j < selected.methods.length; j++) {
      var method = selected.methods[j];
      if (method.async) return 'Extract Class does not support async methods yet.';
      if ((method.decorators || []).length) return 'Extract Class does not support decorated methods yet.';
      if (functionContainsCallNamed(analysis, filename, method, 'super')) {
        return 'Extract Class does not support super() calls yet.';
      }
      var methodSafety = unsafeExtractedMethodReason(analysis, filename, method, fieldNames, methodNames);
      if (methodSafety) return methodSafety;
    }
    if (className === owner.name) return 'Choose a new class name.';
    return '';
  }

  function unsafeExtractedFieldInitializerReason(analysis, filename, owner, assignment, selectedFieldNames) {
    var file = analysisFile(analysis, filename);
    var init = findAstFunctionAt(analysis, filename, assignment.range.startLine - 1);
    var initParams = new Set((init && init.params || []).map(function (param) { return param.name; }));
    var names = symbolsInAstRange(file, assignment.valueRange || assignment.range, 'name', 'load');
    for (var i = 0; i < names.length; i++) {
      var name = names[i].name;
      if (PYTHON_BUILTINS.has(name) || initParams.has(name)) continue;
      return 'Extract Class cannot move field ' + assignment.name + ' because its initializer depends on local name ' + name + '.';
    }
    var attrs = symbolsInAstRange(file, assignment.valueRange || assignment.range, 'attribute', null);
    for (var j = 0; j < attrs.length; j++) {
      var attr = attrs[j];
      if (attr.receiver !== 'self') continue;
      if (!selectedFieldNames.has(attr.name)) {
        return 'Extract Class cannot move field ' + assignment.name + ' because it depends on self.' + attr.name + '.';
      }
    }
    return '';
  }

  function unsafeExtractedMethodReason(analysis, filename, method, selectedFieldNames, selectedMethodNames) {
    var file = analysisFile(analysis, filename);
    var attrs = (file && file.symbols || []).filter(function (symbol) {
      return symbol.kind === 'attribute'
        && symbol.receiver === 'self'
        && symbol.range
        && symbol.range.startLine - 1 > method.startLine
        && symbol.range.startLine - 1 <= method.endLine
        && symbol.scope === method.name
        && (symbol.className || null) === (method.className || null);
    });
    for (var i = 0; i < attrs.length; i++) {
      if (selectedFieldNames.has(attrs[i].name) || selectedMethodNames.has(attrs[i].name)) continue;
      return 'Extract Class cannot move ' + method.name + ' because it still uses self.' + attrs[i].name + '.';
    }
    return '';
  }

  function symbolsInAstRange(fileAnalysis, range, kind, ctx) {
    if (!fileAnalysis || !range) return [];
    return (fileAnalysis.symbols || []).filter(function (symbol) {
      if (kind && symbol.kind !== kind) return false;
      if (ctx && symbol.ctx !== ctx) return false;
      return symbol.range && rangeContainsRange(range, symbol.range);
    });
  }

  function extractClassInSourceFile(originalContent, callSiteContent, analysis, filename, owner, selected, className, delegateName) {
    var originalLines = originalContent.split('\n');
    var editedLines = callSiteContent.split('\n');
    var selectedFieldStarts = selected.fields.map(function (field) { return field.range.startLine - 1; });
    var firstFieldStart = selectedFieldStarts.length ? Math.min.apply(Math, selectedFieldStarts) : -1;
    var constructorDeps = extractClassConstructorDependencies(analysis, filename, selected.fields);
    var newClassLines = buildExtractedClassLines(originalLines, owner, selected, className, constructorDeps);
    var delegateInsertion = extractClassDelegateInsertion(
      analysis,
      filename,
      owner,
      selected,
      className,
      delegateName,
      constructorDeps
    );
    var remove = {};
    selected.fields.forEach(function (field) {
      for (var line = field.range.startLine - 1; line <= field.range.endLine - 1; line++) remove[line] = true;
    });
    selected.methods.forEach(function (method) {
      for (var line = method.startLine; line <= method.endLine; line++) remove[line] = true;
    });
    if (typeof delegateInsertion.removeLine === 'number') remove[delegateInsertion.removeLine] = true;

    var out = [];
    for (var i = 0; i < editedLines.length; i++) {
      if (i === owner.startLine) {
        out = out.concat(newClassLines);
        out.push('');
      }
      if (delegateInsertion.insertBeforeLine === i) {
        out = out.concat(delegateInsertion.lines);
      }
      if (remove[i]) {
        if (i === firstFieldStart) out = out.concat(delegateInsertion.lines);
        continue;
      }
      out.push(editedLines[i]);
    }
    if (delegateInsertion.insertBeforeLine >= editedLines.length) {
      out = out.concat(delegateInsertion.lines);
    }
    return compactClassBlankLines(out).join('\n');
  }

  function extractClassDelegateInsertion(analysis, filename, owner, selected, className, delegateName, constructorDeps) {
    var call = className + '(' + (constructorDeps.callArgs || []).join(', ') + ')';
    if (selected.fields.length) {
      return {
        insertBeforeLine: -1,
        removeLine: null,
        lines: [
          repeat(' ', selected.fields[0].range.startCol || ((owner.indent || 0) + 8))
            + 'self.' + delegateName + ' = ' + call,
        ],
      };
    }
    var init = findClassInit(analysis, filename, owner.name);
    if (init) {
      return {
        insertBeforeLine: init.endLine + 1,
        removeLine: null,
        lines: [
          repeat(' ', (init.indent || 0) + 4) + 'self.' + delegateName + ' = ' + call,
        ],
      };
    }
    var passLine = findRemovableClassPassLine(analysis, filename, owner);
    return {
      insertBeforeLine: owner.startLine + 1,
      removeLine: passLine !== -1 ? passLine : null,
      lines: [
        repeat(' ', (owner.indent || 0) + 4) + 'def __init__(self) -> None:',
        repeat(' ', (owner.indent || 0) + 8) + 'self.' + delegateName + ' = ' + call,
        '',
      ],
    };
  }

  function findClassInit(analysis, filename, className) {
    var file = analysisFile(analysis, filename);
    var raw = (file && file.functions || []).filter(function (fn) {
      return fn.className === className && fn.name === '__init__';
    })[0];
    return raw ? normalizeAstBlock(raw) : null;
  }

  function extractClassConstructorDependencies(analysis, filename, fields) {
    var file = analysisFile(analysis, filename);
    var deps = [];
    var seen = {};
    fields.forEach(function (field) {
      symbolsInAstRange(file, field.valueRange || field.range, 'name', 'load').forEach(function (symbol) {
        if (symbol.name === 'self' || symbol.name === 'cls') return;
        if (PYTHON_BUILTINS.has(symbol.name) || seen[symbol.name]) return;
        var init = findAstFunctionAt(analysis, filename, field.range.startLine - 1);
        var param = (init && init.params || []).filter(function (item) { return item.name === symbol.name; })[0];
        if (!param) return;
        seen[symbol.name] = true;
        deps.push(param);
      });
    });
    return {
      params: deps,
      callArgs: deps.map(function (param) { return param.name; }),
    };
  }

  function buildExtractedClassLines(originalLines, owner, selected, className, constructorDeps) {
    var classLines = ['class ' + className + ':'];
    if (selected.fields.length) {
      var params = ['self'].concat((constructorDeps.params || []).map(function (param) { return param.text; }));
      classLines.push('    def __init__(' + params.join(', ') + ') -> None:');
      selected.fields.forEach(function (field) {
        for (var line = field.range.startLine - 1; line <= field.range.endLine - 1; line++) {
          classLines.push(repeat(' ', 8) + stripIndent(originalLines[line] || '', field.range.startCol || ((owner.indent || 0) + 8)));
        }
      });
    }
    selected.methods.forEach(function (method, idx) {
      if (selected.fields.length || idx > 0) classLines.push('');
      for (var line = method.startLine; line <= method.endLine; line++) {
        classLines.push(repeat(' ', 4) + stripIndent(originalLines[line] || '', method.indent || ((owner.indent || 0) + 4)));
      }
    });
    if (classLines.length === 1) classLines.push('    pass');
    return classLines;
  }

  function compactClassBlankLines(lines) {
    var out = [];
    lines.forEach(function (line) {
      var prev = out[out.length - 1];
      if (line === '' && prev === '') return;
      out.push(line);
    });
    while (out.length > 1 && out[out.length - 1] === '') out.pop();
    return out;
  }

  function rewriteExtractedClassMethodCallSites(content, fileAnalysis, owner, ownerFilename, methodNames, delegateName) {
    if (!fileAnalysis || !methodNames.length) return content;
    var selectedMethodNames = new Set(methodNames);
    var replacements = [];
    (fileAnalysis.calls || []).forEach(function (call) {
      if (!selectedMethodNames.has(call.name) || !call.receiver || !call.range) return;
      if (call.className === owner.name && selectedMethodNames.has(call.scope)) return;
      if (!callMatchesExtractedClassReceiver(fileAnalysis, call, owner, ownerFilename)) return;
      var callee = call.receiver + '.' + delegateName + '.' + call.name;
      replacements.push({
        range: call.range,
        text: callee + '(' + callArgsText(call).join(', ') + ')',
      });
    });
    return applyAstRangeReplacements(content, replacements);
  }

  function rewriteExtractedClassFieldReferences(content, fileAnalysis, currentFilename, owner, ownerFilename, selected, delegateName) {
    var selectedFieldNames = new Set((selected.fields || []).map(function (field) { return field.name; }));
    if (!fileAnalysis || !selectedFieldNames.size) return content;
    var selectedRanges = extractClassRemovedRanges(selected);
    var replacements = [];
    (fileAnalysis.symbols || []).forEach(function (symbol) {
      if (symbol.kind !== 'attribute' || !symbol.range || !selectedFieldNames.has(symbol.name)) return;
      if (currentFilename === ownerFilename && rangeOverlapsAny(symbol.range, selectedRanges)) return;
      if (symbol.receiver === 'self' && currentFilename === ownerFilename && symbol.className === owner.name) {
        replacements.push({
          range: attributeExpressionRange(symbol),
          text: 'self.' + delegateName + '.' + symbol.name,
        });
        return;
      }
      if (symbolReceiverHasType(fileAnalysis, symbol, owner.name)) {
        replacements.push({
          range: attributeExpressionRange(symbol),
          text: symbol.receiver + '.' + delegateName + '.' + symbol.name,
        });
      }
    });
    return applyAstRangeReplacements(content, replacements);
  }

  function extractClassRemovedRanges(selected) {
    var ranges = [];
    (selected.fields || []).forEach(function (field) {
      if (field.range) ranges.push(field.range);
    });
    (selected.methods || []).forEach(function (method) {
      ranges.push({
        startLine: method.startLine + 1,
        startCol: method.indent || 0,
        endLine: method.endLine + 1,
        endCol: Number.MAX_SAFE_INTEGER,
      });
    });
    return ranges;
  }

  function rangeOverlapsAny(range, ranges) {
    return (ranges || []).some(function (candidate) {
      return rangesIntersectSelection(range, candidate) || rangesIntersectSelection(candidate, range);
    });
  }

  function attributeExpressionRange(symbol) {
    return {
      startLine: symbol.range.startLine,
      startCol: Math.max(0, symbol.range.startCol - String(symbol.receiver || '').length - 1),
      endLine: symbol.range.endLine,
      endCol: symbol.range.endCol,
    };
  }

  function callMatchesExtractedClassReceiver(fileAnalysis, call, owner, ownerFilename) {
    if (call.receiver === 'self') return call.className === owner.name;
    return receiverExpressionHasType(fileAnalysis, call.receiver, owner.name, call);
  }

  function callArgsText(call) {
    var args = (call.args || []).map(function (arg) { return arg.text; });
    (call.keywords || []).forEach(function (kw) {
      if (kw.name) args.push(kw.name + '=' + kw.text);
    });
    return args;
  }

  function defaultExtractClassName(ownerName) {
    return 'Extracted' + pascalCase(ownerName || 'Class');
  }

  function classChoiceLabel(target, allTargets) {
    var dup = allTargets.some(function (t) {
      return t !== target && t.name === target.name;
    });
    return dup ? (target.name + ' (' + target.filename + ')') : target.name;
  }

  function targetFromChoice(targetChoice, targets, labels) {
    if (typeof targetChoice === 'object') return targetChoice;
    return targets[labels.indexOf(targetChoice)]
      || targets.filter(function (target) { return target.name === targetChoice; })[0]
      || null;
  }

  function parseParams(text) {
    return splitTopLevel(text, ',').map(function (raw) {
      raw = raw.trim();
      if (!raw || raw === '/' || raw === '*') return null;
      var stars = '';
      while (raw[0] === '*') { stars += '*'; raw = raw.slice(1).trim(); }
      var defaultParts = splitOnceTopLevel(raw, '=');
      var beforeDefault = defaultParts[0].trim();
      var annotation = '';
      var name = beforeDefault;
      var colonParts = splitOnceTopLevel(beforeDefault, ':');
      if (colonParts.length > 1) {
        name = colonParts[0].trim();
        annotation = colonParts[1].trim();
      }
      return {
        name: name,
        annotation: annotation,
        text: stars + raw,
      };
    }).filter(function (p) {
      return p && isIdentifier(p.name);
    });
  }

  function inferMoveTargetParam(method, targetClassName) {
    if (!method || !method.params) return null;
    var targetSnake = snakeCase(targetClassName);
    for (var i = 0; i < method.params.length; i++) {
      var p = method.params[i];
      if (p.name === 'self' || p.name === 'cls') continue;
      if (p.annotation && baseTypeName(p.annotation) === targetClassName) return p;
      if (p.name === targetSnake) return p;
    }
    return null;
  }

  function removeParamFromHeader(line, paramName) {
    var open = line.indexOf('(');
    var close = line.lastIndexOf(')');
    if (open === -1 || close === -1 || close < open) return line;
    var params = parseParams(line.slice(open + 1, close))
      .filter(function (p) { return p.name !== paramName; })
      .map(function (p) { return p.text; });
    return line.slice(0, open + 1) + params.join(', ') + line.slice(close);
  }

  function replaceNameReferencesInMethodBody(methodLines, analysis, filename, method, oldName, newName) {
    var file = analysisFile(analysis, filename);
    var replacements = [];
    (file && file.symbols || []).forEach(function (symbol) {
      if (symbol.kind !== 'name' || symbol.name !== oldName || !symbol.range) return;
      var sourceLineIdx = symbol.range.startLine - 1;
      if (sourceLineIdx <= method.startLine || sourceLineIdx > method.endLine) return;
      replacements.push({
        lineIdx: sourceLineIdx - method.startLine,
        startCol: symbol.range.startCol,
        endCol: symbol.range.endCol,
        text: newName,
      });
    });
    return applyLineReplacements(methodLines.slice(), replacements);
  }

  function applyLineReplacements(lines, replacements) {
    replacements.sort(function (a, b) {
      if (a.lineIdx !== b.lineIdx) return b.lineIdx - a.lineIdx;
      return b.startCol - a.startCol;
    });
    replacements.forEach(function (edit) {
      if (edit.lineIdx < 0 || edit.lineIdx >= lines.length) return;
      var line = lines[edit.lineIdx];
      lines[edit.lineIdx] = line.slice(0, edit.startCol) + edit.text + line.slice(edit.endCol);
    });
    return lines;
  }

  function applyAstRangeReplacements(content, replacements) {
    replacements.sort(function (a, b) {
      if (a.range.startLine !== b.range.startLine) return b.range.startLine - a.range.startLine;
      return b.range.startCol - a.range.startCol;
    });
    replacements.forEach(function (edit) {
      var start = offsetAtAstPosition(content, edit.range.startLine, edit.range.startCol);
      var end = offsetAtAstPosition(content, edit.range.endLine, edit.range.endCol);
      content = content.slice(0, start) + edit.text + content.slice(end);
    });
    return content;
  }

  function offsetAtAstPosition(content, lineNumber, column) {
    var lines = content.split('\n');
    var offset = 0;
    for (var i = 0; i < lineNumber - 1; i++) offset += lines[i].length + 1;
    return offset + column;
  }

  function rewriteMovedMethodCallSites(content, fileAnalysis, method, methodName, originalParams, targetParamName) {
    var dataParams = (originalParams || []).filter(function (p) { return p.name !== 'self' && p.name !== 'cls'; });
    var targetIndex = dataParams.findIndex(function (p) { return p.name === targetParamName; });
    if (targetIndex === -1) return content;
    var replacements = [];
    var calls = (fileAnalysis && fileAnalysis.calls || []).filter(function (call) {
      return call.name === methodName && call.receiver;
    });
    calls.forEach(function (call) {
      if (!callMatchesMovedMethodReceiver(fileAnalysis, method, call)) return;
      var targetExpr = targetIndex < call.args.length ? call.args[targetIndex].text : '';
      var remaining = call.args
        .filter(function (_arg, idx) { return idx !== targetIndex; })
        .map(function (arg) { return arg.text; });
      call.keywords.forEach(function (kw) {
        if (!kw.name) return;
        if (kw.name === targetParamName) {
          targetExpr = kw.text;
          return;
        }
        remaining.push(kw.name + '=' + kw.text);
      });
      if (!targetExpr) return;
      replacements.push({
        range: call.range,
        text: targetExpr + '.' + methodName + '(' + remaining.join(', ') + ')',
      });
    });
    return applyAstRangeReplacements(content, replacements);
  }

  function callMatchesMovedMethodReceiver(fileAnalysis, method, call) {
    if (!call || !call.receiver) return false;
    if (call.receiver === 'self') return call.className === method.className;
    return receiverExpressionHasType(fileAnalysis, call.receiver, method.className, call);
  }

  function findAnalysisFunctionForCall(fileAnalysis, call) {
    if (!fileAnalysis || !call || !call.range) return null;
    var line = call.range.startLine;
    var best = null;
    (fileAnalysis.functions || []).forEach(function (fn) {
      if (line < fn.startLine || line > fn.endLine) return;
      if (call.scope && fn.name !== call.scope) return;
      if ((fn.className || null) !== (call.className || null)) return;
      if (!best || fn.col >= best.col) best = fn;
    });
    return best;
  }

  function findAnalysisFunctionForSymbol(fileAnalysis, symbol) {
    if (!fileAnalysis || !symbol || !symbol.range) return null;
    var line = symbol.range.startLine;
    var best = null;
    (fileAnalysis.functions || []).forEach(function (fn) {
      if (line < fn.startLine || line > fn.endLine) return;
      if (symbol.scope && fn.name !== symbol.scope) return;
      if ((fn.className || null) !== (symbol.className || null)) return;
      if (!best || fn.col >= best.col) best = fn;
    });
    return best;
  }

  function baseTypeName(annotation) {
    annotation = String(annotation || '').replace(/^['"]|['"]$/g, '').trim();
    var bracket = annotation.indexOf('[');
    if (bracket !== -1) annotation = annotation.slice(0, bracket);
    var dot = annotation.lastIndexOf('.');
    if (dot !== -1) annotation = annotation.slice(dot + 1);
    return annotation;
  }

  function rewriteDefinitionForParameterObject(content, fileAnalysis, func, selected, objectName, variableName) {
    var lines = content.split('\n');
    var selectedSet = new Set(selected.map(function (p) { return p.name; }));
    var inserted = false;
    var keepText = [];
    func.params.forEach(function (p) {
      if (selectedSet.has(p.name)) {
        if (!inserted) {
          keepText.push(variableName + ': ' + objectName);
          inserted = true;
        }
      } else {
        keepText.push(p.text);
      }
    });
    if (!inserted) keepText.push(variableName + ': ' + objectName);
    var bodyStart = func.startLine + 1;
    var bodyEnd = func.endLine;

    // Detect rebound selected params: any selected param with a store-context reference inside the function body.
    var reboundParams = collectReboundParameters(fileAnalysis, func, selectedSet);

    var replacements = [];
    (fileAnalysis && fileAnalysis.symbols || []).forEach(function (symbol) {
      if (symbol.kind !== 'name' || !selectedSet.has(symbol.name) || !symbol.range) return;
      if (!symbolBelongsToFunction(symbol, func)) return;
      // Rebound params keep their local name; only their initial value comes from the object.
      // This avoids turning local mutation into mutation of the caller's parameter object.
      if (reboundParams.has(symbol.name)) return;
      var lineIdx = symbol.range.startLine - 1;
      if (lineIdx < bodyStart || lineIdx > bodyEnd) return;
      replacements.push({
        lineIdx: lineIdx,
        startCol: symbol.range.startCol,
        endCol: symbol.range.endCol,
        text: variableName + '.' + symbol.name,
      });
    });
    lines = applyLineReplacements(lines, replacements);
    lines = replaceFunctionParamList(lines, func, keepText);

    if (reboundParams.size) {
      lines = insertLocalCopiesForReboundParams(lines, func, selected, reboundParams, variableName);
    }
    return lines.join('\n');
  }

  function collectReboundParameters(fileAnalysis, func, selectedSet) {
    var rebound = new Set();
    if (!fileAnalysis || !selectedSet || !selectedSet.size) return rebound;
    (fileAnalysis.symbols || []).forEach(function (symbol) {
      if (symbol.kind !== 'name' || symbol.ctx !== 'store') return;
      if (!selectedSet.has(symbol.name)) return;
      if (!symbolBelongsToFunction(symbol, func)) return;
      if (!symbol.range) return;
      var lineIdx = symbol.range.startLine - 1;
      if (lineIdx <= func.startLine || lineIdx > func.endLine) return;
      rebound.add(symbol.name);
    });
    return rebound;
  }

  function insertLocalCopiesForReboundParams(lines, func, selected, reboundParams, variableName) {
    var headerClose = findFunctionHeaderCloseLine(lines, func.startLine);
    var insertAt = headerClose + 1;
    insertAt = skipDocstringLines(lines, insertAt, func.endLine);
    var bodyIndent = (func.indent || 0) + 4;
    var pad = repeat(' ', bodyIndent);
    var copyLines = [];
    selected.forEach(function (p) {
      if (!reboundParams.has(p.name)) return;
      copyLines.push(pad + p.name + ' = ' + variableName + '.' + p.name);
    });
    if (!copyLines.length) return lines;
    lines.splice.apply(lines, [insertAt, 0].concat(copyLines));
    return lines;
  }

  function skipDocstringLines(lines, insertAt, bodyEnd) {
    var line = lines[insertAt];
    if (line === undefined) return insertAt;
    var trimmed = line.trim();
    var quote = '';
    if (trimmed.indexOf('"""') === 0) quote = '"""';
    else if (trimmed.indexOf("'''") === 0) quote = "'''";
    if (!quote) return insertAt;
    // Single-line triple-quoted string?
    if (trimmed.length > quote.length && trimmed.indexOf(quote, quote.length) === trimmed.length - quote.length) {
      return insertAt + 1;
    }
    // Multi-line: scan for the closing triple quote.
    for (var i = insertAt + 1; i <= bodyEnd && i < lines.length; i++) {
      if ((lines[i] || '').indexOf(quote) !== -1) return i + 1;
    }
    return insertAt;
  }

  function rewriteCallsForParameterObject(
    content,
    fileAnalysis,
    currentFilename,
    sourceFilename,
    func,
    selected,
    objectName,
    variableName
  ) {
    var dataParams = (func.params || []).filter(function (p) { return p.name !== 'self' && p.name !== 'cls'; });
    var replacements = [];
    var calls = (fileAnalysis && fileAnalysis.calls || []).filter(function (call) {
      return callMatchesParameterObjectFunction(fileAnalysis, currentFilename, sourceFilename, func, call);
    });
    calls.forEach(function (call) {
      var args = call.args.map(function (a) { return a.text; });
      call.keywords.forEach(function (kw) {
        if (kw.name) args.push(kw.name + '=' + kw.text);
      });
      var rewrittenArgs = buildParameterObjectCallArgs(args, dataParams, selected, objectName, variableName);
      if (!rewrittenArgs) return;
      var callee = call.receiver ? (call.receiver + '.' + call.name) : call.name;
      replacements.push({
        range: call.range,
        text: callee + '(' + rewrittenArgs + ')',
      });
    });
    return applyAstRangeReplacements(content, replacements);
  }

  function callMatchesParameterObjectFunction(fileAnalysis, currentFilename, sourceFilename, func, call) {
    if (!call) return false;
    var functionName = typeof func === 'string' ? func : func.name;
    var className = typeof func === 'object' ? func.className : '';
    if (className) {
      if (call.name !== functionName) return false;
      if (!call.receiver) return false;
      if (call.receiver === 'self') {
        return currentFilename === sourceFilename && call.className === className;
      }
      return receiverExpressionHasType(fileAnalysis, call.receiver, className, call);
    }
    var refs = sourceFunctionReferences(fileAnalysis, currentFilename, sourceFilename, functionName);
    if (call.receiver) return refs.receivers.has(call.receiver);
    return refs.direct.has(call.name);
  }

  function sourceFunctionReferences(fileAnalysis, currentFilename, sourceFilename, functionName) {
    var direct = new Set();
    var receivers = new Set();
    var moduleName = moduleNameFromFilename(sourceFilename);
    if (currentFilename === sourceFilename) direct.add(functionName);
    if (!fileAnalysis || !moduleName) return { direct: direct, receivers: receivers };

    var parts = moduleName.split('.');
    var leafModule = parts[parts.length - 1];
    var parentModule = parts.slice(0, -1).join('.');
    (fileAnalysis.imports || []).forEach(function (item) {
      importAliases(item).forEach(function (alias) {
        var localName = alias.asname || alias.name;
        if (item.kind === 'from') {
          if (item.module === moduleName && (alias.name === functionName || alias.name === '*')) {
            direct.add(alias.name === '*' ? functionName : localName);
          } else if (parentModule && item.module === parentModule && alias.name === leafModule) {
            receivers.add(localName);
          }
        } else if (item.kind === 'import' && alias.name === moduleName) {
          receivers.add(alias.asname || alias.name);
        }
      });
    });
    return { direct: direct, receivers: receivers };
  }

  function importAliases(item) {
    if (item && item.aliases && item.aliases.length) return item.aliases;
    return (item && item.names || []).map(function (name) {
      return { name: name, asname: '' };
    });
  }

  function buildParameterObjectCallArgs(args, dataParams, selected, objectName, variableName) {
    var selectedNames = new Set(selected.map(function (p) { return p.name; }));
    var positional = [];
    var keywords = {};
    var extras = [];
    args.forEach(function (arg) {
      var parts = splitOnceTopLevel(arg, '=');
      if (parts.length > 1 && isIdentifier(parts[0].trim())) keywords[parts[0].trim()] = parts[1].trim();
      else positional.push(arg);
    });
    var objectArgs = [];
    var objectNeedsKeyword = false;
    var rewritten = [];
    var insertedObject = false;
    var valuesByParam = {};
    var sawKeyword = false;
    for (var i = 0; i < dataParams.length; i++) {
      var param = dataParams[i];
      var hasKeyword = Object.prototype.hasOwnProperty.call(keywords, param.name);
      var value = hasKeyword ? (param.name + '=' + keywords[param.name]) : positional[i];
      if (selectedNames.has(param.name)) {
        if (!value) return null;
        if (hasKeyword) objectNeedsKeyword = true;
        objectArgs.push(value);
      } else if (value) {
        valuesByParam[param.name] = { text: value, keyword: hasKeyword };
      }
    }
    for (var j = dataParams.length; j < positional.length; j++) extras.push(positional[j]);
    Object.keys(keywords).forEach(function (name) {
      var known = dataParams.some(function (p) { return p.name === name; });
      if (!known) extras.push(name + '=' + keywords[name]);
    });
    for (var k = 0; k < dataParams.length; k++) {
      var current = dataParams[k];
      if (selectedNames.has(current.name)) {
        if (!insertedObject) {
          var objectExpr = objectName + '(' + objectArgs.join(', ') + ')';
          if (sawKeyword || objectNeedsKeyword) {
            rewritten.push(variableName + '=' + objectExpr);
            sawKeyword = true;
          } else {
            rewritten.push(objectExpr);
          }
          insertedObject = true;
        }
      } else if (Object.prototype.hasOwnProperty.call(valuesByParam, current.name)) {
        var valueInfo = valuesByParam[current.name];
        rewritten.push(valueInfo.text);
        if (valueInfo.keyword) sawKeyword = true;
      }
    }
    return rewritten.concat(extras).join(', ');
  }

  function ensureDataclassObject(content, fileAnalysis, func, selected, objectName) {
    var lines = content.split('\n');
    var needsField = selected.some(function (p) {
      return p.default && isMutableContainerDefault(p.default);
    });
    var importResult = ensureDataclassImport(lines, fileAnalysis, func, needsField);
    lines = importResult.lines;
    func = importResult.func;
    var insertAt = func.className && typeof func.classStartLine === 'number'
      ? func.classStartLine
      : func.startLine;
    var objectLines = [
      '@dataclass',
      'class ' + objectName + ':',
    ];
    selected.forEach(function (p) {
      objectLines.push('    ' + dataclassFieldLine(p));
    });
    objectLines.push('');
    lines.splice(insertAt, 0, objectLines.join('\n'));
    return lines.join('\n');
  }

  function dataclassFieldLine(param) {
    var annotation = param.annotation || 'object';
    if (!param.default) return param.name + ': ' + annotation;
    if (isMutableContainerDefault(param.default)) {
      return param.name + ': ' + annotation + ' = field(default_factory=' + mutableContainerFactory(param.default) + ')';
    }
    return param.name + ': ' + annotation + ' = ' + param.default;
  }

  function isSupportedParamDefault(value) {
    var trimmed = String(value || '').trim();
    if (!trimmed) return true;
    if (isLiteralDefault(trimmed)) return true;
    if (isMutableContainerDefault(trimmed)) return true;
    return false;
  }

  function isLiteralDefault(value) {
    var v = String(value || '').trim();
    if (v === 'None' || v === 'True' || v === 'False') return true;
    if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v)) return true;
    if (/^-?\d+\.\d*(?:[eE][+-]?\d+)?$/.test(v)) return true;
    if (/^("([^"\\]|\\.)*"|'([^'\\]|\\.)*')$/.test(v)) return true;
    if (/^(?:[rRbBfFuU]{0,2})("([^"\\]|\\.)*"|'([^'\\]|\\.)*')$/.test(v)) return true;
    return false;
  }

  function isMutableContainerDefault(value) {
    var v = String(value || '').trim();
    if (v === '[]' || v === '{}' || v === '()') return true;
    if (/^list\s*\(\s*\)$/.test(v) || /^dict\s*\(\s*\)$/.test(v)) return true;
    if (/^set\s*\(\s*\)$/.test(v) || /^tuple\s*\(\s*\)$/.test(v)) return true;
    return false;
  }

  function mutableContainerFactory(value) {
    var v = String(value || '').trim();
    if (v === '[]' || /^list\s*\(/.test(v)) return 'list';
    if (v === '{}' || /^dict\s*\(/.test(v)) return 'dict';
    if (/^set\s*\(/.test(v)) return 'set';
    if (v === '()' || /^tuple\s*\(/.test(v)) return 'tuple';
    return 'list';
  }

  function ensureParameterObjectImport(content, fileAnalysis, sourceFilename, objectName) {
    var moduleName = moduleNameFromFilename(sourceFilename);
    if (!moduleName) return content;
    var lines = content.split('\n');
    var imports = fileAnalysis && fileAnalysis.imports || [];
    var fromImport = imports.filter(function (item) {
      return item.kind === 'from' && item.module === moduleName;
    })[0];
    if (fromImport) {
      if (fromImport.names.indexOf(objectName) !== -1 || fromImport.names.indexOf('*') !== -1) {
        return content;
      }
      var lineIdx = fromImport.range.startLine - 1;
      lines[lineIdx] = lines[lineIdx].replace(/\s*$/, ', ' + objectName);
      return lines.join('\n');
    }
    var insertAt = 0;
    imports.forEach(function (item) {
      if (item.range && item.range.endLine > insertAt) insertAt = item.range.endLine;
    });
    var inserted = ['from ' + moduleName + ' import ' + objectName];
    if (insertAt < lines.length && trimCode(lines[insertAt] || '') !== '') inserted.push('');
    lines.splice.apply(lines, [insertAt, 0].concat(inserted));
    return lines.join('\n');
  }

  function ensureDataclassImport(lines, fileAnalysis, func, needsField) {
    var needed = ['dataclass'];
    if (needsField) needed.push('field');
    var imports = fileAnalysis && fileAnalysis.imports || [];
    var dataclassesImport = imports.filter(function (item) {
      return item.kind === 'from' && item.module === 'dataclasses';
    })[0];
    if (dataclassesImport) {
      var lineIdx = dataclassesImport.range.startLine - 1;
      var missing = needed.filter(function (name) {
        return dataclassesImport.names.indexOf(name) === -1;
      });
      if (missing.length) {
        lines[lineIdx] = lines[lineIdx].replace(/\s*$/, ', ' + missing.join(', '));
      }
      return { lines: lines, func: func };
    }
    var insertAt = moduleImportInsertLine(lines);
    imports.forEach(function (item) {
      if (item.kind === 'from' && item.module === '__future__' && item.range.endLine > insertAt) {
        insertAt = item.range.endLine;
      }
    });
    var nextLine = trimCode(lines[insertAt] || '');
    var importLine = 'from dataclasses import ' + needed.join(', ');
    var inserted = nextLine === '' || isImportLine(nextLine)
      ? [importLine]
      : [importLine, ''];
    lines.splice.apply(lines, [insertAt, 0].concat(inserted));
    return { lines: lines, func: cloneWithLineOffset(func, inserted.length) };
  }

  function isImportLine(line) {
    return /^import\s+/.test(line) || /^from\s+\S+\s+import\s+/.test(line);
  }

  function moduleImportInsertLine(lines) {
    var idx = 0;
    while (idx < lines.length && /^(\s*#|\s*$)/.test(lines[idx])) idx++;
    var docEnd = moduleDocstringEndLine(lines, idx);
    if (docEnd !== -1) idx = docEnd + 1;
    while (idx < lines.length && /^\s*$/.test(lines[idx])) idx++;
    return idx;
  }

  function moduleDocstringEndLine(lines, startIdx) {
    var line = lines[startIdx] || '';
    var trimmed = line.trim();
    var quote = '';
    if (trimmed.indexOf('"""') === 0) quote = '"""';
    else if (trimmed.indexOf("'''") === 0) quote = "'''";
    if (!quote) return -1;
    if (trimmed.indexOf(quote, quote.length) !== -1) return startIdx;
    for (var i = startIdx + 1; i < lines.length; i++) {
      if ((lines[i] || '').indexOf(quote) !== -1) return i;
    }
    return -1;
  }

  function moduleNameFromFilename(filename) {
    filename = String(filename || '');
    if (!/\.py$/i.test(filename)) return '';
    filename = filename.replace(/\.py$/i, '').replace(/\/__init__$/i, '');
    return filename.split('/').filter(Boolean).join('.');
  }

  function cloneWithLineOffset(fn, offset) {
    var copy = {};
    for (var k in fn) copy[k] = fn[k];
    copy.startLine += offset;
    copy.endLine += offset;
    if (typeof copy.classStartLine === 'number') copy.classStartLine += offset;
    return copy;
  }

  function replaceParamList(line, replacement) {
    var open = line.indexOf('(');
    var close = line.lastIndexOf(')');
    if (open === -1 || close === -1 || close < open) return line;
    return line.slice(0, open + 1) + replacement + line.slice(close);
  }

  function replaceFunctionParamList(lines, func, params) {
    var closeLine = findFunctionHeaderCloseLine(lines, func.startLine);
    if (closeLine === func.startLine) {
      lines[func.startLine] = replaceParamList(lines[func.startLine], params.join(', '));
      return lines;
    }
    var first = lines[func.startLine] || '';
    var open = first.indexOf('(');
    if (open === -1 || closeLine < func.startLine) return lines;
    var close = (lines[closeLine] || '').lastIndexOf(')');
    if (close === -1) return lines;
    var suffix = (lines[closeLine] || '').slice(close);
    var paramIndent = inferParamIndent(lines, func);
    var replacement = [first.slice(0, open + 1)];
    params.forEach(function (param) {
      replacement.push(repeat(' ', paramIndent) + param + ',');
    });
    replacement.push(repeat(' ', func.indent || 0) + suffix);
    lines.splice.apply(lines, [func.startLine, closeLine - func.startLine + 1].concat(replacement));
    return lines;
  }

  function findFunctionHeaderCloseLine(lines, startLine) {
    var depth = 0;
    var quote = null;
    for (var lineIdx = startLine; lineIdx < lines.length; lineIdx++) {
      var line = lines[lineIdx] || '';
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (quote) {
          if (ch === '\\') i++;
          else if (ch === quote) quote = null;
          continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth <= 0) return lineIdx;
        }
      }
    }
    return startLine;
  }

  function inferParamIndent(lines, func) {
    for (var i = func.startLine + 1; i <= func.endLine && i < lines.length; i++) {
      var line = lines[i] || '';
      if (trimCode(line) && line.indexOf(')') === -1) return leadingSpaceCount(line);
    }
    return (func.indent || 0) + 4;
  }

  function leadingSpaceCount(line) {
    var count = 0;
    while (count < line.length && line[count] === ' ') count++;
    return count;
  }

  function isSimpleMovableAssignment(assignment) {
    if (!assignment) return false;
    if (assignment.valueKind === 'literal') return true;
    if (assignment.valueKind !== 'call') return false;
    var value = String(assignment.value || '').trim();
    return /^[A-Z]\w*(?:\.[A-Z]\w*)?\s*\(/.test(value)
      || /^(dict|list|set|tuple)\s*\(\s*\)$/.test(value);
  }

  /* ------------------------------------------------------------------------ */
  /* Preview and input UI                                                     */
  /* ------------------------------------------------------------------------ */

  var sbrErrorCounter = 0;

  function configureFormError(error, controls) {
    if (!error) return;
    error.id = error.id || ('sbr-error-' + (++sbrErrorCounter));
    error.setAttribute('role', 'alert');
    error.setAttribute('aria-live', 'polite');
    (controls || []).forEach(function (control) {
      if (!control) return;
      control.setAttribute('aria-describedby', error.id);
      control.setAttribute('aria-invalid', 'false');
    });
  }

  function askText(opts) {
    return showForm(opts, function (body, done, modal) {
      var label = document.createElement('label');
      label.className = 'sbr-field';
      label.textContent = opts.label || 'Value';
      var input = document.createElement('input');
      input.className = 'sbr-input';
      input.value = opts.value || '';
      input.autocomplete = 'off';
      label.appendChild(input);
      var error = document.createElement('div');
      error.className = 'sbr-error';
      configureFormError(error, [input]);
      body.appendChild(label);
      body.appendChild(error);

      function validateCurrent() {
        var value = input.value.trim();
        var msg = opts.validate ? opts.validate(value) : '';
        setFormValidation(modal, error, msg, [input]);
        return { value: value, error: msg };
      }

      input.addEventListener('input', validateCurrent);
      validateCurrent();
      setTimeout(function () { input.focus(); input.select(); }, 20);
      return function () {
        var result = validateCurrent();
        if (result.error) return;
        done(result.value);
      };
    });
  }

  function askChoice(opts) {
    return showForm(opts, function (body, done, modal) {
      var label = document.createElement('label');
      label.className = 'sbr-field';
      label.textContent = opts.label || 'Choice';
      var select = document.createElement('select');
      select.className = 'sbr-input';
      (opts.options || []).forEach(function (item) {
        var opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        select.appendChild(opt);
      });
      label.appendChild(select);
      body.appendChild(label);

      var error = document.createElement('div');
      error.className = 'sbr-error';
      configureFormError(error, [select]);
      body.appendChild(error);

      function validateCurrent() {
        var value = select.value;
        var msg = opts.validateChoice ? opts.validateChoice(value) : '';
        setFormValidation(modal, error, msg, [select]);
        return { value: value, error: msg };
      }

      select.addEventListener('change', validateCurrent);
      validateCurrent();
      setTimeout(function () { select.focus(); }, 20);
      return function () {
        var result = validateCurrent();
        if (result.error) return;
        done(result.value);
      };
    });
  }

  function askParameterObject(opts) {
    return showForm(opts, function (body, done, modal) {
      var nameLabel = document.createElement('label');
      nameLabel.className = 'sbr-field';
      nameLabel.textContent = 'Parameter object class name';
      var nameInput = document.createElement('input');
      nameInput.className = 'sbr-input';
      nameInput.value = opts.objectName || 'ParameterObject';
      nameInput.autocomplete = 'off';
      nameLabel.appendChild(nameInput);
      body.appendChild(nameLabel);

      var hint = document.createElement('div');
      hint.className = 'sbr-summary';
      hint.textContent = 'Choose the parameters that travel together and should become fields.';
      body.appendChild(hint);

      var checks = document.createElement('div');
      checks.className = 'sbr-checks';
      var selectedDefaults = new Set(opts.selectedParamNames || []);
      var hasSelectedDefaults = selectedDefaults.size > 0;
      (opts.params || []).forEach(function (param) {
        var row = document.createElement('label');
        row.className = 'sbr-check';
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.value = param.name;
        input.checked = hasSelectedDefaults ? selectedDefaults.has(param.name) : true;
        var text = document.createElement('span');
        text.textContent = param.text || param.name;
        row.appendChild(input);
        row.appendChild(text);
        checks.appendChild(row);
      });
      body.appendChild(checks);

      var error = document.createElement('div');
      error.className = 'sbr-error';
      configureFormError(error, [nameInput].concat(Array.prototype.slice.call(checks.querySelectorAll('input'))));
      body.appendChild(error);

      function readState() {
        return {
          objectName: nameInput.value.trim(),
          selectedParamNames: Array.prototype.slice.call(checks.querySelectorAll('input:checked'))
            .map(function (input) { return input.value; }),
        };
      }

      function validateCurrent() {
        var state = readState();
        var msg = validateParameterObjectDialogState(state, opts.validateState);
        setFormValidation(modal, error, msg, [nameInput].concat(Array.prototype.slice.call(checks.querySelectorAll('input'))));
        return { state: state, error: msg };
      }

      nameInput.addEventListener('input', validateCurrent);
      Array.prototype.slice.call(checks.querySelectorAll('input')).forEach(function (input) {
        input.addEventListener('change', validateCurrent);
      });
      validateCurrent();
      setTimeout(function () { nameInput.focus(); nameInput.select(); }, 20);

      return function () {
        var result = validateCurrent();
        if (result.error) return;
        done(result.state);
      };
    });
  }

  function validateParameterObjectDialogState(state, semanticValidator) {
    state = state || {};
    var msg = validateClassName(state.objectName);
    var selected = state.selectedParamNames || [];
    if (!msg && selected.length < 2) msg = 'Select at least two parameters.';
    if (!msg && typeof semanticValidator === 'function') {
      msg = semanticValidator(state) || '';
    }
    return msg;
  }

  function askExtractClass(opts) {
    opts = opts || {};
    opts.modalClass = (opts.modalClass ? opts.modalClass + ' ' : '') + 'sbr-modal-extract-class';
    return showForm(opts, function (body, done, modal) {
      var classLabel = document.createElement('label');
      classLabel.className = 'sbr-field';
      classLabel.textContent = 'New class name';
      var classInput = document.createElement('input');
      classInput.className = 'sbr-input';
      classInput.value = opts.className || 'ExtractedClass';
      classInput.autocomplete = 'off';
      classLabel.appendChild(classInput);
      body.appendChild(classLabel);

      var delegateLabel = document.createElement('label');
      delegateLabel.className = 'sbr-field';
      delegateLabel.textContent = 'Delegate field name';
      delegateLabel.style.marginTop = '10px';
      var delegateInput = document.createElement('input');
      delegateInput.className = 'sbr-input';
      delegateInput.value = opts.delegateName || snakeCase(opts.className || 'extracted');
      delegateInput.autocomplete = 'off';
      delegateLabel.appendChild(delegateInput);
      body.appendChild(delegateLabel);

      var hint = document.createElement('div');
      hint.className = 'sbr-summary';
      hint.textContent = 'Choose the fields and methods that belong in the new class.';
      body.appendChild(hint);

      var selectionActions = document.createElement('div');
      selectionActions.className = 'sbr-inline-actions';
      var checkAll = document.createElement('button');
      checkAll.type = 'button';
      checkAll.className = 'sbr-btn sbr-check-all';
      checkAll.textContent = 'Check all';
      var uncheckAll = document.createElement('button');
      uncheckAll.type = 'button';
      uncheckAll.className = 'sbr-btn sbr-uncheck-all';
      uncheckAll.textContent = 'Uncheck all';
      selectionActions.appendChild(checkAll);
      selectionActions.appendChild(uncheckAll);
      body.appendChild(selectionActions);

      var checks = document.createElement('div');
      checks.className = 'sbr-checks';
      var selectedFields = new Set(opts.selectedFieldNames || []);
      var selectedMethods = new Set(opts.selectedMethodNames || []);
      (opts.fields || []).forEach(function (field) {
        checks.appendChild(memberCheck('field:' + field.name, 'field  self.' + field.name, selectedFields.has(field.name)));
      });
      (opts.methods || []).forEach(function (method) {
        checks.appendChild(memberCheck('method:' + method.name, 'method  ' + method.name + '()', selectedMethods.has(method.name)));
      });
      body.appendChild(checks);

      var error = document.createElement('div');
      error.className = 'sbr-error';
      configureFormError(error, [classInput, delegateInput].concat(Array.prototype.slice.call(checks.querySelectorAll('input'))));
      body.appendChild(error);

      var umlPreview = document.createElement('div');
      umlPreview.className = 'sbr-uml-preview';
      body.appendChild(umlPreview);

      function readState() {
        var className = classInput.value.trim();
        var delegateName = delegateInput.value.trim();
        var selectedFieldNames = [];
        var selectedMethodNames = [];
        Array.prototype.slice.call(checks.querySelectorAll('input:checked')).forEach(function (input) {
          var parts = input.value.split(':');
          if (parts[0] === 'field') selectedFieldNames.push(parts[1]);
          if (parts[0] === 'method') selectedMethodNames.push(parts[1]);
        });
        return {
          className: className,
          delegateName: delegateName,
          selectedFieldNames: selectedFieldNames,
          selectedMethodNames: selectedMethodNames,
        };
      }

      function validateCurrent() {
        var state = readState();
        renderExtractClassUmlPreview(umlPreview, opts, state);
        var msg = validateExtractClassDialogState(state, opts.validateState);
        setFormValidation(modal, error, msg, [classInput, delegateInput].concat(Array.prototype.slice.call(checks.querySelectorAll('input'))));
        return { state: state, error: msg };
      }

      function wireLiveValidation(node, eventName) {
        node.addEventListener(eventName, validateCurrent);
      }

      wireLiveValidation(classInput, 'input');
      wireLiveValidation(delegateInput, 'input');
      Array.prototype.slice.call(checks.querySelectorAll('input')).forEach(function (input) {
        wireLiveValidation(input, 'change');
      });
      checkAll.addEventListener('click', function () {
        Array.prototype.slice.call(checks.querySelectorAll('input')).forEach(function (input) {
          input.checked = true;
        });
        validateCurrent();
      });
      uncheckAll.addEventListener('click', function () {
        Array.prototype.slice.call(checks.querySelectorAll('input')).forEach(function (input) {
          input.checked = false;
        });
        validateCurrent();
      });
      validateCurrent();
      setTimeout(function () { classInput.focus(); classInput.select(); }, 20);

      return function () {
        var result = validateCurrent();
        if (result.error) return;
        done(result.state);
      };
    });
  }

  function validateExtractClassDialogState(state, semanticValidator) {
    state = state || {};
    var msg = validateClassName(state.className) || validateIdentifier(state.delegateName);
    var selectedFieldNames = state.selectedFieldNames || [];
    var selectedMethodNames = state.selectedMethodNames || [];
    if (!msg && selectedFieldNames.length + selectedMethodNames.length < 2) {
      msg = 'Select at least two fields or methods.';
    }
    if (!msg && typeof semanticValidator === 'function') {
      msg = semanticValidator(state) || '';
    }
    return msg;
  }

  function setFormValidation(modal, errorNode, message, controls) {
    message = message || '';
    if (errorNode) errorNode.textContent = message;
    (controls || []).forEach(function (control) {
      if (control) control.setAttribute('aria-invalid', message ? 'true' : 'false');
    });
    if (modal && modal.primary) {
      modal.primary.disabled = !!message;
      modal.primary.setAttribute('aria-disabled', message ? 'true' : 'false');
    }
  }

  function renderExtractClassUmlPreview(container, opts, state) {
    if (!container) return;
    state = state || {};
    container.textContent = '';
    var selectedFields = new Set(state.selectedFieldNames || []);
    var selectedMethods = new Set(state.selectedMethodNames || []);
    var fields = opts.fields || [];
    var methods = opts.methods || [];
    var ownerName = opts.ownerName || 'SourceClass';
    var className = state.className || opts.className || 'ExtractedClass';
    var delegateName = state.delegateName || opts.delegateName || snakeCase(className);
    var beforeSpec = buildExtractClassUmlSpec({
      ownerName: ownerName,
      ownerFields: fields.map(function (field) { return field.name; }),
      ownerMethods: methods.map(function (method) { return method.name + '()'; }),
      layout: 'portrait',
    });
    var afterSpec = buildExtractClassUmlSpec({
      ownerName: ownerName,
      ownerFields: fields
        .filter(function (field) { return !selectedFields.has(field.name); })
        .map(function (field) { return field.name; })
        .concat([delegateName + ': ' + className]),
      ownerMethods: methods
        .filter(function (method) { return !selectedMethods.has(method.name); })
        .map(function (method) { return method.name + '()'; }),
      extractedName: className,
      extractedFields: fields
        .filter(function (field) { return selectedFields.has(field.name); })
        .map(function (field) { return field.name; }),
      extractedMethods: methods
        .filter(function (method) { return selectedMethods.has(method.name); })
        .map(function (method) { return method.name + '()'; }),
      delegateName: delegateName,
      layout: 'landscape',
    });
    var beforePanel = archUmlPanel('Before', beforeSpec);
    var afterPanel = archUmlPanel('After', afterSpec);
    container.appendChild(beforePanel);
    container.appendChild(afterPanel);
    renderArchUmlClassDiagram(beforePanel.querySelector('.sbr-uml-diagram'), beforeSpec);
    renderArchUmlClassDiagram(afterPanel.querySelector('.sbr-uml-diagram'), afterSpec);
  }

  function buildExtractClassUmlSpec(model) {
    var ownerId = umlIdentifier(model.ownerName, 'SourceClass');
    var extractedId = model.extractedName ? umlIdentifier(model.extractedName, 'ExtractedClass') : '';
    var lines = ['@startuml', 'layout ' + (model.layout || 'compact'), 'layout shadows off'];
    lines = lines.concat(umlClassSpec(ownerId, model.ownerFields || [], model.ownerMethods || []));
    if (model.extractedName) {
      lines = lines.concat(umlClassSpec(extractedId, model.extractedFields || [], model.extractedMethods || []));
      lines.push(ownerId + ' o--> ' + extractedId + ' : ' + (model.delegateName || 'delegate'));
    }
    lines.push('@enduml');
    return lines.join('\n');
  }

  function umlIdentifier(value, fallback) {
    value = String(value || '').trim();
    return /^[A-Za-z_]\w*$/.test(value) ? value : fallback;
  }

  function umlClassSpec(name, fields, methods) {
    if (!fields.length && !methods.length) return ['class ' + name];
    var lines = ['class ' + name + ' {'];
    fields.forEach(function (field) { lines.push('  - ' + field); });
    if (fields.length && methods.length) lines.push('  --');
    methods.forEach(function (method) { lines.push('  + ' + method); });
    lines.push('}');
    return lines;
  }

  function archUmlPanel(title, spec) {
    var panel = document.createElement('div');
    panel.className = 'sbr-uml-panel';
    var heading = document.createElement('div');
    heading.className = 'sbr-uml-panel-title';
    heading.textContent = title;
    var canvas = document.createElement('div');
    canvas.className = 'sbr-uml-diagram uml-class-diagram-container';
    canvas.setAttribute('data-uml-type', 'class');
    canvas.setAttribute('data-uml-spec', spec);
    panel.appendChild(heading);
    panel.appendChild(canvas);
    return panel;
  }

  function renderArchUmlClassDiagram(container, spec, attempt) {
    if (!container) return;
    attempt = attempt || 0;
    if (global.UMLClassDiagram && typeof global.UMLClassDiagram.render === 'function') {
      global.UMLClassDiagram.render(container, spec);
      container.dataset.umlRendered = 'true';
      return;
    }
    container.textContent = 'Loading diagram...';
    if (attempt < 20) {
      setTimeout(function () { renderArchUmlClassDiagram(container, spec, attempt + 1); }, 80);
    }
  }

  function memberCheck(value, label, checked) {
    var row = document.createElement('label');
    row.className = 'sbr-check';
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.value = value;
    input.checked = !!checked;
    var text = document.createElement('span');
    text.textContent = label;
    row.appendChild(input);
    row.appendChild(text);
    return row;
  }

  function showForm(opts, render) {
    return new Promise(function (resolve) {
      var modal = modalShell(opts.title || 'Refactoring');
      if (opts.modalClass && modal.dialog) {
        String(opts.modalClass).split(/\s+/).filter(Boolean).forEach(function (cls) {
          modal.dialog.classList.add(cls);
        });
      }
      var submit = null;
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        closeModal(modal.root);
        resolve(value);
      }
      submit = render(modal.body, function (value) {
        finish(value);
      }, modal);
      modal.primary.textContent = 'Continue';
      modal.primary.addEventListener('click', function () {
        if (modal.primary.disabled) return;
        if (submit) submit();
      });
      modal.cancel.addEventListener('click', function () { finish(null); });
      modal.close.addEventListener('click', function () { finish(null); });
      modal.root.addEventListener('mousedown', function (e) {
        if (e.target === modal.root) finish(null);
      });
      modal.root.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { finish(null); }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!modal.primary.disabled && submit) submit();
        }
      });
    });
  }

  function showPreview(plan, workspace) {
    return new Promise(function (resolve) {
      var modal = modalShell(plan.title || 'Preview Refactoring');
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        closeModal(modal.root);
        resolve(value);
      }
      var summary = document.createElement('div');
      summary.className = 'sbr-summary';
      summary.textContent = plan.summary || '';
      modal.body.appendChild(summary);
      var stats = document.createElement('div');
      stats.className = 'sbr-stats';
      stats.textContent = previewStats(plan);
      modal.body.appendChild(stats);
      var diff = document.createElement('div');
      diff.className = 'sbr-preview';
      renderPreview(plan, diff, workspace);
      modal.body.appendChild(diff);
      modal.primary.textContent = 'Apply';
      modal.primary.addEventListener('click', function () { finish(true); });
      modal.cancel.addEventListener('click', function () { finish(false); });
      modal.close.addEventListener('click', function () { finish(false); });
      modal.root.addEventListener('mousedown', function (e) {
        if (e.target === modal.root) finish(false);
      });
      modal.root.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { finish(false); }
      });
    });
  }

  // List of CSS selectors for elements that can receive keyboard focus.
  // Used by the modal focus trap below to find the first/last focusable
  // descendant on every Tab so AT users can't escape the dialog. Excludes
  // disabled, hidden, and tabindex=-1 elements via the `:not(...)` filters
  // applied at query time.
  var SBR_FOCUSABLE_SELECTOR =
    'a[href], area[href], button, input, select, textarea, ' +
    '[tabindex]:not([tabindex="-1"]), [contenteditable="true"], details > summary';

  function sbrFocusableIn(root) {
    if (!root) return [];
    var nodes = root.querySelectorAll(SBR_FOCUSABLE_SELECTOR);
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.disabled) continue;
      if (n.getAttribute('aria-hidden') === 'true') continue;
      // offsetParent is null for display:none / detached nodes; that's a
      // good cheap visibility check that doesn't require a forced layout.
      if (n.offsetParent === null && n.tagName !== 'SUMMARY') continue;
      out.push(n);
    }
    return out;
  }

  function modalShell(title) {
    var titleId = 'sbr-title-' + Math.random().toString(36).slice(2, 8);
    var root = document.createElement('div');
    root.className = 'sbr-backdrop';
    root.innerHTML =
      '<div class="sbr-modal" role="dialog" aria-modal="true" aria-labelledby="' + titleId + '" tabindex="-1">' +
      '<div class="sbr-header">' +
      '<div class="sbr-title" id="' + titleId + '"></div>' +
      '<button type="button" class="sbr-icon-btn sbr-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="sbr-body"></div>' +
      '<div class="sbr-actions">' +
      '<button type="button" class="sbr-btn sbr-cancel">Cancel</button>' +
      '<button type="button" class="sbr-btn sbr-primary"></button>' +
      '</div>' +
      '</div>';
    root.querySelector('.sbr-title').textContent = title;

    // Remember who had focus before the modal opened so we can put focus
    // back there when it closes — required by WCAG 2.4.3 (Focus Order)
    // for any modal-open / modal-close pair, and by 2.1.2 (No Keyboard
    // Trap) for the trap to be a valid trap (a trap with no escape route
    // is a violation; an Esc handler + focus restore is the escape).
    var dialog = root.querySelector('.sbr-modal');
    root._sbrPrevFocus = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;

    // Focus trap: on Tab / Shift+Tab, if focus is at the first / last
    // focusable element of the dialog, wrap to the other end. WCAG 2.1.2
    // requires that all keyboard focus stays within the dialog while it's
    // open; this is the standard implementation.
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal(root);
        return;
      }
      if (e.key !== 'Tab') return;
      var focusable = sbrFocusableIn(dialog);
      if (!focusable.length) {
        // Nothing focusable — keep focus on the dialog itself.
        e.preventDefault();
        dialog.focus();
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      var active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    root.addEventListener('keydown', onKeyDown);
    root._sbrKeyHandler = onKeyDown;

    document.body.appendChild(root);

    // Move focus into the dialog. Prefer the primary action so the user
    // can hit Enter to confirm; if it's not yet meaningfully labeled
    // (modalShell sets it to '' until the caller fills it in), fall
    // back to the close button or the dialog itself.
    setTimeout(function () {
      var primary = root.querySelector('.sbr-primary');
      var close = root.querySelector('.sbr-close');
      if (primary && primary.textContent.trim()) primary.focus();
      else if (close) close.focus();
      else dialog.focus();
    }, 0);

    return {
      root: root,
      dialog: dialog,
      body: root.querySelector('.sbr-body'),
      primary: root.querySelector('.sbr-primary'),
      cancel: root.querySelector('.sbr-cancel'),
      close: root.querySelector('.sbr-close'),
    };
  }

  function closeModal(root) {
    if (!root) return;
    var prev = root._sbrPrevFocus;
    var handler = root._sbrKeyHandler;
    if (handler) root.removeEventListener('keydown', handler);
    if (root.parentNode) root.parentNode.removeChild(root);
    // Restore focus to the element that had it before the modal opened —
    // unless that element was removed from the DOM in the meantime, in
    // which case silently fall back so we don't throw.
    if (prev && document.body.contains(prev) && typeof prev.focus === 'function') {
      try { prev.focus(); } catch (_) { /* element may have lost focusability */ }
    }
  }

  function previewText(plan) {
    var byFile = {};
    (plan.edits || []).forEach(function (e) {
      if (!byFile[e.filename]) byFile[e.filename] = [];
      byFile[e.filename].push(e);
    });
    var out = [];
    Object.keys(byFile).forEach(function (filename) {
      out.push('--- ' + filename);
      byFile[filename].forEach(function (e) {
        buildLineDiffHunks(e.oldText !== undefined ? e.oldText : '', e.text || '', e.range.startLineNumber, 3)
          .forEach(function (hunk) {
            out.push(hunk.header);
            hunk.rows.slice(0, 120).forEach(function (row) {
              out.push(diffMarker(row.kind) + ' ' + row.text);
            });
          });
      });
    });
    return out.join('\n') || 'No changes.';
  }

  function previewStats(plan) {
    var files = unique((plan.edits || []).map(function (edit) { return edit.filename; }));
    var editCount = (plan.edits || []).length;
    return files.length + ' file' + (files.length === 1 ? '' : 's')
      + ' / ' + editCount + ' edit' + (editCount === 1 ? '' : 's');
  }

  function renderPreview(plan, container, workspace) {
    var byFile = {};
    (plan.edits || []).forEach(function (edit) {
      if (!byFile[edit.filename]) byFile[edit.filename] = [];
      byFile[edit.filename].push(edit);
    });
    var filenames = Object.keys(byFile);
    if (!filenames.length) {
      var empty = document.createElement('div');
      empty.className = 'sbr-preview-empty';
      empty.textContent = 'No changes.';
      container.appendChild(empty);
      return;
    }
    filenames.forEach(function (filename) {
      var section = document.createElement('section');
      section.className = 'sbr-preview-file';
      var header = document.createElement('div');
      header.className = 'sbr-preview-file-header';
      header.textContent = filename;
      section.appendChild(header);
      var hunks = buildPreviewFileHunks(filename, byFile[filename], workspace, 3);
      hunks.forEach(function (previewHunk) {
        var hunk = document.createElement('div');
        hunk.className = 'sbr-preview-hunk';
        var meta = document.createElement('div');
        meta.className = 'sbr-preview-hunk-meta';
        meta.textContent = previewHunk.header;
        hunk.appendChild(meta);
        previewHunk.rows.forEach(function (row) {
          addPreviewLine(hunk, row);
        });
        section.appendChild(hunk);
      });
      container.appendChild(section);
    });
  }

  function addPreviewLine(parent, diffRow) {
    var row = document.createElement('div');
    row.className = 'sbr-preview-line sbr-preview-line-' + diffRow.kind;
    var gutter = document.createElement('span');
    gutter.className = 'sbr-preview-gutter';
    gutter.textContent = diffMarker(diffRow.kind);
    var lineNo = document.createElement('span');
    lineNo.className = 'sbr-preview-line-no';
    lineNo.textContent = diffRow.kind === 'new'
      ? (diffRow.newLine || '')
      : (diffRow.oldLine || '');
    var code = document.createElement('span');
    code.className = 'sbr-preview-code';
    code.textContent = diffRow.text || ' ';
    row.appendChild(gutter);
    row.appendChild(lineNo);
    row.appendChild(code);
    parent.appendChild(row);
  }

  function diffMarker(kind) {
    if (kind === 'old') return '-';
    if (kind === 'new') return '+';
    return ' ';
  }

  function buildLineDiffHunks(oldText, newText, startLineNumber, contextLines) {
    var rows = lineDiffRows(oldText, newText, startLineNumber || 1);
    var changed = [];
    rows.forEach(function (row, idx) {
      if (row.kind !== 'equal') changed.push(idx);
    });
    if (!changed.length) return [];
    contextLines = typeof contextLines === 'number' ? contextLines : 3;
    var ranges = [];
    changed.forEach(function (idx) {
      var start = Math.max(0, idx - contextLines);
      var end = Math.min(rows.length - 1, idx + contextLines);
      var last = ranges[ranges.length - 1];
      if (last && start <= last.end + 1) last.end = Math.max(last.end, end);
      else ranges.push({ start: start, end: end });
    });
    return ranges.map(function (range) {
      var hunkRows = rows.slice(range.start, range.end + 1);
      return {
        header: diffHunkHeader(hunkRows),
        rows: hunkRows.map(function (row) {
          return {
            kind: row.kind === 'equal' ? 'context' : row.kind,
            text: row.text,
            oldLine: row.oldLine,
            newLine: row.newLine,
          };
        }),
      };
    });
  }

  function buildPreviewFileHunks(filename, edits, workspace, contextLines) {
    var file = workspace ? getWorkspaceFile(workspace, filename) : null;
    var source = file && typeof file.content === 'string' ? file.content : null;
    var editList = (edits || []).filter(function (edit) {
      return !edit.filename || edit.filename === filename;
    });
    if (typeof source === 'string') {
      var simulated = applyTextEdits(source, editList);
      if (editList.length === 1 && isFullFileEditRange(editList[0], source)) {
        return buildLineDiffHunks(source, simulated, 1, contextLines);
      }
      return editList.flatMap(function (edit) {
        return buildPreviewEditHunks(edit, source, contextLines);
      });
    }
    return editList.flatMap(function (edit) {
      return buildPreviewEditHunks(edit, source, contextLines);
    });
  }

  function isFullFileEditRange(edit, source) {
    if (!edit || !edit.range) return false;
    var lines = String(source || '').split('\n');
    return edit.range.startLineNumber === 1
      && edit.range.startColumn === 1
      && edit.range.endLineNumber === lines.length
      && edit.range.endColumn === (lines[lines.length - 1] || '').length + 1;
  }

  function buildPreviewEditHunks(edit, source, contextLines) {
    contextLines = typeof contextLines === 'number' ? contextLines : 3;
    if (!edit || !edit.range) return [];
    if (typeof source !== 'string') {
      return buildLineDiffHunks(
        edit.oldText !== undefined ? edit.oldText : '',
        edit.text || '',
        edit.range.startLineNumber,
        contextLines
      );
    }
    var sourceLines = source.split('\n');
    var startLine = Math.max(1, edit.range.startLineNumber - contextLines);
    var endLine = Math.min(sourceLines.length, edit.range.endLineNumber + contextLines);
    var oldWindow = sourceLines.slice(startLine - 1, endLine).join('\n');
    var localRange = {
      startLineNumber: edit.range.startLineNumber - startLine + 1,
      startColumn: edit.range.startColumn,
      endLineNumber: edit.range.endLineNumber - startLine + 1,
      endColumn: edit.range.endColumn,
    };
    var newWindow = applySingleTextEdit(oldWindow, localRange, edit.text || '');
    return buildLineDiffHunks(oldWindow, newWindow, startLine, contextLines);
  }

  function lineDiffRows(oldText, newText, startLineNumber) {
    var oldLines = String(oldText || '').split('\n');
    var newLines = String(newText || '').split('\n');
    var n = oldLines.length;
    var m = newLines.length;
    var table = new Array(n + 1);
    for (var i = 0; i <= n; i++) {
      table[i] = new Array(m + 1).fill(0);
    }
    for (var oi = n - 1; oi >= 0; oi--) {
      for (var ni = m - 1; ni >= 0; ni--) {
        table[oi][ni] = oldLines[oi] === newLines[ni]
          ? table[oi + 1][ni + 1] + 1
          : Math.max(table[oi + 1][ni], table[oi][ni + 1]);
      }
    }
    var rows = [];
    var oldIdx = 0;
    var newIdx = 0;
    while (oldIdx < n || newIdx < m) {
      if (oldIdx < n && newIdx < m && oldLines[oldIdx] === newLines[newIdx]) {
        rows.push({
          kind: 'equal',
          text: oldLines[oldIdx],
          oldLine: startLineNumber + oldIdx,
          newLine: startLineNumber + newIdx,
        });
        oldIdx++;
        newIdx++;
      } else if (oldIdx < n && (
        newIdx >= m
        || table[oldIdx + 1][newIdx] > table[oldIdx][newIdx + 1]
        || (
          table[oldIdx + 1][newIdx] === table[oldIdx][newIdx + 1]
          && !preferInsertionBeforeDeletion(oldLines, newLines, oldIdx, newIdx)
        )
      )) {
        rows.push({
          kind: 'old',
          text: oldLines[oldIdx],
          oldLine: startLineNumber + oldIdx,
          newLine: null,
        });
        oldIdx++;
      } else {
        rows.push({
          kind: 'new',
          text: newLines[newIdx],
          oldLine: null,
          newLine: startLineNumber + newIdx,
        });
        newIdx++;
      }
    }
    return rows;
  }

  function preferInsertionBeforeDeletion(oldLines, newLines, oldIdx, newIdx) {
    var oldLine = oldLines[oldIdx];
    var newLine = newLines[newIdx];
    if (oldLine && oldLine.trim() && lineAppearsAfter(newLines, newIdx, oldLine)) return true;
    if (newLine && newLine.trim() && lineAppearsAfter(oldLines, oldIdx, newLine)) return false;
    return false;
  }

  function lineAppearsAfter(lines, idx, value) {
    for (var i = idx + 1; i < lines.length; i++) {
      if (lines[i] === value) return true;
    }
    return false;
  }

  function diffHunkHeader(rows) {
    var oldLines = rows.filter(function (row) { return row.oldLine !== null && row.oldLine !== undefined; });
    var newLines = rows.filter(function (row) { return row.newLine !== null && row.newLine !== undefined; });
    var oldStart = oldLines.length ? oldLines[0].oldLine : insertionFallbackLine(rows, 'old');
    var newStart = newLines.length ? newLines[0].newLine : insertionFallbackLine(rows, 'new');
    return '@@ -' + oldStart + ',' + oldLines.length + ' +' + newStart + ',' + newLines.length + ' @@';
  }

  function insertionFallbackLine(rows, side) {
    for (var i = 0; i < rows.length; i++) {
      if (side === 'old' && rows[i].newLine) return rows[i].newLine;
      if (side === 'new' && rows[i].oldLine) return rows[i].oldLine;
    }
    return 1;
  }

  function installStyles() {
    if (_styleInstalled || !document || !document.head) return;
    _styleInstalled = true;
    var style = document.createElement('style');
    style.textContent = [
      '.sbr-backdrop{--sbr-bg:#fff;--sbr-text:#111827;--sbr-muted:#4b5563;--sbr-border:#cbd5e1;--sbr-panel:#f8fafc;--sbr-panel-strong:#eef2f7;--sbr-input:#fff;--sbr-primary:#2774ae;--sbr-primary-hover:#1e5f91;--sbr-primary-text:#fff;--sbr-focus:#0ea5e9;--sbr-danger:#9f1239;--sbr-old-bg:#fff1f2;--sbr-old-text:#7f1d1d;--sbr-old-gutter:#be123c;--sbr-new-bg:#ecfdf5;--sbr-new-text:#064e3b;--sbr-new-gutter:#047857;position:fixed;inset:0;z-index:4000;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:18px;color:var(--sbr-text)}',
      'html.dark-mode .sbr-backdrop{--sbr-bg:#111827;--sbr-text:#f8fafc;--sbr-muted:#cbd5e1;--sbr-border:#475569;--sbr-panel:#0f172a;--sbr-panel-strong:#1e293b;--sbr-input:#020617;--sbr-primary:#7dd3fc;--sbr-primary-hover:#bae6fd;--sbr-primary-text:#082f49;--sbr-focus:#38bdf8;--sbr-danger:#fecdd3;--sbr-old-bg:#451a1a;--sbr-old-text:#fecaca;--sbr-old-gutter:#fca5a5;--sbr-new-bg:#052e24;--sbr-new-text:#bbf7d0;--sbr-new-gutter:#86efac;background:rgba(0,0,0,.72)}',
      '.sbr-modal{width:min(840px,calc(100vw - 32px));max-height:min(88vh,780px);background:var(--sbr-bg);color:var(--sbr-text);border:1px solid var(--sbr-border);border-radius:8px;box-shadow:0 22px 70px rgba(0,0,0,.34);display:flex;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.sbr-modal-extract-class{width:min(1280px,calc(100vw - 28px));max-height:min(92vh,940px)}',
      '.sbr-header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid var(--sbr-border);background:var(--sbr-panel)}',
      '.sbr-title{font-weight:750;font-size:15px;line-height:1.3;color:var(--sbr-text)}',
      '.sbr-icon-btn{width:32px;height:32px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--sbr-muted);font-size:22px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}',
      '.sbr-icon-btn:hover{background:var(--sbr-panel-strong);color:var(--sbr-text);border-color:var(--sbr-border)}',
      '.sbr-body{padding:16px;overflow:auto;min-height:80px;line-height:1.45}',
      '.sbr-field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:var(--sbr-text)}',
      '.sbr-input{width:100%;box-sizing:border-box;font:13px Menlo,Consolas,monospace;padding:9px 10px;border:1px solid var(--sbr-border);border-radius:6px;background:var(--sbr-input);color:var(--sbr-text);outline:none}',
      '.sbr-input:focus{border-color:var(--sbr-focus);box-shadow:0 0 0 3px color-mix(in srgb,var(--sbr-focus) 26%,transparent)}',
      '.sbr-error{min-height:18px;color:var(--sbr-danger);font-size:12px;margin-top:7px;font-weight:700}',
      '.sbr-summary{font-size:13px;color:var(--sbr-muted);margin:0 0 10px;max-width:72ch}',
      '.sbr-stats{display:inline-flex;align-items:center;min-height:24px;margin:0 0 12px;padding:3px 9px;border:1px solid var(--sbr-border);border-radius:999px;background:var(--sbr-panel);color:var(--sbr-muted);font-size:12px;font-weight:700}',
      '.sbr-inline-actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 10px}',
      '.sbr-checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin:12px 0 4px}',
      '.sbr-check{display:flex;align-items:center;gap:9px;min-width:0;font:13px Menlo,Consolas,monospace;color:var(--sbr-text);padding:8px 9px;border:1px solid var(--sbr-border);border-radius:6px;background:var(--sbr-panel)}',
      '.sbr-check input{accent-color:var(--sbr-primary);width:15px;height:15px;flex:0 0 auto}',
      '.sbr-check span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sbr-uml-preview{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin:14px 0 4px}',
      '.sbr-uml-panel{min-width:0;border:1px solid var(--sbr-border);border-radius:6px;background:var(--sbr-panel);overflow:hidden}',
      '.sbr-uml-panel-title{padding:7px 10px;border-bottom:1px solid var(--sbr-border);background:var(--sbr-panel-strong);font-size:12px;font-weight:800;color:var(--sbr-muted);text-transform:uppercase;letter-spacing:0}',
      '.sbr-uml-diagram{min-height:360px;max-height:52vh;box-sizing:border-box;overflow:auto;padding:10px;background:var(--sbr-bg)}',
      '.sbr-uml-diagram svg{margin:0 auto;max-width:none}',
      '.sbr-preview{font:12px Menlo,Consolas,monospace;background:var(--sbr-panel);border:1px solid var(--sbr-border);border-radius:6px;max-height:54vh;overflow:auto;color:var(--sbr-text)}',
      '.sbr-preview-file + .sbr-preview-file{border-top:1px solid var(--sbr-border)}',
      '.sbr-preview-file-header{position:sticky;top:0;z-index:1;padding:8px 10px;background:var(--sbr-panel-strong);border-bottom:1px solid var(--sbr-border);font-weight:800;color:var(--sbr-text)}',
      '.sbr-preview-hunk{padding:7px 0}',
      '.sbr-preview-hunk + .sbr-preview-hunk{border-top:1px solid var(--sbr-border)}',
      '.sbr-preview-hunk-meta{padding:3px 10px 6px;color:var(--sbr-muted);font-weight:700}',
      '.sbr-preview-line{display:grid;grid-template-columns:28px 52px minmax(0,1fr);min-height:20px;white-space:pre;tab-size:4}',
      '.sbr-preview-gutter{padding:2px 7px;text-align:center;font-weight:800;user-select:none}',
      '.sbr-preview-line-no{padding:2px 8px;text-align:right;color:var(--sbr-muted);border-right:1px solid color-mix(in srgb,var(--sbr-border) 72%,transparent);user-select:none}',
      '.sbr-preview-code{padding:2px 10px 2px 0;overflow:visible}',
      '.sbr-preview-line-context{background:var(--sbr-bg);color:var(--sbr-text)}',
      '.sbr-preview-line-old{background:var(--sbr-old-bg);color:var(--sbr-old-text)}',
      '.sbr-preview-line-old .sbr-preview-gutter{color:var(--sbr-old-gutter)}',
      '.sbr-preview-line-new{background:var(--sbr-new-bg);color:var(--sbr-new-text)}',
      '.sbr-preview-line-new .sbr-preview-gutter{color:var(--sbr-new-gutter)}',
      '.sbr-preview-empty{padding:18px;color:var(--sbr-muted)}',
      '.sbr-actions{display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;border-top:1px solid var(--sbr-border);background:var(--sbr-panel)}',
      '.sbr-btn{min-height:34px;border:1px solid var(--sbr-border);background:var(--sbr-bg);color:var(--sbr-text);border-radius:6px;padding:7px 14px;font-size:13px;font-weight:800;cursor:pointer}',
      '.sbr-btn:hover{background:var(--sbr-panel-strong)}',
      '.sbr-primary{border-color:var(--sbr-primary);background:var(--sbr-primary);color:var(--sbr-primary-text)}',
      '.sbr-primary:hover{background:var(--sbr-primary-hover);border-color:var(--sbr-primary-hover)}',
      '.sbr-btn:disabled{opacity:.52;cursor:not-allowed}.sbr-btn:disabled:hover{background:var(--sbr-primary);border-color:var(--sbr-primary)}',
      '.sbr-btn:focus-visible,.sbr-icon-btn:focus-visible,.sbr-check:focus-within{outline:2px solid var(--sbr-focus);outline-offset:2px}',
      '.sbr-toast{position:fixed;right:18px;bottom:18px;z-index:4100;max-width:min(420px,calc(100vw - 36px));background:#111827;color:#fff;padding:10px 12px;border-radius:6px;font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.16)}',
      '.sbr-toast.ok{background:#064e3b}.sbr-toast.warn{background:#78350f}.sbr-toast.bad{background:#7f1d1d}',
      'html.dark-mode .sbr-toast{background:#f8fafc;color:#111827;border-color:#cbd5e1}.dark-mode .sbr-toast.ok{background:#bbf7d0;color:#052e16}.dark-mode .sbr-toast.warn{background:#fde68a;color:#451a03}.dark-mode .sbr-toast.bad{background:#fecaca;color:#450a0a}',
      '@media (max-width:640px){.sbr-backdrop{align-items:stretch;padding:10px}.sbr-modal{width:100%;max-height:calc(100vh - 20px)}.sbr-actions{flex-wrap:wrap}.sbr-btn{flex:1 1 120px}.sbr-checks,.sbr-uml-preview{grid-template-columns:1fr}.sbr-uml-diagram{max-height:48vh}}',
    ].join('');
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------------ */
  /* Generic utilities                                                        */
  /* ------------------------------------------------------------------------ */

  function getWorkspaceFile(workspace, filename) {
    var files = workspace.files || [];
    for (var i = 0; i < files.length; i++) {
      if (files[i].filename === filename) return files[i];
    }
    return null;
  }

  function isPythonFile(language, filename) {
    return language === 'python' || /\.py$/i.test(filename || '');
  }

  function isIdentifier(value) {
    return !!(value && IDENT_RE.test(value) && !PYTHON_KEYWORDS.has(value));
  }

  function validateIdentifier(value) {
    if (!isIdentifier(value)) return 'Use a valid Python identifier.';
    return '';
  }

  function validateClassName(value) {
    if (!/^[A-Z]\w*$/.test(value || '')) return 'Use a class-style name such as OrderParams.';
    return '';
  }

  function fullFileEdit(filename, oldContent, newContent) {
    var lines = oldContent.split('\n');
    return {
      filename: filename,
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: lines.length,
        endColumn: (lines[lines.length - 1] || '').length + 1,
      },
      text: newContent,
      oldText: oldContent,
    };
  }

  function lineRange(lines, startLineIdx, endLineIdx) {
    return {
      startLineNumber: startLineIdx + 1,
      startColumn: 1,
      endLineNumber: endLineIdx + 1,
      endColumn: (lines[endLineIdx] || '').length + 1,
    };
  }

  function insertionRangeAtLineEnd(lines, lineIdx) {
    var column = (lines[lineIdx] || '').length + 1;
    return {
      startLineNumber: lineIdx + 1,
      startColumn: column,
      endLineNumber: lineIdx + 1,
      endColumn: column,
    };
  }

  function applySingleTextEdit(content, range, text) {
    var start = offsetAtMonacoPosition(content, range.startLineNumber, range.startColumn);
    var end = offsetAtMonacoPosition(content, range.endLineNumber, range.endColumn);
    return content.slice(0, start) + text + content.slice(end);
  }

  function applyTextEdits(content, edits) {
    var ordered = (edits || []).slice().sort(function (a, b) {
      if (!a.range || !b.range) return 0;
      if (a.range.startLineNumber !== b.range.startLineNumber) {
        return b.range.startLineNumber - a.range.startLineNumber;
      }
      return b.range.startColumn - a.range.startColumn;
    });
    ordered.forEach(function (edit) {
      if (!edit.range) return;
      content = applySingleTextEdit(content, edit.range, edit.text || '');
    });
    return content;
  }

  function offsetAtMonacoPosition(content, lineNumber, column) {
    var lines = content.split('\n');
    var offset = 0;
    for (var i = 0; i < lineNumber - 1; i++) offset += lines[i].length + 1;
    return offset + column - 1;
  }

  function trimCode(line) {
    var idx = codeEndIndex(line || '');
    return (line || '').slice(0, idx).trim();
  }

  function codeEndIndex(line) {
    var quote = null;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (quote) {
        if (ch === '\\') { i++; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '#') return i;
    }
    return line.length;
  }

  function indentOf(line) {
    var m = (line || '').match(/^\s*/);
    return m ? m[0].replace(/\t/g, '    ').length : 0;
  }

  function minIndent(lines, start, end) {
    var min = -1;
    for (var i = start; i <= end; i++) {
      if (!trimCode(lines[i])) continue;
      var ind = indentOf(lines[i]);
      min = min === -1 ? ind : Math.min(min, ind);
    }
    return min;
  }

  function stripIndent(line, count) {
    var remaining = count;
    var i = 0;
    while (i < line.length && remaining > 0) {
      if (line[i] === ' ') { i++; remaining--; }
      else if (line[i] === '\t') { i++; remaining -= 4; }
      else break;
    }
    return line.slice(i);
  }

  function repeat(ch, n) {
    return new Array(Math.max(0, n) + 1).join(ch);
  }

  function splitTopLevel(text, sep) {
    var out = [];
    var start = 0;
    var depth = 0;
    var quote = null;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (ch === sep && depth === 0) {
        out.push(text.slice(start, i));
        start = i + 1;
      }
    }
    out.push(text.slice(start));
    return out;
  }

  function splitOnceTopLevel(text, sep) {
    var depth = 0;
    var quote = null;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (ch === sep && depth === 0) return [text.slice(0, i), text.slice(i + 1)];
    }
    return [text];
  }

  function pascalCase(name) {
    return String(name || 'Value').split(/[_\s-]+/).filter(Boolean)
      .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
      .join('');
  }

  function snakeCase(name) {
    return String(name || 'params')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
  }

  function unique(arr) {
    var seen = {};
    var out = [];
    (arr || []).forEach(function (item) {
      if (item && !seen[item]) { seen[item] = true; out.push(item); }
    });
    return out;
  }

  function hashString(str) {
    var h = 0;
    str = String(str || '');
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  function defaultNotify(message, cls) {
    var toast = document.createElement('div');
    toast.className = 'sbr-toast ' + (cls || '');
    toast.setAttribute('role', cls === 'bad' ? 'alert' : 'status');
    toast.setAttribute('aria-live', cls === 'bad' ? 'assertive' : 'polite');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2600);
  }

  global.SebookRefactorings = {
    attach: attach,
    createPopupHost: createPopupHost,
    registerLanguageAdapter: registerLanguageAdapter,
    adapters: LanguageAdapters,
    _test: {
      PythonAdapter: PythonAdapter,
      computePythonActionAvailability: computePythonActionAvailability,
      buildLineDiffHunks: buildLineDiffHunks,
      buildPreviewFileHunks: buildPreviewFileHunks,
      askText: askText,
      askChoice: askChoice,
      askParameterObject: askParameterObject,
      askExtractClass: askExtractClass,
      validateParameterObjectDialogState: validateParameterObjectDialogState,
      validateExtractClassDialogState: validateExtractClassDialogState,
    },
  };
})(typeof window !== 'undefined' ? window : this);
