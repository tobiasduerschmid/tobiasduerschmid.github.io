/** Render Python results as text; Python offsets count Unicode code points. */
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function spanLabel(value) {
  return `[${value.start}, ${value.end})`;
}

function captureLabel(value) {
  if (value.text === null) return 'Did not participate (None)';
  const content = value.text === '' ? 'Empty string ""' : JSON.stringify(value.text);
  return `${content} · ${spanLabel(value)}`;
}

function renderHighlights(target, text, matches) {
  const characters = Array.from(text);
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  matches.forEach((match, index) => {
    fragment.append(document.createTextNode(characters.slice(cursor, match.start).join('')));
    const isEmpty = match.start === match.end;
    const mark = element('mark', isEmpty ? '◇' : match.text, isEmpty ? 'regex-empty-match' : '');
    mark.setAttribute('role', 'group');
    mark.setAttribute('aria-label', isEmpty
      ? `Empty match ${index + 1} at position ${match.start}`
      : `Match ${index + 1} at ${spanLabel(match)}`);
    fragment.append(mark);
    cursor = match.end;
  });
  fragment.append(document.createTextNode(characters.slice(cursor).join('')));
  if (text === '' && matches.length === 0) fragment.append(element('span', '(empty text)'));
  target.replaceChildren(fragment);
}

function renderMatch(match, index) {
  const card = element('section', undefined, 'regex-match');
  const heading = element('h3', `Match ${index + 1}`);
  const value = element('p', captureLabel(match), 'regex-match-value');
  card.append(heading, value);
  if (match.groups.length === 0) {
    card.append(element('p', 'No capture groups.'));
    return card;
  }
  const groups = element('dl', undefined, 'regex-group-list');
  for (const group of match.groups) {
    const label = `Group ${group.number}${group.name ? ` · ${group.name}` : ''}`;
    groups.append(element('dt', label), element('dd', captureLabel(group)));
  }
  card.append(groups);
  return card;
}

function renderExplanation(target, explanation) {
  const items = explanation.map(part => {
    const item = element('li', undefined, `regex-explanation-depth-${Math.min(part.depth, 5)}`);
    item.append(element('strong', part.label), element('span', ` — ${part.detail}`, 'regex-explanation-detail'));
    return item;
  });
  target.replaceChildren(...items);
}

/** View owns DOM output only. The controller owns requests and cancellation. */
export function createRegexView(root) {
  const find = id => root.querySelector(`#regex-${id}`);
  let debugResult = null;
  let debugText = '';
  let probeIndex = 0;

  function renderProbe() {
    if (!debugResult || debugResult.probes.length === 0) return;
    const probe = debugResult.probes[probeIndex];
    const characters = Array.from(debugText);
    const marker = element('span', '│', 'regex-cursor');
    marker.setAttribute('role', 'img');
    marker.setAttribute('aria-label', `Starting position ${probe.position}`);
    find('probe-text').replaceChildren(
      document.createTextNode(characters.slice(0, probe.position).join('')),
      marker,
      document.createTextNode(characters.slice(probe.position).join(''))
    );
    const outcome = probe.matched
      ? `Matched ${captureLabel(probe)}.`
      : 'No match at this starting position.';
    find('probe-status').textContent = `Position ${probe.position}: ${outcome} Step ${probeIndex + 1} of ${debugResult.probes.length}.`;
    find('probe-first').disabled = probeIndex === 0;
    find('probe-prev').disabled = probeIndex === 0;
    find('probe-next').disabled = probeIndex === debugResult.probes.length - 1;
  }

  function clearError() {
    find('error').hidden = true;
    find('error').textContent = '';
    for (const field of ['pattern', 'text', 'replacement']) find(field).removeAttribute('aria-invalid');
  }

  function clear() {
    find('results').hidden = true;
    clearError();
    debugResult = null;
  }

  function showError(error) {
    find('results').hidden = true;
    const location = error.position == null ? '' : ` Position ${error.position} (zero-based).`;
    find('error').textContent = `${error.message}${location}`;
    find('error').hidden = false;
    if (['pattern', 'text', 'replacement'].includes(error.field)) find(error.field).setAttribute('aria-invalid', 'true');
  }

  function render(result, request, operationLabel) {
    debugResult = result;
    debugText = request.text;
    probeIndex = 0;
    const count = result.matches.length;
    const summary = result.truncated
      ? `Showing the first ${count} matches; more matches exist.`
      : `${count} ${count === 1 ? 'match' : 'matches'}.`;
    find('summary').textContent = `${summary} ${operationLabel}.`;
    renderHighlights(find('highlight'), request.text, result.matches);
    find('matches').replaceChildren(...result.matches.map(renderMatch));
    if (count === 0) find('matches').append(element('p', 'No match. Try a smaller input or inspect the starting positions below.'));
    find('output-field').hidden = result.output === null;
    find('output').textContent = result.output === '' ? '(empty string)' : (result.output ?? '');
    renderExplanation(find('explanation'), result.explanation);
    find('debug').textContent = result.debug;
    find('version').textContent = `Python ${result.version} · re · runs in your browser`;
    find('probe-limit').hidden = !result.probesTruncated;
    find('probe-limit').textContent = 'Only the first 100 starting positions are shown. Matches above still use the entire test text.';
    find('results').hidden = false;
    renderProbe();
    return summary;
  }

  function step(direction) {
    if (!debugResult) return;
    probeIndex = direction === 'first' ? 0 : Math.max(0, Math.min(debugResult.probes.length - 1, probeIndex + direction));
    renderProbe();
  }

  return { clear, clearError, showError, render, step };
}
