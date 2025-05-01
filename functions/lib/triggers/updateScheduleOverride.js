"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.manageScheduleOverride = void 0;
const functions = __importStar(require("firebase-functions"));
// @ts-ignore: CloudScheduler module
const { CloudSchedulerClient } = require('@google-cloud/scheduler');
// Admin SDK initialized in utils/admin
const scheduler = new CloudSchedulerClient();
// Trigger on schedule overrides writes
exports.manageScheduleOverride = functions.firestore
    .document('functionSchedules/{key}')
    .onWrite(async (change, context) => {
    const key = context.params.key;
    const newVal = change.after.exists ? change.after.data().override : null;
    if (!newVal) {
        console.log(`No override for ${key}, skipping.`);
        return null;
    }
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    const location = process.env.FUNCTION_REGION || 'us-central1';
    // Find the existing Cloud Scheduler job for this function
    // list jobs in target location
    const parent = scheduler.projectLocationPath(projectId, location);
    const [jobs] = await scheduler.listJobs({ parent });
    // find job by its final segment matching our key
    const matchJob = jobs.find((j) => j.name.split('/').pop() === key);
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
    }
    catch (err) {
        console.error(`Error updating schedule for ${key}:`, err);
    }
    return null;
});
