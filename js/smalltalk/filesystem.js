(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  /** Eager, volatile FilePlugin storage. No browser storage or asynchronous reads. */
  class FileSystem {
    constructor() { this.files = new Map(); this.directories = new Set(['/']); this.openFiles = Object.create(null); }
    normalize(name) {
      const pieces = [];
      for (const piece of name.replace(/^\/SqueakJS(?=\/|$)/, '').split('/')) {
        if (piece === '..') { if (!pieces.length) throw Error('Filesystem path escapes root'); pieces.pop(); }
        else if (piece && piece !== '.') pieces.push(piece);
      }
      return '/' + pieces.join('/');
    }
    parent(path) { return path.slice(0, path.lastIndexOf('/')) || '/'; }
    put(name, bytes) {
      const path = this.normalize(name);
      let parent = this.parent(path);
      while (!this.directories.has(parent)) { this.directories.add(parent); parent = this.parent(parent); }
      // Existing open streams retain the same backing record.
      const file = this.files.get(path) || { name: path, refCount: 0 };
      file.contents = new Uint8Array(bytes).slice(); file.size = file.contents.length; file.modified = false;
      this.files.set(path, file);
      return [path.split('/').pop(), 0, 0, false, file.size];
    }
    list(name) {
      const path = this.normalize(name);
      if (!this.directories.has(path)) return null;
      const entries = {};
      for (const directory of this.directories) if (directory !== path && this.parent(directory) === path) {
        const base = directory.split('/').pop(); entries[base] = [base, 0, 0, true, 0];
      }
      for (const [filename, file] of this.files) if (this.parent(filename) === path) {
        const base = filename.split('/').pop(); entries[base] = [base, 0, 0, false, file.size];
      }
      return entries;
    }
    snapshot() { return Array.from(this.files, ([path, file]) => ({ path, bytes: file.contents.slice(0, file.size) })); }
    restore(files) { this.files.clear(); this.directories = new Set(['/']); this.openFiles = Object.create(null); scope.SqueakFiles = this.openFiles; for (const file of files) this.put(file.path, file.bytes); }
    /** Establish image roots before Task3 synchronizes context registers and captures the VM. */
    prepareHandleRoots(vm, nonce) {
      const roots = vm.globalNamed('SEBookCheckpointRoots');
      if (!roots || roots.pointers[0] !== 1) throw api.runtimeError('PRECONDITION_FAILED', 'Missing filesystem checkpoint roots');
      roots.pointers[2] = vm.nilObj; roots.dirty = true;
      vm.image.fullGC('SEBook live file handles');
      const handles = [];
      for (let object = vm.image.firstOldObject; object; object = object.nextObject) if (object.file) handles.push(object);
      roots.pointers[1] = vm.primHandler.makeStString(nonce);
      roots.pointers[2] = vm.primHandler.makeStArray(handles); roots.dirty = true;
      return handles;
    }
    /** Task3 supplies GC-live handles rooted in SEBookCheckpointRoots[3]. Copies preserve aliasing. */
    capture(handles) {
      const ids = new Map(), records = [];
      const recordId = file => {
        if (typeof file === 'string') return { console: file };
        if (!ids.has(file)) {
          if (!(file.contents instanceof Uint8Array)) throw api.runtimeError('PRECONDITION_FAILED', 'Checkpoint requires eager file contents');
          ids.set(file, records.length);
          records.push({ name: file.name, contents: file.contents.slice(), size: file.size, modified: file.modified, refCount: file.refCount });
        }
        return { record: ids.get(file) };
      };
      const paths = Array.from(this.files, ([path, file]) => [path, recordId(file)]);
      const open = Object.entries(this.openFiles).map(([path, file]) => [path, recordId(file)]);
      return { version: 1, directories: [...this.directories], paths, open, records,
        handles: handles.map(handle => ({ file: recordId(handle.file), write: handle.fileWrite, position: handle.filePos })) };
    }
    rebind(state, handles) {
      if (state.version !== 1 || handles.length !== state.handles.length) throw api.runtimeError('PRECONDITION_FAILED', 'Invalid filesystem checkpoint');
      const records = state.records.map(file => ({ ...file, contents: file.contents.slice() }));
      const record = ref => ref.console === undefined ? records[ref.record] : ref.console;
      this.directories = new Set(state.directories);
      this.files = new Map(state.paths.map(([path, ref]) => [path, record(ref)]));
      this.openFiles = Object.fromEntries(state.open.map(([path, ref]) => [path, record(ref)]));
      handles.forEach((handle, index) => {
        const saved = state.handles[index]; handle.file = record(saved.file); handle.fileWrite = saved.write; handle.filePos = saved.position;
      });
      scope.SqueakFiles = this.openFiles;
    }
    install(Squeak) {
      const fs = this;
      scope.SqueakFiles = fs.openFiles;
      Squeak.splitFilePath = name => { const fullname = fs.normalize(name); return { fullname, dirname: fs.parent(fullname), basename: fullname.split('/').pop() }; };
      Squeak.dirList = name => fs.list(name);
      Squeak.filePut = (name, bytes) => fs.put(name, bytes);
      Squeak.flushFile = file => { if (typeof file !== 'string') file.modified = false; };
      Squeak.fileDelete = name => fs.files.delete(fs.normalize(name));
      Squeak.fileRename = (from, to) => {
        from = fs.normalize(from); to = fs.normalize(to);
        const file = fs.files.get(from);
        if (!file || fs.files.has(to) || !fs.directories.has(fs.parent(to))) return false;
        fs.files.delete(from); fs.files.set(to, file); file.name = to;
        if (fs.openFiles[from] === file) { delete fs.openFiles[from]; fs.openFiles[to] = file; }
        return true;
      };
      Squeak.dirCreate = name => { const path = fs.normalize(name); if (fs.directories.has(path) || fs.files.has(path) || !fs.directories.has(fs.parent(path))) return false; fs.directories.add(path); return true; };
      Squeak.dirDelete = name => { const path = fs.normalize(name), entries = fs.list(path); return path !== '/' && entries !== null && !Object.keys(entries).length && fs.directories.delete(path); };
      Squeak.Primitives.prototype.fileOpen = function (name, writable) {
        const path = fs.normalize(name);
        if (!fs.files.has(path) && writable && fs.directories.has(fs.parent(path))) fs.put(path, new Uint8Array());
        const file = fs.files.get(path);
        if (!file) return null;
        file.refCount++; fs.openFiles[path] = file; return file;
      };
      Squeak.Primitives.prototype.fileClose = function (file) {
        Squeak.flushFile(file); file.refCount--;
        if (file.refCount === 0) for (const path of Object.keys(fs.openFiles)) if (fs.openFiles[path] === file) delete fs.openFiles[path];
      };
      Squeak.Primitives.prototype.fileContentsDo = function (file, action) { action(file); return true; };
    }
  }
  api.FileSystem = FileSystem;
})(typeof window === 'object' ? window : self);
