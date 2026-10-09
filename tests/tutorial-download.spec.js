// @ts-check
const { execFileSync } = require('node:child_process');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const {
  clickStep, loadTutorialConfig, setTutorialFileContent,
  waitForEditorReady, waitForTutorialReady,
} = require('./tutorial-helpers');

const URL = '/SEBook/tools/homework-3.html?autosave=false';
// These are the submission files required by the course starter and grader.
const SUBMISSION_PATHS = [
  'src/App.jsx', 'src/main.jsx', 'src/styles.css',
  'tic-tac-toe.txt', 'chorus-lapilli.txt', 'test_chorus_lapilli.py',
  'package.json', 'vite.config.js', 'index.html',
].sort();

async function openAssignment(page) {
  await page.goto(URL);
  await waitForTutorialReady(page, { readySelector: 'iframe[title="Live preview"]' });
  await waitForEditorReady(page);
  await expect(page.getByRole('button', { name: 'Download ZIP' })).toBeEnabled();
}

async function readDownload(download, destination) {
  expect(download.suggestedFilename()).toBe('assign.zip');
  await download.saveAs(destination);
  // Use an independent ZIP reader, including CRC validation, rather than the
  // browser's ZIP library to verify its own output.
  return JSON.parse(execFileSync('python3', ['-c', [
    'import json, sys, zipfile',
    'with zipfile.ZipFile(sys.argv[1]) as archive:',
    '    assert archive.testzip() is None',
    '    assert len(archive.namelist()) == len(set(archive.namelist()))',
    '    print(json.dumps({name: archive.read(name).decode("utf-8") for name in archive.namelist()}))',
  ].join('\n'), destination], { encoding: 'utf8' }));
}

test('each assignment section downloads the latest complete project with Auto-save off', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const expected = Object.fromEntries(loadTutorialConfig('homework-3').steps[0].files
    .map(file => [file.path, file.content]));
  await openAssignment(page);
  const downloadButton = page.getByRole('button', { name: 'Download ZIP' });
  const edits = [
    ['src/App.jsx', 'export default function App() { return <h1>My game — 🎲</h1>; }\n'],
    ['test_chorus_lapilli.py', '# My own test draft\n# check a completed game\n'],
    ['chorus-lapilli.txt', 'Moved from 3 to 0.\nRésultat: X wins.\n'],
  ];
  for (let step = 0; step < 3; step++) {
    await clickStep(page, step);
    const [path, content] = edits[step];
    expected[path] = content;
    await setTutorialFileContent(page, path, content);
    // Enter proves the native download control works without a mouse.
    await downloadButton.focus();
    const pendingDownload = page.waitForEvent('download');
    await downloadButton.press('Enter');
    const files = await readDownload(await pendingDownload, testInfo.outputPath(`section-${step}.zip`));
    expect(Object.keys(files).sort()).toEqual(SUBMISSION_PATHS);
    expect(files).toEqual(expected);
    expect(files['tic-tac-toe.txt']).toBe(''); // Empty notebooks must not be omitted.
    await expect(downloadButton).toBeFocused();
  }
  await expect(page.getByRole('status').filter({ hasText: 'assign.zip is ready' })).toBeAttached();
  await a11yCheckpoint(page, 'homework-3-download-ready');
});

test('a ZIP dependency load failure is visible and retry works after reloading', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  // Fault injection at the third-party ZIP library's network boundary.
  await page.route('**/js/vendor/fflate/**', route => route.abort());
  await openAssignment(page);
  const downloads = [];
  page.on('download', download => downloads.push(download));
  await page.getByRole('button', { name: 'Download ZIP' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ZIP download failed' }))
    .toBeVisible();
  await expect(page.getByText(/ZIP support did not load/)).toBeVisible();
  expect(downloads).toHaveLength(0);
  await a11yCheckpoint(page, 'homework-3-download-error');

  await page.unroute('**/js/vendor/fflate/**');
  await openAssignment(page);
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ZIP' }).click();
  const files = await readDownload(await pendingDownload, testInfo.outputPath('retry.zip'));
  expect(Object.keys(files).sort()).toEqual(SUBMISSION_PATHS);
});
