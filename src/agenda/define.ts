import createDebugger from 'debug';
import { Agenda } from '.';
import { Job, JobAttributesData } from '../job';

const debug = createDebugger('agenda:define');

export enum JobPriority {
  highest = 20,
  high = 10,
  normal = 0,
  low = -10,
  lowest = -20,
}

/**
 * Internal representation of a defined job
 */
export interface JobDefinition {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: Processor<any>;
  concurrency: number;
  lockLimit: number;
  priority: number | keyof typeof JobPriority;
  lockLifetime: number;
  running: number;
  locked: number;
  shouldSaveResult: boolean;
  attempts: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}

export interface DefineOptions {
  /**
   * Maximum number of that job that can be running at once (per instance of agenda)
   */
  concurrency?: number;

  /**
   * Maximum number of that job that can be locked at once (per instance of agenda)
   */
  lockLimit?: number;

  /**
   * Interval in ms of how long the job stays locked for (see multiple job processors for more info). A job will
   * automatically unlock if done() is called.
   */
  lockLifetime?: number;

  /**
   * (lowest|low|normal|high|highest|number) specifies the priority of the job. Higher priority jobs will run
   * first.
   */
  priority?: keyof typeof JobPriority;

  /**
   * Should the return value of the job be persisted
   */
  shouldSaveResult?: boolean;

  /**
   * Number of attempts to run the job
   * @default 0
   */
  attempts?: number;

  /**
   * Backoff options
   */
  backoff?: {
    /**
     * Type of backoff to use
     * @default exponential
     */
    type: 'exponential' | 'fixed';

    /**
     * Delay in ms
     * @default 1000
     * Math.pow(2, attempts - 1) * delay
     */
    delay: number;
  };
}

export type Processor<T extends JobAttributesData> = (
  job: Job<T>,
  done?: (error?: Error, result?: unknown) => void
) => unknown | Promise<unknown>;

export type DefineMethod<JobNames extends string = string> = <T extends JobAttributesData>(
  name: JobNames,
  processor: Processor<T>,
  options?: DefineOptions
) => void;

/**
 * Setup definition for job
 * Method is used by consumers of lib to setup their functions
 * @name Agenda#define
 * @function
 * @param name name of job
 * @param [processor] function to be called to run actual job
 * @param options options for job to run
 */
export const define: DefineMethod = function (this: Agenda, name, processor, options?) {
  this._definitions[name] = {
    fn: processor,
    concurrency: options?.concurrency || this._defaultConcurrency,
    lockLimit: options?.lockLimit || this._defaultLockLimit,
    priority: options?.priority || JobPriority.normal,
    lockLifetime: options?.lockLifetime || this._defaultLockLifetime,
    running: 0,
    locked: 0,
    shouldSaveResult: options?.shouldSaveResult || false,
    attempts: options?.attempts || 0,
    backoff: options?.attempts
      ? {
          type: options?.backoff?.type || 'exponential',
          delay: options?.backoff?.delay || 1000,
        }
      : undefined,
  };

  debug('job [%s] defined with following options: \n%O', name, this._definitions[name]);
};
