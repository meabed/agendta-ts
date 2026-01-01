import createDebugger from 'debug';
import { ReturnDocument } from 'mongodb';
import { Agenda } from '.';
import { JobDefinition } from './define';
import { Job } from '../job';
import { createJob } from '../utils';

const debug = createDebugger('agenda:internal:_findAndLockNextJob');

/**
 * Find and lock jobs
 * @name Agenda#findAndLockNextJob
 * @function
 * @param jobName name of job to try to lock
 * @param definition definition used to tell how job is run
 * @access protected
 * @caller jobQueueFilling() only
 */
export const findAndLockNextJob = async function (
  this: Agenda,
  jobName: string,
  definition: JobDefinition
): Promise<Job | undefined> {
  const now = new Date();
  const lockDeadline = new Date(Date.now().valueOf() - definition.lockLifetime);
  debug('_findAndLockNextJob(%s, [Function])', jobName);

  const JOB_PROCESS_WHERE_QUERY = {
    $and: [
      {
        name: jobName,
        disabled: { $ne: true },
      },
      {
        $or: [
          {
            lockedAt: { $eq: null },
            nextRunAt: { $lte: this._nextScanAt },
          },
          {
            lockedAt: { $lte: lockDeadline },
          },
        ],
      },
    ],
  };

  /**
   * Query used to set a job as locked
   * @type {{$set: {lockedAt: Date}}}
   */
  const JOB_PROCESS_SET_QUERY = { $set: { lockedAt: now } };

  /**
   * Query used to affect what gets returned
   * @type {{returnOriginal: boolean, sort: object}}
   */

  const JOB_RETURN_QUERY = { includeResultMetadata: true, returnDocument: ReturnDocument.AFTER, sort: this._sort };

  // Find ONE and ONLY ONE job and set the 'lockedAt' time so that job begins to be processed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await this._collection.findOneAndUpdate(
    JOB_PROCESS_WHERE_QUERY,
    JOB_PROCESS_SET_QUERY,
    JOB_RETURN_QUERY
  );

  let job: Job | undefined = undefined;
  // With includeResultMetadata: true, result has { value: Document | null, ... } structure
  if (result?.value) {
    debug('found a job available to lock, creating a new job on Agenda with id [%s]', result.value._id);

    job = createJob(this, result.value);
  }
  return job;
};
