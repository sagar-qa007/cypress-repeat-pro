#!/usr/bin/env node

// @ts-check

const debug = require('debug')('cypress-repeat');
const cypress = require('cypress');
const arg = require('arg');
const Bluebird = require('bluebird');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

debug('process argv %o', process.argv);

// Path to the summary file
const summaryFilePath = path.join(process.cwd(), 'cy-repeat-summary.txt');

if (fs.existsSync(summaryFilePath)) {
  console.log('Deleting existing summary file');
  try {
    fs.unlinkSync(summaryFilePath);
    console.log('Existing summary file deleted successfully');
  } catch (err) {
    console.error('Error deleting summary file:', err.message);
  }
} else {
  console.log('No existing summary file to delete');
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

const name = 'cypress-repeat-pro:';
const repeatNtimes = args['-n'] || 1;
const untilPasses = args['--until-passes'] || false;
const rerunFailedOnly = args['--rerun-failed-only'] || false;
const forceContinue = args['--force'] || false;

console.log('%s will repeat Cypress command %d time(s)', name, repeatNtimes);
if (untilPasses) console.log('%s but only until it passes', name);
if (rerunFailedOnly) console.log('%s it only reruns specs which have failed', name);
if (forceContinue) console.log('%s will force continue through all iterations', name);

let anyTestFailed = false;
let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;

/**
 * Quick and dirty deep clone
 */
const clone = (x) => JSON.parse(JSON.stringify(x));

const parseArguments = async () => {
  const cliArgs = args._;
  if (cliArgs[0] !== 'cypress') cliArgs.unshift('cypress');
  if (cliArgs[1] !== 'run') cliArgs.splice(1, 0, 'run');
  debug('parsing Cypress CLI %o', cliArgs);
  return await cypress.cli.parseRunArguments(cliArgs);
};

parseArguments()
  .then((options) => {
    debug('parsed CLI options %o', options);
    const allRunOptions = [];

    for (let k = 0; k < repeatNtimes; k++) {
      const runOptions = clone(options);
      const envVariables = `cypress_repeat_n=${repeatNtimes},cypress_repeat_k=${k + 1}`;
      runOptions.env = runOptions.env ? runOptions.env + ',' + envVariables : envVariables;

      if (options.record && options.group) {
        runOptions.group = options.group;
        if (runOptions.group && repeatNtimes > 1) {
          runOptions.group += `-${k + 1}-of-${repeatNtimes}`;
        }
      }

      // Add --force option if explicitly requested
      if (forceContinue) {
        runOptions.force = true;
      }

      allRunOptions.push(runOptions);
    }
    return allRunOptions;
  })
  .then((allRunOptions) => {
    return Bluebird.mapSeries(allRunOptions, (runOptions, k, n) => {
      const isLastRun = k === n - 1;
      console.log('***** %s %d of %d *****', name, k + 1, n);

      const onTestResults = (testResults) => {
        // Update totals
        totalTests += testResults.totalTests || 0;
        totalPassed += testResults.totalPassed || 0;
        totalFailed += testResults.totalFailed || 0;
        totalSkipped += testResults.totalSkipped || 0;

        debug('is %d the last run? %o', k, isLastRun);
        if (rerunFailedOnly && !isLastRun) {
          const failedSpecs = testResults.runs
            .filter((run) => run.stats.failures != 0)
            .map((run) => run.spec.relative)
            .join(',');

          if (failedSpecs.length) {
            console.log('%s failed specs', name);
            console.log(failedSpecs);
            allRunOptions[k + 1].spec = failedSpecs;
          } else {
            console.log('%s there were no failed specs', name);
            if (!forceContinue) {
              return Promise.resolve(); // Prevent early exit
            }
          }
        }

        if (testResults.status === 'failed') {
          if (testResults.failures) {
            console.error(testResults.message);
            anyTestFailed = true;
            if (!forceContinue) {
              return Promise.reject(new Error('Test results indicate failures'));
            }
          }
        }

        if (untilPasses) {
          if (!testResults.totalFailed) {
            console.log('%s successfully passed on run %d of %d', name, k + 1, n);
            return Promise.reject(new Error('No failures detected, exiting with success.'));
          }
          console.error('%s run %d of %d failed', name, k + 1, n);
          if (!forceContinue && k === n - 1) {
            return Promise.reject(new Error('No more attempts left'));
          }
        } else {
          if (testResults.totalFailed) {
            console.error('%s run %d of %d failed', name, k + 1, n);
            if (!forceContinue && (!rerunFailedOnly || isLastRun)) {
              return Promise.reject(new Error('Failures detected and conditions met'));
            }
          }
        }
      };

      return cypress.run(runOptions).then(onTestResults);
    });
  })
  .finally(() => {
    console.log('Entering final result summary block...');
    const resultSummary = [
      '***** Repeat Run Summary *****',
      `Total Tests with repeat: ${totalTests}`,
      `Total Passed: ${totalPassed}`,
      `Total Failed: ${totalFailed}`,
      `Total Skipped: ${totalSkipped}`,
      `*****************************`
    ].join('\n');
    console.log(resultSummary);

    console.log('Writing result summary to file...');
    try {
      const absoluteSummaryFilePath = path.resolve(summaryFilePath);
      fs.writeFileSync(absoluteSummaryFilePath, resultSummary);
      console.log(`Result summary written successfully at: ${absoluteSummaryFilePath}`);
    } catch (err) {
      console.error('Error writing result summary to file:', err.message);
    }

    if (anyTestFailed) {
      console.error('***** Some tests failed during the run(s) *****');
      console.log('Exiting with failure due to test failures.');
    } else {
      console.log('***** finished %d run(s) successfully *****', repeatNtimes);
    }
  })
  .catch((e) => {
    console.error('Error:', e.message);
    if (!forceContinue) {
      console.log('Exiting with failure due to an error.');
    }
  });