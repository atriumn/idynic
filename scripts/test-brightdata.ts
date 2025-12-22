/**
 * Quick test script for Bright Data LinkedIn job enrichment
 *
 * Usage: npx tsx scripts/test-brightdata.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { fetchLinkedInJob, isLinkedInJobUrl } from '../src/lib/integrations/brightdata';

const TEST_JOB_URL =
  'https://www.linkedin.com/jobs/view/4305273104/?trk=eml-email_jobs_viewed_job_reminder_01-job_card-0-jobcard_body';

async function main() {
  console.log('Testing Bright Data LinkedIn Jobs Integration\n');

  // Test URL detection
  console.log('1. Testing URL detection:');
  console.log(`   isLinkedInJobUrl("${TEST_JOB_URL}")`);
  console.log(`   Result: ${isLinkedInJobUrl(TEST_JOB_URL)}`);
  console.log();

  // Test API fetch
  console.log('2. Fetching job data from Bright Data...');
  try {
    const job = await fetchLinkedInJob(TEST_JOB_URL);
    console.log('\n   ✅ Success!\n');
    console.log('   Job Title:', job.job_title);
    console.log('   Company:', job.company_name);
    console.log('   Location:', job.job_location);
    console.log('   Seniority:', job.job_seniority_level);
    console.log('   Employment Type:', job.job_employment_type);
    console.log(
      '   Salary:',
      job.base_salary
        ? `${job.base_salary.currency}${job.base_salary.min_amount} - ${job.base_salary.currency}${job.base_salary.max_amount}/${job.base_salary.payment_period}`
        : 'Not specified'
    );
    console.log('   Applicants:', job.job_num_applicants);
    console.log('   Easy Apply:', job.is_easy_apply);
    console.log('   Description length:', job.job_summary.length, 'chars');
  } catch (error) {
    console.log('\n   ❌ Error:', error);
  }
}

main();
