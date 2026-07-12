const { spawnSync } = require('node:child_process');

const REQUIRED_PDF_TOOLS = Object.freeze([
  Object.freeze({ command: 'cpdf', versionArgs: ['-version'] }),
  Object.freeze({ command: 'qpdf', versionArgs: ['--version'] }),
]);

function installationGuidance(platform = process.platform) {
  if (platform === 'darwin') {
    return 'macOS: brew install cpdf qpdf';
  }
  if (platform === 'linux') {
    return [
      'Linux: install qpdf with your package manager (for example, apt install qpdf).',
      'Install the Coherent PDF CLI from https://www.coherentpdf.com/ and put cpdf on PATH.',
    ].join('\n');
  }
  if (platform === 'win32') {
    return [
      'Windows: install qpdf and the Coherent PDF CLI from their official releases,',
      'then add qpdf.exe and cpdf.exe to PATH.',
    ].join(' ');
  }
  return [
    'Install qpdf and the Coherent PDF CLI for your operating system,',
    'then ensure both qpdf and cpdf are on PATH.',
  ].join(' ');
}

function unavailablePdfTools(run = spawnSync) {
  return REQUIRED_PDF_TOOLS.filter(({ command, versionArgs }) => {
    const result = run(command, versionArgs, { encoding: 'utf8' });
    return Boolean(result.error) || result.status !== 0;
  }).map(({ command }) => command);
}

function assertPdfToolsAvailable(options = {}) {
  const missing = unavailablePdfTools(options.run);
  if (missing.length === 0) return;

  throw new Error([
    `PDF pipeline prerequisite check failed: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} unavailable.`,
    installationGuidance(options.platform),
    'Re-run the command after the tools report a version successfully.',
  ].join('\n'));
}

if (require.main === module) {
  try {
    assertPdfToolsAvailable();
    console.log('PDF tool preflight passed: cpdf and qpdf are available.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  REQUIRED_PDF_TOOLS,
  assertPdfToolsAvailable,
  installationGuidance,
  unavailablePdfTools,
};
