import * as functions from 'firebase-functions';
import { db, default as admin } from '../utils/admin';
// @ts-ignore: CloudScheduler module
const { CloudSchedulerClient } = require('@google-cloud/scheduler');

// Admin SDK initialized in utils/admin
const scheduler = new CloudSchedulerClient();

// Trigger on schedule overrides writes
export const manageScheduleOverride = functions.firestore
  .document('functionSchedules/{key}')
  .onWrite(async (change, context) => {
    const key = context.params.key;
    const newVal = change.after.exists ? (change.after.data() as any).override : null;
    if (!newVal) {
      console.log(`No override for ${key}, skipping.`);
      return null;
    }
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    const location = process.env.FUNCTION_REGION || 'us-central1';
    // Find the existing Cloud Scheduler job for this function
    // list jobs in target location
    const parent = scheduler.projectLocationPath(projectId!, location);
    const [jobs] = await scheduler.listJobs({ parent });
    // find job by its final segment matching our key
    const matchJob = jobs.find((j: any) => j.name.split('/').pop() === key);
    if (!matchJob) {
      console.error(`Scheduler job for ${key} not found`);
      return null;
    }
    const jobName = matchJob.name;
    try {
      await scheduler.updateJob({
        job: { name: jobName, schedule: newVal },
        updateMask: { paths: ['schedule'] }
      });
      console.log(`Updated schedule for ${key} to ${newVal}`);
    } catch (err) {
      console.error(`Error updating schedule for ${key}:`, err);
    }
    return null;
  });
