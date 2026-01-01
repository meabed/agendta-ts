import createDebugger from 'debug';
import { Agenda } from '.';
import { Job, JobAttributesData } from '../job';

const debug = createDebugger('agenda:create');

export type CreateMethod<JobNames extends string = string> = <T extends JobAttributesData>(name: JobNames, data: T) => Job<T>;
/**
 * Given a name and some data, create a new job
 * @name Agenda#create
 * @function
 * @param name name of job
 * @param data data to set for job
 */
export const create: CreateMethod = function (this: Agenda, name, data) {
  debug('Agenda.create(%s, [Object])', name);
  const priority = this._definitions[name] ? this._definitions[name].priority : 0;
  const shouldSaveResult = this._definitions[name] ? this._definitions[name].shouldSaveResult || false : false;
  const attempts = this._definitions[name] ? this._definitions[name].attempts || 0 : 0;
  const backoff = attempts
    ? this._definitions[name]
      ? this._definitions[name].backoff || { type: 'exponential' as const, delay: 1000 }
      : { type: 'exponential' as const, delay: 1000 }
    : undefined;

  const job = new Job({
    name,
    data,
    type: 'normal',
    priority,
    shouldSaveResult,
    attempts,
    backoff,
    agenda: this,
  });

  return job;
};
