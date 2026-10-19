// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');

const config = loadTutorialConfig('sql');
test.setTimeout(90_000);

// Exercise the actual worker protocol and its SQLite/Wasm engine. These checks
// concern grading, independently of Monaco, navigation and quiz presentation.
async function startWorker(page) {
  // A static text document establishes the real origin without repeatedly
  // loading the print page's unrelated diagram and presentation scripts.
  await page.goto('/robots.txt');
  await page.evaluate(async () => {
    const worker = new Worker('/js/sql-worker.js');
    await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        if (data.type === 'ready') resolve(undefined);
        if (data.type === 'error') reject(new Error(data.message));
      };
      worker.onerror = reject;
    });
    let id = 0;
    window.sqlRequest = (message) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const messages = [];
      worker.onmessage = ({ data }) => {
        messages.push(data);
        if (data.id === requestId) resolve({ ...data, messages });
      };
      worker.onerror = reject;
      worker.postMessage({ ...message, id: requestId });
    });
  });
  for (const sql of config.setup_commands) {
    const result = await request(page, { type: 'runSQL', sql, silent: true });
    expect(result.exitCode).toBe(0);
  }
}

function request(page, message) {
  return page.evaluate((payload) => window.sqlRequest(payload), message);
}

async function grade(page, step, files) {
  for (const file of files) {
    await request(page, { type: 'write', path: '/tutorial/' + file.path, content: file.content });
  }
  const results = [];
  for (const check of step.tests) {
    const result = await request(page, { type: 'runCode', code: check.command });
    results.push({ description: check.description, ...result });
  }
  return results;
}

test('grading a SQL script leaves the learner database unchanged on success or failure', async ({ page }) => {
  await startWorker(page);
  for (const ending of ['', "assert(false, 'Deliberate failed check');"]) {
    await request(page, {
      type: 'runCode',
      code: "__exec('DELETE FROM students'); " + ending,
    });
    const result = await request(page, { type: 'runSQL', sql: 'SELECT COUNT(*) AS n FROM students;' });
    expect(result.messages.find(message => message.type === 'table')?.rows).toEqual([[9]]);
  }
});

for (const step of config.steps) {
  test(`${step.title}: the published solution passes without a prior Run`, async ({ page }) => {
    await startWorker(page);
    const results = await grade(page, step, step.solution.files);
    expect(results.filter(result => result.exitCode !== 0)).toEqual([]);
  });

  test(`${step.title}: an unfinished starter cannot complete the step`, async ({ page }) => {
    await startWorker(page);
    const results = await grade(page, step, step.files);
    expect(results.some(result => result.exitCode !== 0)).toBe(true);
  });
}

function solutionWith(step, path, content) {
  expect(step.solution.files.some(file => file.path === path), `Exercise file ${path}`).toBe(true);
  return step.solution.files.map(file => file.path === path ? { ...file, content } : file);
}

const incorrectQueries = {
  'select-columns': [
    ['columns.sql', 'SELECT * FROM students;', 'extra columns'],
    ['columns.sql', 'SELECT name, major FROM students WHERE id < 9;', 'missing row'],
    ['columns.sql', 'SELECT name, gpa FROM students;', 'wrong column'],
    ['columns.sql', 'SELECT name, major FROM students; SELECT name FROM students;', 'extra result set'],
  ],
  'filter-sort': [
    ['cs-students.sql', "SELECT name, gpa FROM students WHERE major = 'CS' OR gpa >= 3.5 ORDER BY gpa DESC;", 'OR instead of AND'],
    ['cs-students.sql', "SELECT name, gpa FROM students WHERE major = 'CS' AND gpa > 3.5 ORDER BY gpa DESC;", 'exclusive boundary'],
    ['cs-students.sql', "SELECT name, gpa FROM students WHERE major = 'CS' AND gpa >= 3.5 ORDER BY gpa ASC;", 'ascending order'],
    ['cs-students.sql', "SELECT name, gpa FROM students WHERE major = 'CS' AND gpa >= 3.5;", 'unspecified order'],
    ['either.sql', "SELECT name, major FROM students WHERE major = 'Math' AND major = 'Physics';", 'impossible conjunction'],
    ['either.sql', "SELECT name, major FROM students WHERE major = 'Math';", 'only one requested major'],
    ['either.sql', "SELECT name, major FROM students WHERE major != 'CS' OR major IS NULL;", 'extra missing-major row'],
  ],
  'missing-values': [
    ['missing.sql', 'SELECT name FROM students WHERE major = NULL;', 'equality with NULL'],
    ['missing.sql', "SELECT name FROM students WHERE major = 'NULL';", 'NULL text'],
    ['missing.sql', "SELECT name FROM students WHERE name = 'Blue Bella';", 'hardcoded identity'],
    ['outside-cs.sql', "SELECT name, major FROM students WHERE major != 'CS';", 'omitted NULL row'],
    ['outside-cs.sql', "SELECT name, major FROM students WHERE major != 'CS' AND major IS NULL;", 'AND instead of OR'],
    ['outside-cs.sql', "SELECT name, major FROM students WHERE major = 'CS' OR major IS NULL;", 'opposite major comparison'],
  ],
  'join-tables': [
    ['advisors.sql', 'SELECT s.name, m.advisor FROM students s, majors m;', 'Cartesian product with aliases'],
    ['advisors.sql', 'SELECT s.name, m.advisor FROM students s JOIN majors m ON s.name = m.code;', 'wrong join key'],
    ['advisors.sql', 'SELECT s.name, m.advisor FROM students s LEFT JOIN majors m ON s.major = m.code;', 'extra unmatched row'],
    ['all-advisors.sql', 'SELECT s.name, m.advisor FROM students s JOIN majors m ON s.major = m.code;', 'inner join drops student'],
    ['all-advisors.sql', 'SELECT s.name, m.advisor FROM students s, majors m;', 'unmatched cross product'],
    ['all-advisors.sql', "SELECT s.name, COALESCE(m.advisor, 'NULL') AS advisor FROM students s LEFT JOIN majors m ON s.major = m.code;", 'NULL string instead of missing value'],
  ],
  'group-summaries': [
    ['summary.sql', 'SELECT major, COUNT(major) AS n, AVG(gpa) AS avg_gpa FROM students GROUP BY major ORDER BY avg_gpa DESC;', 'count omits NULL'],
    ['summary.sql', 'SELECT major, COUNT(*) AS n, AVG(gpa) AS avg_gpa FROM students GROUP BY major ORDER BY avg_gpa ASC;', 'wrong aggregate sort'],
    ['summary.sql', 'SELECT major, COUNT(*) AS n, SUM(gpa) AS avg_gpa FROM students GROUP BY major ORDER BY avg_gpa DESC;', 'sum instead of average'],
    ['groups.sql', 'SELECT major, COUNT(*) AS n, AVG(gpa) AS avg_gpa FROM students WHERE major IS NOT NULL GROUP BY major HAVING AVG(gpa) > 3.25 ORDER BY avg_gpa DESC;', 'missing boundary group'],
    ['groups.sql', 'SELECT major, COUNT(*) AS n, AVG(gpa) AS avg_gpa FROM students WHERE major IS NOT NULL GROUP BY major HAVING AVG(gpa) > 100 ORDER BY avg_gpa DESC;', 'impossible threshold'],
    ['groups.sql', 'SELECT major, COUNT(*) AS n, AVG(gpa) AS avg_gpa FROM students WHERE major IS NOT NULL GROUP BY major HAVING AVG(gpa) >= 3.25;', 'group-name order is not average order'],
    ['groups.sql', 'SELECT major, COUNT(*) AS n, AVG(gpa) AS avg_gpa FROM students GROUP BY major HAVING AVG(gpa) >= 3.25 ORDER BY avg_gpa DESC;', 'unnamed group can survive'],
    ['groups.sql', 'SELECT major, COUNT(*) AS n, AVG(gpa) AS avg_gpa FROM students WHERE gpa >= 3.25 GROUP BY major ORDER BY avg_gpa DESC;', 'row filter changes averages'],
  ],
  'query-report': [
    ['report.sql', "SELECT s.major, m.advisor, AVG(s.gpa)*10 AS avg_gpa, COUNT(*) AS n FROM students s JOIN majors m ON s.major=m.code WHERE s.year>=2 GROUP BY s.major,m.advisor HAVING AVG(s.gpa)>=3.2 ORDER BY avg_gpa DESC;", 'tenfold averages cannot match counts'],
    ['report.sql', "SELECT s.major, m.advisor, CASE WHEN s.major='Math' THEN 99 ELSE AVG(s.gpa) END AS avg_gpa, COUNT(*) AS n FROM students s JOIN majors m ON s.major=m.code WHERE s.year>=2 GROUP BY s.major,m.advisor HAVING AVG(s.gpa)>=3.2 ORDER BY AVG(s.gpa) DESC;", 'wrong Math average'],
    ['report.sql', 'SELECT s.major, m.advisor, AVG(s.gpa) AS avg_gpa, COUNT(*) AS n FROM students s JOIN majors m ON s.major=m.code GROUP BY s.major,m.advisor HAVING AVG(s.gpa)>=3.2 ORDER BY avg_gpa DESC;', 'missing year filter'],
    ['report.sql', 'SELECT s.major, m.advisor, AVG(s.gpa) AS avg_gpa, COUNT(*) AS n FROM students s JOIN majors m ON s.major=m.code WHERE s.year>=2 GROUP BY s.major,m.advisor HAVING AVG(s.gpa)>=3.2;', 'missing report sort'],
    ['contacts.sql', 'SELECT s.name, m.advisor FROM students s JOIN majors m ON s.major=m.code WHERE s.major IS NULL OR s.gpa>=3.8 ORDER BY s.name;', 'contact inner join drops missing major'],
    ['contacts.sql', 'SELECT s.name, m.advisor FROM students s LEFT JOIN majors m ON s.major=m.code WHERE s.major IS NULL AND s.gpa>=3.8 ORDER BY s.name;', 'contact conditions joined by AND'],
    ['contacts.sql', 'SELECT s.name, m.advisor FROM students s LEFT JOIN majors m ON s.major=m.code WHERE s.major IS NULL OR s.gpa>3.8 ORDER BY s.name;', 'contact boundary excluded'],
  ],
};

for (const [key, candidates] of Object.entries(incorrectQueries)) {
  test(`${key}: reject plausible logical mistakes in the actual submitted SQL`, async ({ page }) => {
    await startWorker(page);
    const step = config.steps.find(step => step.key === key);
    for (const [path, content, reason] of candidates) {
      await test.step(reason, async () => {
        const files = solutionWith(step, path, content);
        const results = await grade(page, step, files);
        // These are valid SQL statements: a syntax/runtime error must not be
        // mistaken for evidence that the intended logical defect was caught.
        const execution = await request(page, { type: 'runCode', code: `db.exec(__read_file(${JSON.stringify(path)}));` });
        expect(execution.exitCode, JSON.stringify(execution.messages)).toBe(0);
        expect(results.some(result => result.exitCode !== 0), reason).toBe(true);
      });
    }
  });
}

const alternatives = {
  'select-columns': [
    ['columns.sql', 'select s.name, s.major from students s;'],
    ['columns.sql', 'SELECT [name], [major] FROM [students] ORDER BY name DESC;'],
  ],
  'filter-sort': [
    ['cs-students.sql', "select name, gpa from students where gpa >= 3.5 and major in ('CS') order by gpa desc;"],
    ['either.sql', "SELECT name, major FROM students WHERE major IN ('Math','Physics');"],
  ],
  'missing-values': [
    ['missing.sql', 'SELECT name FROM students WHERE NOT (major IS NOT NULL);'],
    ['outside-cs.sql', "SELECT name, major FROM students WHERE major IS NULL OR NOT (major = 'CS');"],
  ],
  'join-tables': [
    ['advisors.sql', 'SELECT pupil.name, subject.advisor FROM students pupil, majors subject WHERE subject.code = pupil.major;'],
    ['all-advisors.sql', 'SELECT pupil.name, subject.advisor FROM students pupil LEFT OUTER JOIN majors subject ON subject.code = pupil.major;'],
  ],
  'group-summaries': [
    ['summary.sql', 'SELECT major, COUNT(id) AS n, SUM(gpa)/COUNT(gpa) AS avg_gpa FROM students GROUP BY major ORDER BY AVG(gpa) DESC;'],
    ['groups.sql', 'SELECT major, COUNT(id) AS n, AVG(gpa) AS avg_gpa FROM students GROUP BY major HAVING major IS NOT NULL AND AVG(gpa) >= 3.25 ORDER BY 3 DESC;'],
  ],
  'query-report': [
    ['report.sql', 'SELECT pupil.major, subject.advisor, ROUND(AVG(pupil.gpa),2) AS avg_gpa, COUNT(pupil.id) AS n FROM students pupil, majors subject WHERE subject.code=pupil.major AND pupil.year>=2 GROUP BY subject.advisor,pupil.major HAVING AVG(pupil.gpa)>=3.2 ORDER BY AVG(pupil.gpa) DESC;'],
    ['contacts.sql', 'SELECT pupil.name, subject.advisor FROM students pupil LEFT OUTER JOIN majors subject ON subject.code=pupil.major WHERE pupil.gpa>=3.8 OR pupil.major IS NULL ORDER BY 1 ASC;'],
  ],
};

for (const [key, candidates] of Object.entries(alternatives)) {
  test(`${key}: accept equivalent SQL syntax`, async ({ page }) => {
    await startWorker(page);
    const step = config.steps.find(step => step.key === key);
    for (const [path, content] of candidates) {
      const results = await grade(page, step, solutionWith(step, path, content));
      expect(results.filter(result => result.exitCode !== 0)).toEqual([]);
    }
  });
}

test('data changes recover after a mistaken live Run and leave the query dataset intact', async ({ page }) => {
  await startWorker(page);
  const step = config.steps.find(step => step.key === 'update-delete-drop');
  const broken = await request(page, { type: 'runSQL', sql: step.files[0].content });
  expect(broken.exitCode).toBe(0);
  const results = await grade(page, step, step.solution.files);
  expect(results.filter(result => result.exitCode !== 0)).toEqual([]);
  for (let repetition = 0; repetition < 2; repetition++) {
    const result = await request(page, { type: 'runSQL', sql: step.solution.files[0].content });
    expect(result.messages.find(message => message.type === 'table')?.rows)
      .toEqual([[1, 'Mango', 3.9], [5, 'Kiwi', 3.6], [10, 'Papaya', 3.8]]);
  }
  const untouched = await request(page, { type: 'runSQL', sql: 'SELECT COUNT(*) AS n FROM students;' });
  expect(untouched.messages.find(message => message.type === 'table')?.rows).toEqual([[9]]);
  const report = config.steps.find(step => step.key === 'query-report');
  expect((await grade(page, report, report.solution.files)).filter(result => result.exitCode !== 0)).toEqual([]);
});

for (const key of ['create-insert', 'update-delete-drop']) {
  test(`${key}: reject incorrect stored data or constraints`, async ({ page }) => {
    await startWorker(page);
    const step = config.steps.find(step => step.key === key);
    const file = step.solution.files[0];
    const changes = key === 'create-insert' ? [
      ['name TEXT NOT NULL', 'name TEXT', 'missing required-name constraint'],
      ['id INTEGER PRIMARY KEY', 'id INTEGER', 'duplicate IDs allowed'],
      ["(10, 'Papaya', 3.8)", "(10, 'Papaya', 0.0)", 'wrong inserted value'],
    ] : [
      ['SET gpa = 3.6 WHERE id = 5', 'SET gpa = 3.6', 'UPDATE changes all rows'],
      ['DELETE FROM practice_students WHERE id = 4', 'DELETE FROM practice_students WHERE id = 5', 'DELETE removes Kiwi'],
      ['DROP TABLE draft_notes;', 'DELETE FROM draft_notes;', 'DELETE leaves the table'],
    ];
    for (const [before, after, reason] of changes) {
      expect(file.content.includes(before)).toBe(true);
      const results = await grade(page, step, solutionWith(step, file.path, file.content.replace(before, after)));
      expect(results.some(result => result.exitCode !== 0), reason).toBe(true);
    }
  });

  test(`${key}: accept equivalent data-change statements`, async ({ page }) => {
    await startWorker(page);
    const step = config.steps.find(step => step.key === key);
    const file = step.solution.files[0];
    const changes = key === 'create-insert' ? [
      ['id INTEGER PRIMARY KEY', 'id INTEGER CONSTRAINT student_id PRIMARY KEY'],
      ["(5, 'Kiwi', 3.5),", "(5, 'Kiwi', 3.5); INSERT INTO practice_students (id, name, gpa) VALUES"],
    ] : [
      ['SET gpa = 3.6 WHERE id = 5', 'SET gpa = 3.6 WHERE id IN (5)'],
      ['DROP TABLE draft_notes;', 'DROP TABLE IF EXISTS draft_notes;'],
    ];
    for (const [before, after] of changes) {
      expect(file.content.includes(before)).toBe(true);
      const results = await grade(page, step, solutionWith(step, file.path, file.content.replace(before, after)));
      expect(results.filter(result => result.exitCode !== 0)).toEqual([]);
    }
  });
}
