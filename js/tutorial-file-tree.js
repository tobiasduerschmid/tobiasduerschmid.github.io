/**
 * TutorialFileTree — folder-structure file navigator for tutorial workspaces.
 *
 * buildTree(paths) is a pure function. mount(host, options) renders the
 * WAI-ARIA treeview pattern: a single tab stop (roving tabindex), Up/Down to
 * move, Right/Left to expand, collapse, or move to a child or parent,
 * Home/End, Enter/Space to open a file or toggle a folder, and type-ahead by
 * first letter. Folder expansion lives in memory for the page session only.
 *
 * Loaded as a classic script (window.TutorialFileTree) and by Node tests
 * (module.exports).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TutorialFileTree = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var collator = typeof Intl !== 'undefined' && Intl.Collator
    ? new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
    : null;

  function compareNames(a, b) {
    var order = collator ? collator.compare(a, b) : a.toLowerCase().localeCompare(b.toLowerCase());
    if (order) return order;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function sortTree(node) {
    node.children.sort(function (a, b) {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return compareNames(a.name, b.name);
    });
    node.children.forEach(function (child) {
      if (child.type === 'folder') sortTree(child);
    });
    return node;
  }

  /** Each named segment of a path with the original prefix ending at it. */
  function pathSegments(path) {
    var segments = [];
    var pattern = /[^/]+/g;
    var match;
    while ((match = pattern.exec(path))) {
      segments.push({ name: match[0], prefix: path.slice(0, match.index + match[0].length) });
    }
    return segments;
  }

  /**
   * Nest file paths into folders.
   * @param {string[]} paths
   * @returns {{name: string, path: string, type: 'folder'|'file', children: Array}}
   *   The root folder (name and path ''). Folders sort before files; each
   *   group is alphabetical. A file node's path is exactly its input path.
   */
  function buildTree(paths) {
    var tree = { name: '', path: '', type: 'folder', children: [] };
    var folders = Object.create(null);
    var files = Object.create(null);
    (paths || []).forEach(function (rawPath) {
      var path = String(rawPath);
      if (files[path]) return;
      var segments = pathSegments(path);
      if (!segments.length) return;
      var parent = tree;
      for (var i = 0; i < segments.length - 1; i++) {
        var folder = folders[segments[i].prefix];
        if (!folder) {
          folder = { name: segments[i].name, path: segments[i].prefix, type: 'folder', children: [] };
          folders[folder.path] = folder;
          parent.children.push(folder);
        }
        parent = folder;
      }
      files[path] = { name: segments[segments.length - 1].name, path: path, type: 'file', children: [] };
      parent.children.push(files[path]);
    });
    return sortTree(tree);
  }

  var instanceCount = 0;

  /**
   * Append a file or folder name with a line-break opportunity after each
   * underscore between two other characters (snake_case word boundaries),
   * so a narrow column wraps slow_group_checkout.py between words instead
   * of inside one. The name's text is unchanged.
   */
  function appendBreakableName(target, text) {
    var boundary = /[^_]_(?=[^_])/g;
    var start = 0;
    var match;
    while ((match = boundary.exec(text))) {
      var end = match.index + 2;
      target.appendChild(document.createTextNode(text.slice(start, end)));
      target.appendChild(document.createElement('wbr'));
      start = end;
    }
    target.appendChild(document.createTextNode(text.slice(start)));
  }

  /**
   * Render a navigable tree into host.
   * @param {HTMLElement} host
   * @param {{paths?: string[], activePath?: string, label?: string,
   *          onOpen?: function(string): void}} options
   * @returns {{setPaths: function(string[]): void, setActive: function(string): void,
   *            revealPath: function(string, {scroll?: boolean}=): boolean, destroy: function(): void}}
   */
  function mount(host, options) {
    options = options || {};
    var onOpen = typeof options.onOpen === 'function' ? options.onOpen : function () {};
    var expanded = new Map();   // folder path -> open, for this page session
    var items = new Map();      // node key -> treeitem element
    var activePath = null;
    var labelId = 'tutorial-file-tree-label-' + (++instanceCount);

    var label = document.createElement('p');
    label.className = 'tutorial-file-tree__label';
    label.id = labelId;
    label.textContent = options.label || 'Files';
    var tree = document.createElement('ul');
    tree.className = 'tutorial-file-tree';
    tree.setAttribute('role', 'tree');
    tree.setAttribute('aria-labelledby', labelId);
    host.append(label, tree);

    function keyFor(type, path) { return type + ':' + path; }
    function fileItem(path) { return path ? items.get(keyFor('file', path)) || null : null; }
    function isFolder(item) { return item.hasAttribute('aria-expanded'); }
    function isOpen(item) { return item.getAttribute('aria-expanded') === 'true'; }
    function groupOf(item) { return item.querySelector(':scope > [role="group"]'); }
    function parentItem(item) { return item.parentElement.closest('[role="treeitem"]'); }

    function visibleItems() {
      return Array.prototype.filter.call(tree.querySelectorAll('[role="treeitem"]'), function (item) {
        return !item.closest('[role="group"][hidden]');
      });
    }

    function setExpanded(item, open) {
      item.setAttribute('aria-expanded', open ? 'true' : 'false');
      groupOf(item).hidden = !open;
      expanded.set(item.dataset.path, open);
      if (!open) keepRovingItemVisible();
    }

    function expandAncestors(item) {
      for (var folder = parentItem(item); folder; folder = parentItem(folder)) {
        if (!isOpen(folder)) setExpanded(folder, true);
      }
    }

    function rovingItem() { return tree.querySelector('[role="treeitem"][tabindex="0"]'); }

    function makeRoving(item) {
      var current = rovingItem();
      if (current && current !== item) current.tabIndex = -1;
      item.tabIndex = 0;
    }

    // A tab stop inside a collapsed folder would make the tree unreachable.
    function keepRovingItemVisible() {
      var item = rovingItem();
      while (item && item.closest('[role="group"][hidden]')) item = parentItem(item);
      if (item) makeRoving(item);
    }

    function focusItem(item) {
      if (!item) return;
      makeRoving(item);
      item.focus();
    }

    function createItem(node, level) {
      var item = document.createElement('li');
      item.className = 'tutorial-file-tree__item tutorial-file-tree__item--' + node.type;
      item.setAttribute('role', 'treeitem');
      item.setAttribute('aria-level', String(level));
      // A folder's content includes its children; name it by its own label.
      item.setAttribute('aria-label', node.name);
      item.tabIndex = -1;
      item.dataset.path = node.path;
      var row = document.createElement('span');
      row.className = 'tutorial-file-tree__row';
      var marker = document.createElement('span');
      marker.className = 'tutorial-file-tree__marker';
      marker.setAttribute('aria-hidden', 'true');
      var name = document.createElement('span');
      name.className = 'tutorial-file-tree__name';
      appendBreakableName(name, node.name);
      row.append(marker, name);
      item.appendChild(row);
      items.set(keyFor(node.type, node.path), item);
      if (node.type === 'folder') {
        var group = document.createElement('ul');
        group.className = 'tutorial-file-tree__group';
        group.setAttribute('role', 'group');
        node.children.forEach(function (child) { group.appendChild(createItem(child, level + 1)); });
        item.appendChild(group);
        // Top-level folders start expanded; deeper ones start collapsed.
        var open = expanded.has(node.path) ? expanded.get(node.path) : level === 1;
        item.setAttribute('aria-expanded', open ? 'true' : 'false');
        group.hidden = !open;
      } else {
        item.setAttribute('aria-selected', 'false');
      }
      return item;
    }

    function activate(item) {
      if (isFolder(item)) setExpanded(item, !isOpen(item));
      else onOpen(item.dataset.path);
    }

    function typeAhead(key, list, index) {
      var letter = key.toLowerCase();
      for (var offset = 1; offset <= list.length; offset++) {
        var candidate = list[(index + offset) % list.length];
        if (candidate.getAttribute('aria-label').toLowerCase().indexOf(letter) === 0) {
          focusItem(candidate);
          return;
        }
      }
    }

    function onKeyDown(event) {
      var item = event.target.closest('[role="treeitem"]');
      if (!item || !tree.contains(item) || event.altKey || event.ctrlKey || event.metaKey) return;
      var list = visibleItems();
      var index = list.indexOf(item);
      switch (event.key) {
        case 'ArrowDown': focusItem(list[index + 1]); break;
        case 'ArrowUp': focusItem(list[index - 1]); break;
        case 'Home': focusItem(list[0]); break;
        case 'End': focusItem(list[list.length - 1]); break;
        case 'ArrowRight':
          if (isFolder(item) && !isOpen(item)) setExpanded(item, true);
          else if (isFolder(item)) focusItem(groupOf(item).querySelector(':scope > [role="treeitem"]'));
          break;
        case 'ArrowLeft':
          if (isFolder(item) && isOpen(item)) setExpanded(item, false);
          else focusItem(parentItem(item));
          break;
        case 'Enter':
        case ' ':
          activate(item);
          break;
        default:
          if (event.key.length !== 1) return;
          typeAhead(event.key, list, index);
      }
      event.preventDefault();
    }

    function onClick(event) {
      var item = event.target.closest('[role="treeitem"]');
      if (!item || !tree.contains(item)) return;
      focusItem(item);
      activate(item);
    }

    tree.addEventListener('keydown', onKeyDown);
    tree.addEventListener('click', onClick);

    function scrollRowIntoContainer(item) {
      var row = item.querySelector('.tutorial-file-tree__row') || item;
      for (var element = tree; element && element !== document.body; element = element.parentElement) {
        var overflow = getComputedStyle(element).overflowY;
        if (!/(auto|scroll)/.test(overflow) || element.scrollHeight <= element.clientHeight) continue;
        var box = element.getBoundingClientRect();
        var rect = row.getBoundingClientRect();
        if (rect.top < box.top) element.scrollTop -= box.top - rect.top;
        else if (rect.bottom > box.bottom) element.scrollTop += rect.bottom - box.bottom;
        return;
      }
    }

    /** Highlight the editor's active file and expand the folders above it. */
    function setActive(path) {
      var previous = fileItem(activePath);
      if (previous) {
        previous.setAttribute('aria-selected', 'false');
        previous.classList.remove('is-active');
      }
      activePath = path || null;
      var item = fileItem(activePath);
      if (!item) return;
      item.setAttribute('aria-selected', 'true');
      item.classList.add('is-active');
      if (previous !== item) expandAncestors(item);
      // Entering the tree focuses the open file, as the treeview pattern asks.
      if (!tree.contains(document.activeElement)) makeRoving(item);
    }

    /**
     * Expand the folders containing path and scroll its row into view, unless
     * options.scroll is false (the caller keeps something else in view).
     * @param {string} path
     * @param {{scroll?: boolean}} [options]
     */
    function revealPath(path, options) {
      var item = fileItem(path);
      if (!item) return false;
      expandAncestors(item);
      if (!options || options.scroll !== false) scrollRowIntoContainer(item);
      return true;
    }

    function setPaths(paths) {
      var focused = tree.contains(document.activeElement)
        ? document.activeElement.closest('[role="treeitem"]') : null;
      var focusedKey = focused ? keyFor(isFolder(focused) ? 'folder' : 'file', focused.dataset.path) : null;
      var roving = rovingItem();
      var rovingKey = roving ? keyFor(isFolder(roving) ? 'folder' : 'file', roving.dataset.path) : null;
      items.clear();
      tree.replaceChildren();
      buildTree(paths).children.forEach(function (node) { tree.appendChild(createItem(node, 1)); });
      var restoredActive = activePath;
      activePath = null;
      setActive(restoredActive);
      var target = items.get(focusedKey) || items.get(rovingKey) || fileItem(activePath) || visibleItems()[0];
      if (!target) return;
      makeRoving(target);
      keepRovingItemVisible();
      if (focused) focusItem(rovingItem());
    }

    function destroy() {
      tree.removeEventListener('keydown', onKeyDown);
      tree.removeEventListener('click', onClick);
      label.remove();
      tree.remove();
      items.clear();
    }

    activePath = options.activePath || null;
    setPaths(options.paths || []);

    return { setPaths: setPaths, setActive: setActive, revealPath: revealPath, destroy: destroy };
  }

  return { buildTree: buildTree, mount: mount };
});
