(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  /** Pinned VM metadata comparison only. Native Smalltalk owns source interpretation/export. */
  class SourceWatch {
    constructor() { this.records = null; this.classes = null; }
    classSet(vm) {
      const metaclass = vm.globalNamed('Metaclass');
      const classes = new Set();
      vm.allGlobalsDo((name, value) => {
        if (value && value.sqClass && value.sqClass.sqClass === metaclass) classes.add(value);
      });
      return classes;
    }
    reset(vm, descriptors) {
      const depths = new Map(), limits = new Map();
      const visit = (object, depth) => {
        if (!object || typeof object !== 'object' || (depths.has(object) && depths.get(object) >= depth)) return;
        depths.set(object, depth);
        if (depth > 0 && object.pointers) for (const child of object.pointers) visit(child, depth - 1);
      };
      for (const descriptor of descriptors.pointers) {
        visit(descriptor.pointers[0], descriptor.pointers[1]);
        if (Number.isInteger(descriptor.pointers[2])) limits.set(descriptor.pointers[0], descriptor.pointers[2]);
      }
      this.records = Array.from(depths.keys(), object => ({ object, sqClass: object.sqClass, pointerLimit: limits.get(object),
        pointers: object.pointers && object.pointers.slice(0, limits.get(object)),
        bytes: object.bytes && object.bytes.slice(), words: object.words && object.words.slice() }));
      this.classes = this.classSet(vm);
    }
    differs(current, saved, limit) {
      if (!current || !saved) return current !== saved;
      if ((limit === undefined ? current.length : Math.min(current.length, limit)) !== saved.length) return true;
      for (let index = 0; index < saved.length; index++) if (current[index] !== saved[index]) return true;
      return false;
    }
    changed(vm) {
      if (!this.records) return true;
      const classes = this.classSet(vm);
      if (classes.size !== this.classes.size) return true;
      for (const value of classes) if (!this.classes.has(value)) return true;
      for (const record of this.records) {
        if (record.object.sqClass !== record.sqClass || this.differs(record.object.pointers, record.pointers, record.pointerLimit) || this.differs(record.object.bytes, record.bytes) || this.differs(record.object.words, record.words)) return true;
      }
      return false;
    }
  }
  api.SourceWatch = SourceWatch;
})(self);
