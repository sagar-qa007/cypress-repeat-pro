#!/usr/bin/env node

const debug = require('debug')('cypress-repeat-pro');
const cypress = require('cypress');
const arg = require('arg');
const fs = require('fs');
const path = require('path');

const summaryFilePath = path.join(process.cwd(), 'cy-repeat-summary.txt');
if (fs.existsSync(summaryFilePath)) {
  console.log('Deleting existing summary file');
  try {
    fs.unlinkSync(summaryFilePath);
  } catch (err) {
    console.error('Error deleting summary file:', err.message);
  }
}

const args = arg(
  {
    '-n': Number,
    '--until-passes': Boolean,
    '--rerun-failed-only': Boolean,
    '--force': Boolean,
  },
  { permissive: true }
);

const repeatNtimes = args['-n'] || 1;
const untilPasses = args['--until-passes'] || false;
const rerunFailedOnly = args['--rerun-failed-only'] || false;
const force = args['--force'] || false;

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;
let hasFailures = false;

const runCypress = async (options) => {
  console.log(`Running Cypress with options: ${JSON.stringify(options)}`);
  const testResults = await cypress.run(options);

  totalTests += testResults.totalTests || 0;
  totalPassed += testResults.totalPassed || 0;
  totalFailed += testResults.totalFailed || 0;
  totalSkipped += testResults.totalSkipped || 0;

  if (testResults.status === 'failed') {
    console.error('Cypress run failed.');
    hasFailures = true;
  }

  return testResults;
};

const summarizeResults = () => {
  const resultSummary = [
    '***** Repeat Run Summary *****',
    `Total Tests: ${totalTests}`,
    `Total Passed: ${totalPassed}`,
    `Total Failed: ${totalFailed}`,
    `Total Skipped: ${totalSkipped}`,
    '*****************************',
  ].join('\n');

  console.log(resultSummary);
  try {
    fs.writeFileSync(summaryFilePath, resultSummary);
    console.log(`Result summary written successfully at: ${summaryFilePath}`);
  } catch (err) {
    console.error('Error writing result summary:', err.message);
  }
};

const main = async () => {
  let attempt = 0;
  let failedSpecs = [];

  while (attempt < repeatNtimes) {
    attempt++;
    console.log(`***** Cypress Run Attempt ${attempt}${untilPasses ? '' : ` of ${repeatNtimes}`} *****`);

    const options = { ...args._ };
    if (rerunFailedOnly && failedSpecs.length > 0) {
      options.spec = failedSpecs.join(',');
      console.log(`Re-running failed specs: ${failedSpecs.join(', ')}`);
    }

    const testResults = await runCypress(options);

    if (testResults.totalFailed === 0) {
      console.log('All tests passed successfully!');
      summarizeResults();
      process.exit(0);
    }

    failedSpecs = testResults.runs
      .filter((run) => run.stats.failures > 0)
      .map((run) => run.spec.relative);

    console.log(`Failed specs for re-run: ${failedSpecs.join(', ')}`);

    if (untilPasses && attempt < repeatNtimes) {
      console.log(`Retrying due to --until-passes... Attempt ${attempt + 1}`);
    } else if (!untilPasses && attempt >= repeatNtimes) {
      console.error('Tests failed after maximum retries.');
      summarizeResults();
      process.exit(1);
    }
  }

  if (hasFailures) {
    console.error('Tests failed after maximum retries.');
    summarizeResults();
    process.exit(1);
  }
};

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});