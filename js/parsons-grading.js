/**
 * Parsons grading shared by the quiz include, the tutorial quiz engine and
 * the SE Gym workout, so all three accept exactly the same answers.
 *
 * A Parsons question lists its solution `lines` in one correct order. Its
 * optional `interchangeable` field names runs of lines that do not depend on
 * each other, so a learner may place those runs in any order:
 *
 *   interchangeable: [[[1], [2]], [[5], [6], [7, 8]]]
 *
 * Each group is a list of blocks; each block lists the consecutive line
 * indices that travel together. A group's blocks are adjacent in `lines`.
 * Two groups either cover different lines or one lies inside a single block
 * of the other, so their reorderings combine freely. Lines outside every
 * group keep their authored position. Answers are compared by line text, so
 * identical fragments (`|`, `&&`, `}`) are interchangeable automatically.
 */
(function (global) {
  'use strict';

  // 7! orders. Grading enumerates every accepted order, so the cap keeps a
  // mis-authored declaration from freezing the page.
  const MAX_ACCEPTED_ORDERS = 5040;

  /** Describe what is wrong with an `interchangeable` declaration for a
   * question with `lineCount` solution lines; an empty list means it is valid. */
  function interchangeableProblems(lineCount, groups) {
    if (groups == null) return [];
    if (!Array.isArray(groups)) return ['interchangeable must be a list of groups'];
    const problems = [];
    const spans = [];
    groups.forEach((group, g) => {
      const span = groupSpan(group, lineCount);
      if (typeof span === 'string') problems.push('interchangeable group ' + g + ': ' + span);
      else spans.push(Object.assign({ index: g, blocks: group }, span));
    });
    spans.forEach((a, i) => spans.slice(i + 1).forEach((b) => {
      const disjoint = a.last < b.first || b.last < a.first;
      if (!disjoint && !insideOneBlock(a, b) && !insideOneBlock(b, a)) {
        problems.push('interchangeable groups ' + a.index + ' and ' + b.index
          + ' overlap; one must lie inside a single block of the other');
      }
    }));
    if (problems.length) return problems;
    const orderCount = groups.reduce((count, group) => count * factorial(group.length), 1);
    if (orderCount > MAX_ACCEPTED_ORDERS) {
      problems.push('interchangeable groups allow ' + orderCount + ' orders; the limit is ' + MAX_ACCEPTED_ORDERS);
    }
    return problems;
  }

  // The first and last line a group covers, or a description of why its
  // blocks are not adjacent runs of valid line indices.
  function groupSpan(group, lineCount) {
    if (!Array.isArray(group) || group.length < 2) return 'needs at least two blocks';
    for (let b = 0; b < group.length; b++) {
      const block = group[b];
      if (!isLineRun(block, lineCount)) {
        return 'block ' + b + ' must list consecutive line indices between 0 and ' + (lineCount - 1);
      }
      if (b > 0 && block[0] !== last(group[b - 1]) + 1) {
        return 'block ' + b + ' must start on the line right after block ' + (b - 1);
      }
    }
    return { first: group[0][0], last: last(group[group.length - 1]) };
  }

  function isLineRun(block, lineCount) {
    return Array.isArray(block) && block.length > 0 && block.every((line, k) =>
      Number.isInteger(line) && line >= 0 && line < lineCount && line === block[0] + k);
  }

  function insideOneBlock(inner, outer) {
    return outer.blocks.some((block) => block[0] <= inner.first && inner.last <= last(block));
  }

  /** Grade the lines a learner placed, in order, against a question's
   * `{ lines, interchangeable }`. `lineCorrect[i]` says whether placed line i
   * sits where the closest accepted order puts it, so feedback never flags a
   * line that was only moved within an interchangeable group. A malformed
   * declaration is ignored, leaving only the authored order accepted. */
  function gradeParsonsOrder(solution, placedLines) {
    const lines = solution.lines || [];
    const orders = acceptedOrders(lines.length, usableGroups(lines.length, solution.interchangeable))
      .map((order) => order.map((index) => lines[index]));
    let closest = orders[0];
    let closestMatches = -1;
    orders.forEach((order) => {
      const matches = placedLines.filter((line, i) => line === order[i]).length;
      if (matches > closestMatches) {
        closest = order;
        closestMatches = matches;
      }
    });
    return {
      correct: placedLines.length === lines.length && closestMatches === lines.length,
      lineCorrect: placedLines.map((line, i) => line === closest[i]),
    };
  }

  function usableGroups(lineCount, groups) {
    const problems = interchangeableProblems(lineCount, groups);
    if (!problems.length) return groups || [];
    // Fail closed: a broken declaration must never accept a wrong order.
    global.console.warn('Parsons interchangeable ignored: ' + problems.join('; '));
    return [];
  }

  // Every accepted order as line indices, starting with the authored order.
  function acceptedOrders(lineCount, groups) {
    const authored = Array.from({ length: lineCount }, (_, index) => index);
    return groups.reduce((orders, group) => orders.flatMap((order) => arrangeGroup(order, group)), [authored]);
  }

  // Every arrangement of one group's blocks within `order`. A group applied
  // earlier may have reordered lines inside a block, so each block is read
  // back from `order` by membership instead of from its authored indices.
  function arrangeGroup(order, group) {
    const blockOf = new Map();
    group.forEach((block, b) => block.forEach((line) => blockOf.set(line, b)));
    const start = order.findIndex((line) => blockOf.has(line));
    const end = start + blockOf.size;
    const span = order.slice(start, end);
    const blocks = group.map((_, b) => span.filter((line) => blockOf.get(line) === b));
    return permutations(blocks).map((arrangement) =>
      order.slice(0, start).concat(...arrangement, order.slice(end)));
  }

  function permutations(items) {
    if (items.length <= 1) return [items];
    return items.flatMap((item, i) =>
      permutations(items.slice(0, i).concat(items.slice(i + 1))).map((rest) => [item].concat(rest)));
  }

  function factorial(n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
  }

  function last(items) {
    return items[items.length - 1];
  }

  /** Grade a rendered Parsons card and mark every line: placed lines against
   * the closest accepted order, bank lines as correct exactly when they are
   * distractors. Returns whether the placed answer is accepted. */
  function markParsonsAnswer(cardEl, solution) {
    const placed = Array.from(cardEl.querySelectorAll('.parsons-target .parsons-line'));
    const result = gradeParsonsOrder(solution, placed.map((el) => el.dataset.line));
    placed.forEach((el, i) => markLine(el, result.lineCorrect[i]));
    cardEl.querySelectorAll('.parsons-bank .parsons-line').forEach((el) => {
      markLine(el, el.dataset.distractor === 'true');
    });
    return result.correct;
  }

  function markLine(el, isCorrect) {
    el.classList.remove('parsons-correct', 'parsons-incorrect');
    el.classList.add(isCorrect ? 'parsons-correct' : 'parsons-incorrect');
  }

  const api = { MAX_ACCEPTED_ORDERS, interchangeableProblems, gradeParsonsOrder, markParsonsAnswer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ParsonsGrading = api;
})(typeof window !== 'undefined' ? window : globalThis);
