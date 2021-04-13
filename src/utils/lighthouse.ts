import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { LighthouseResult } from './types';
import percentageChange from 'percent-change';

async function getLighthouseResult(url: string) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const { lhr: lighthouseResult } = await lighthouse(url, {
    port: chrome.port,
    onlyCategories: ['performance'],
  });
  await chrome.kill();

  return lighthouseResult as LighthouseResult;
}

export const getLighthouseResults = async (
  urls: string[],
): Promise<LighthouseResult[]> => {
  const results: LighthouseResult[] = [];

  for (const url of urls) {
    const result = await getLighthouseResult(url);
    results.push(result);
  }
  return results;
};

export const getPercentageDiff = (previous: number, next: number) => {
  // const increase = next - previous;
  // return (increase / previous) * 100;

  return percentageChange(previous, next, false);
};

const MAX_DIFFERENCE_THRESHOLD = 5;

export const getLhrComparison = (
  previousResult: LighthouseResult,
  nextResult: LighthouseResult,
): Item[] => {
  const fields = [
    'first-contentful-paint',
    'interactive',
    'speed-index',
    'total-blocking-time',
    'largest-contentful-paint',
    'cumulative-layout-shift',
  ] as const;

  const normalizedResult = fields.map<Item>((field) => {
    const prevAudit = previousResult.audits[field];
    const nextAudit = nextResult.audits[field];
    console.log({ prevAudit, nextAudit });

    const percentageDiff = getPercentageDiff(prevAudit.score, nextAudit.score);

    return {
      title: prevAudit.title,
      previousScore: prevAudit.displayValue,
      nextScore: nextAudit.displayValue,
      difference: percentageDiff,
      isAboveThreshold: percentageDiff > MAX_DIFFERENCE_THRESHOLD,
    };
  });

  const performancePercentageDiff = getPercentageDiff(
    nextResult.categories.performance.score,
    previousResult.categories.performance.score,
  );

  const performanceResult = {
    title: 'Performance',
    previousScore: previousResult.categories.performance.score,
    nextScore: nextResult.categories.performance.score,
    difference: performancePercentageDiff,
    isAboveThreshold: performancePercentageDiff > MAX_DIFFERENCE_THRESHOLD,
  };

  normalizedResult.unshift(performanceResult);

  return normalizedResult;
};

const tableHeaderTitles = ['Metric', 'Base', 'Current', '+/- %', ''];

export const getLighthouseResultsTable = (reports: Item[]) => `
  | ${tableHeaderTitles.join(' | ')} |
  | ${tableHeaderTitles.map(() => '---').join(' | ')} |
  ${reports
    .map((report) => {
      let formattedResult: string;

      if (report.difference === 0) {
        formattedResult = '--';
      } else {
        const formattedDifference = `${report.difference > 0 ? '+' : ''}${
          report.difference
        }`;

        if (report.isAboveThreshold) {
          formattedResult = `**${formattedDifference}**`;
        } else {
          formattedResult = formattedDifference;
        }
      }

      return [
        report.title,
        report.previousScore,
        report.nextScore,
        formattedResult,
        report.isAboveThreshold ? '🚫' : '✅',
      ];
    })
    .map((columns) => `| ${columns.join(' | ')} |`)
    .join('\n')}
`;

interface Item {
  title: string;
  previousScore: string | number;
  nextScore: string | number;
  difference: string | number;
  isAboveThreshold: boolean;
}
