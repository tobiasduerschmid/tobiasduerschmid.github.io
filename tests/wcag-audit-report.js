const fs = require('node:fs');
const path = require('node:path');

// Keep a complete JSON checkpoint after each page. A long audit interrupted
// midway still retains all completed-page findings and its current position.
function writeAuditCheckpoint(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const temporaryPath = `${reportPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.renameSync(temporaryPath, reportPath);
}

module.exports = { writeAuditCheckpoint };
