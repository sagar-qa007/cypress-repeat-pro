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
    '--spec': String,
  },
  { permissive: true }
);

const repeatNtimes = args['-n'] || 1;
const untilPasses = args['--until-passes'] || false;
const rerunFailedOnly = args['--rerun-failed-only'] || false;
const spec = args['--spec'] ? args['--spec'].split(',') : [];

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;
let failedTestCases = new Set();
let failedSpecs = [];

const runCypress = async (options) => {
  console.log(`Running Cypress with options: ${JSON.stringify(options)}`);
  const testResults = await cypress.run(options);

  console.log('Cypress run completed.');
  console.log(`Tests run: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.totalPassed}, Failed: ${testResults.totalFailed}, Skipped: ${testResults.totalSkipped}`);

  totalTests += testResults.totalTests || 0;
  totalPassed += testResults.totalPassed || 0;
  totalFailed += testResults.totalFailed || 0;
  totalSkipped += testResults.totalSkipped || 0;

  testResults.runs.forEach((run) => {
    run.tests.forEach((test) => {
      if (test.state === 'failed') {
        failedTestCases.add(`${run.spec.relative} - ${test.title.join(' > ')}`);
      }
    });
  });

  return testResults;
};

const summarizeResults = () => {
  const failedList = Array.from(failedTestCases).join('\n');
  const resultSummary = [
    '***** Repeat Run Summary *****',
    `Total Tests: ${totalTests}`,
    `Total Passed: ${totalPassed}`,
    `Total Failed: ${totalFailed}`,
    `Total Skipped: ${totalSkipped}`,
    '*****************************',
    'Failed Test Cases:',
    failedList || 'None',
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

  while (attempt < repeatNtimes) {
    attempt++;
    console.log(`***** Cypress Run Attempt ${attempt}${untilPasses ? '' : ` of ${repeatNtimes}`} *****`);

    const options = {
      spec: rerunFailedOnly && failedSpecs.length > 0 ? failedSpecs.join(',') : spec.join(','),
    };

    console.log(`Running Cypress with spec: ${options.spec || 'All specs'}`);

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

  summarizeResults();
  process.exit(totalFailed > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});