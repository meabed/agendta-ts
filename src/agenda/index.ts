import { EventEmitter } from 'events';
import humanInterval from 'human-interval';
import { AnyError, Collection, IndexSpecification, MongoClient, MongoClientOptions, Db as MongoDb } from 'mongodb';
import { Job, JobAttributes } from '../job';

/**
 * Sort direction for MongoDB queries
 */
export type SortDirection = 1 | -1;

/**
 * Sort specification object for job queries
 */
export interface AgendaSortSpec {
  [key: string]: SortDirection;
}
import { CancelMethod, cancel } from './cancel';
import { CloseMethod, close } from './close';
import { CountJobsMethod, countJobs } from './count-jobs';
import { CreateMethod, create } from './create';
import { DatabaseMethod, database } from './database';
import { DbInitMethod, dbInit } from './db-init';
import { DefaultConcurrencyMethod, defaultConcurrency } from './default-concurrency';
import { DefaultLockLifetimeMethod, defaultLockLifetime } from './default-lock-lifetime';
import { DefaultLockLimitMethod, defaultLockLimit } from './default-lock-limit';
import { DefineMethod, define, JobDefinition } from './define';
import { DisableMethod, disable } from './disable';
import { DrainMethod, drain } from './drain';
import { EnableMethod, enable } from './enable';
import { EveryMethod, every } from './every';
import { findAndLockNextJob } from './find-and-lock-next-job';
import { JobProcessingQueue } from './job-processing-queue';
import { JobsMethod, getJobsRepo, jobs } from './jobs';
import { LockLimitMethod, lockLimit } from './lock-limit';
import { MaxConcurrencyMethod, maxConcurrency } from './max-concurrency';
import { MongoMethod, mongo } from './mongo';
import { NameMethod, name } from './name';
import { NowMethod, now } from './now';
import { ProcessEveryMethod, processEvery } from './process-every';
import { PurgeMethod, purge } from './purge';
import { ResumeOnRestartMethod, resumeOnRestart } from './resume-on-restart';
import { SaveJobMethod, saveJob } from './save-job';
import { ScheduleMethod, schedule } from './schedule';
import { SortMethod, sort } from './sort';
import { StartMethod, start } from './start';
import { StopMethod, stop } from './stop';

/**
 * Base event types that don't require a job name
 */
export type AgendaBaseEventType = 'ready' | 'error';

/**
 * Event types that can be prefixed with a job name (e.g., 'start:myJob')
 */
export type AgendaJobEventType = 'start' | 'success' | 'fail' | 'complete' | 'cancel';

/**
 * Creates prefixed event types for job-specific events
 * e.g., 'start:myJob' | 'success:myJob' | 'fail:myJob' | 'complete:myJob' | 'cancel:myJob'
 */
export type AgendaPrefixedEventType<JobName extends string> = `${AgendaJobEventType}:${JobName}`;

/**
 * All possible event types for the Agenda instance
 * Includes base events, job events, and prefixed job events
 */
export type AgendaOnEventType<JobNames extends string = string> =
  | AgendaBaseEventType
  | AgendaJobEventType
  | AgendaPrefixedEventType<JobNames>;

/**
 * Listener function type for job events (start, success, complete, cancel)
 */
export type AgendaJobListener = (job: Job) => void;

/**
 * Listener function type for fail events
 */
export type AgendaFailListener = (error: Error, job: Job) => void;

/**
 * Listener function type for ready event
 */
export type AgendaReadyListener = () => void;

/**
 * Listener function type for error event
 */
export type AgendaErrorListener = (error: Error) => void;

/**
 * Maps event types to their corresponding listener function types
 */
export type AgendaEventListener<E extends string> = E extends 'ready'
  ? AgendaReadyListener
  : E extends 'error'
    ? AgendaErrorListener
    : E extends 'fail' | `fail:${string}`
      ? AgendaFailListener
      : AgendaJobListener;

export interface AgendaConfig {
  name?: string;
  processEvery?: string;
  maxConcurrency?: number;
  defaultConcurrency?: number;
  lockLimit?: number;
  defaultLockLimit?: number;
  defaultLockLifetime?: number;
  sort?: AgendaSortSpec;
  mongo?: MongoDb;
  db?: {
    address: string;
    collection?: string;
    options?: MongoClientOptions;
  };
  disableAutoIndex?: boolean;
  resumeOnRestart?: boolean;
}

/**
 * @class Agenda
 * @param {Object} config - Agenda Config
 * @param {Function} cb - Callback after Agenda has started and connected to mongo
 * @property {Object} _name - Name of the current Agenda queue
 * @property {Number} _processEvery
 * @property {Number} _defaultConcurrency
 * @property {Number} _maxConcurrency
 * @property {Number} _defaultLockLimit
 * @property {Number} _lockLimit
 * @property {Object} _definitions
 * @property {Object} _runningJobs
 * @property {Object} _lockedJobs
 * @property {Object} _jobQueue
 * @property {Number} _defaultLockLifetime
 * @property {Object} _sort
 * @property {Object} _indices
 * @property {Boolean} _isLockingOnTheFly - true if 'lockingOnTheFly' is currently running. Prevent concurrent execution of this method.
 * @property {Map} _isJobQueueFilling - A map of jobQueues and if the 'jobQueueFilling' method is currently running for a given map. 'lockingOnTheFly' and 'jobQueueFilling' should not run concurrently for the same jobQueue. It can cause that lock limits aren't honored.
 * @property {Array} _jobsToLock
 * @template JobNames - Union type of job name literals for type-safe event handling
 */
class Agenda<JobNames extends string = string> extends EventEmitter {
  private _lazyBindings: Record<string, Function> = {};
  _defaultConcurrency: number;
  _defaultLockLifetime: number;
  _defaultLockLimit: number;
  _definitions: Record<string, JobDefinition>;
  _findAndLockNextJob = findAndLockNextJob;
  _indices: IndexSpecification;
  _disableAutoIndex: boolean;
  _resumeOnRestart: boolean;
  _isLockingOnTheFly: boolean;
  _isJobQueueFilling: Map<string, boolean>;
  _jobQueue: JobProcessingQueue;
  _jobsToLock: Job[];
  _lockedJobs: Job[];
  _runningJobs: Job[];
  _lockLimit: number;
  _maxConcurrency: number;
  _mongoUseUnifiedTopology?: boolean;
  _name?: string;
  _processEvery: number;
  _ready: Promise<unknown>;
  _sort: AgendaSortSpec;
  _db!: MongoClient;
  _mdb!: MongoDb;
  _collection!: Collection<JobAttributes>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _nextScanAt: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _processInterval: any;
  _readyAt: Date;

  /**
   * Constructs a new Agenda object.
   * @param config Optional configuration to initialize the Agenda.
   * @param cb Optional callback called with the MongoDB collection.
   */
  constructor(
    config: AgendaConfig = {},
    cb?: (error: AnyError | undefined, collection: Collection<any> | null) => void
  ) {
    super();

    this._name = config.name;
    this._processEvery = (humanInterval(config.processEvery) ?? humanInterval('5 seconds')) as number; // eslint-disable-line @typescript-eslint/non-nullable-type-assertion-style
    this._defaultConcurrency = config.defaultConcurrency || 5;
    this._maxConcurrency = config.maxConcurrency || 20;
    this._defaultLockLimit = config.defaultLockLimit || 0;
    this._lockLimit = config.lockLimit || 0;
    this._definitions = {};
    this._runningJobs = [];
    this._lockedJobs = [];
    this._jobQueue = new JobProcessingQueue();
    this._defaultLockLifetime = config.defaultLockLifetime || 10 * 60 * 1000; // 10 minute default lockLifetime
    this._sort = config.sort || { nextRunAt: 1, priority: -1 };
    this._indices = {
      name: 1,
      ...this._sort,
      priority: -1,
      lockedAt: 1,
      nextRunAt: 1,
      disabled: 1,
    };
    this._disableAutoIndex = config.disableAutoIndex === true;
    this._resumeOnRestart = config.resumeOnRestart !== false;

    this._isLockingOnTheFly = false;
    this._isJobQueueFilling = new Map<string, boolean>();
    this._jobsToLock = [];
    this._ready = new Promise((resolve) => {
      this.once('ready', resolve);
    });
    this._readyAt = new Date();

    this.init(config, cb);
  }

  /**
   ***************************************
   * Public methods
   * *************************************
   */

  get define(): DefineMethod<JobNames> {
    return this.bindMethod('define', define);
  }

  get every(): EveryMethod<JobNames> {
    return this.bindMethod('every', every);
  }

  get processEvery(): ProcessEveryMethod {
    return this.bindMethod('processEvery', processEvery);
  }

  get cancel(): CancelMethod {
    return this.bindMethod('cancel', cancel);
  }

  get close(): CloseMethod {
    return this.bindMethod('close', close);
  }

  get create(): CreateMethod<JobNames> {
    return this.bindMethod('create', create);
  }

  get dbInit(): DbInitMethod {
    return this.bindMethod('dbInit', dbInit);
  }

  get defaultConcurrency(): DefaultConcurrencyMethod {
    return this.bindMethod('defaultConcurrency', defaultConcurrency);
  }

  get defaultLockLifetime(): DefaultLockLifetimeMethod {
    return this.bindMethod('defaultLockLifetime', defaultLockLifetime);
  }

  get defaultLockLimit(): DefaultLockLimitMethod {
    return this.bindMethod('defaultLockLimit', defaultLockLimit);
  }

  get disable(): DisableMethod {
    return this.bindMethod('disable', disable);
  }

  get enable(): EnableMethod {
    return this.bindMethod('enable', enable);
  }

  get jobs(): JobsMethod {
    return this.bindMethod('jobs', jobs);
  }

  get countJobs(): CountJobsMethod {
    return this.bindMethod('countJobs', countJobs);
  }

  get lockLimit(): LockLimitMethod {
    return this.bindMethod('lockLimit', lockLimit);
  }

  get maxConcurrency(): MaxConcurrencyMethod {
    return this.bindMethod('maxConcurrency', maxConcurrency);
  }

  get name(): NameMethod {
    return this.bindMethod('name', name);
  }

  get now(): NowMethod<JobNames> {
    return this.bindMethod('now', now);
  }

  get purge(): PurgeMethod {
    return this.bindMethod('purge', purge);
  }

  get saveJob(): SaveJobMethod {
    return this.bindMethod('saveJob', saveJob);
  }

  get schedule(): ScheduleMethod<JobNames> {
    return this.bindMethod('schedule', schedule);
  }

  get sort(): SortMethod<JobNames> {
    return this.bindMethod('sort', sort);
  }

  get start(): StartMethod {
    return this.bindMethod('start', start);
  }

  get stop(): StopMethod {
    return this.bindMethod('stop', stop);
  }

  get drain(): DrainMethod {
    return this.bindMethod('drain', drain);
  }

  get mongo(): MongoMethod<JobNames> {
    return this.bindMethod('mongo', mongo);
  }

  get database(): DatabaseMethod<JobNames> {
    return this.bindMethod('database', database);
  }

  get resumeOnRestart(): ResumeOnRestartMethod {
    return this.bindMethod('resumeOnRestart', resumeOnRestart);
  }

  /**
   *
   ***************************************
   * Repository method
   * *************************************
   */
  get getJobsRepo() {
    return this.bindMethod('getJobsRepo', getJobsRepo);
  }

  /**
   *
   ***************************************
   * Overridden methods
   * *************************************
   */

  on<E extends AgendaOnEventType<JobNames>>(event: E, listener: AgendaEventListener<E>): this {
    return super.on(event, listener);
  }

  /**
   ***************************************
   * Private methods
   * *************************************
   */

  private init(config: AgendaConfig, cb?: (error: AnyError | undefined, collection: Collection<any> | null) => void) {
    if (config.mongo) {
      this.mongo(config.mongo, config.db ? config.db.collection : undefined, cb); // @ts-expect-error // the documentation shows it should be correct: http://mongodb.github.io/node-mongodb-native/3.6/api/Db.html
      if (config.mongo.s && config.mongo.topology && config.mongo.topology.s) {
        this._mongoUseUnifiedTopology = Boolean(
          // @ts-expect-error
          config.mongo.topology.s.options.useUnifiedTopology
        );
      }
    } else if (config.db) {
      this.database(config.db.address, config.db.collection, config.db.options, cb);
    }
  }

  private bindMethod<T extends Function>(methodName: string, fn: T): T {
    if (!this._lazyBindings[methodName]) {
      this._lazyBindings[methodName] = fn.bind(this);
    }
    return this._lazyBindings[methodName] as T;
  }
}

export { Agenda };
