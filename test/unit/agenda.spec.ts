/* eslint-disable no-console,no-unused-expressions,@typescript-eslint/no-unused-expressions */

import { Db } from 'mongodb';

import { Agenda } from '../../src';
import { Job } from '../../src';
import { hasMongoProtocol } from '../../src/agenda/has-mongo-protocol';
import { mockMongoDb, stopMongoServer } from '../helpers/mock.helper';

describe('Test Agenda', () => {
  const jobTimeout = 500;
  const jobProcessor = () => {};

  let globalAgendaInstance: Agenda;
  let mongoDb: Db;
  let mongoDbConfig: string;
  let mongoDbDisconnect: () => Promise<void>;
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const clearJobs = async (): Promise<void> => {
    if (mongoDb) {
      await mongoDb.collection('agendaJobs').deleteMany({});
    }
  };

  beforeEach(async () => {
    const { mongo, uri, disconnect } = await mockMongoDb();
    mongoDb = mongo.db();
    mongoDbConfig = uri;
    mongoDbDisconnect = disconnect;
    globalAgendaInstance = new Agenda({ mongo: mongoDb });
    delay(50);
    await clearJobs();
    ['someJob', 'send email', 'some job'].forEach((job) => {
      globalAgendaInstance.define(job, jobProcessor);
    });
  });

  afterEach(async () => {
    await clearJobs();
    await globalAgendaInstance.stop();
  });

  afterAll(async () => {
    await delay(50);
    await mongoDbDisconnect();
    await stopMongoServer();
  });

  describe('Test config', () => {
    describe('Test mongo connection tester', () => {
      test('passing a valid server connection string', () => {
        expect(hasMongoProtocol(mongoDbConfig)).toEqual(true);
      });

      test('passing a valid multiple server connection string', () => {
        expect(hasMongoProtocol(`mongodb+srv://localhost/agenda-test`)).toEqual(true);
      });

      test('passing an invalid connection string', () => {
        expect(hasMongoProtocol(`localhost/agenda-test`)).toEqual(false);
      });
    });
    describe('Test mongo', () => {
      test('sets the _db directly when passed as an option', () => {
        const agendaDb = new Agenda({ mongo: mongoDb });
        expect(agendaDb._mdb).not.toBeUndefined();
      });

      test('sets the _db directly', () => {
        const agenda = new Agenda();
        agenda.mongo(mongoDb);
        expect(agenda._mdb).not.toBeUndefined();
      });

      test('returns itself', async () => {
        const agenda = new Agenda();
        expect(await agenda.mongo(mongoDb)).toEqual(agenda);
      });
    });

    describe('Test processEvery', () => {
      test('sets the default processEvery', () => {
        expect(globalAgendaInstance._processEvery).toEqual(5000);
      });
      test('sets the custom processEvery', () => {
        const agenda = new Agenda({ processEvery: '3 minutes' });
        expect(agenda._processEvery).toEqual(180000);
      });
      test('returns itself', () => {
        expect(globalAgendaInstance.processEvery('3 minutes')).toEqual(globalAgendaInstance);
      });
    });

    describe('Test name', () => {
      test('sets the agenda name', () => {
        globalAgendaInstance.name('test queue');
        expect(globalAgendaInstance._name).toEqual('test queue');
      });
      test('returns itself', () => {
        expect(globalAgendaInstance.name('test queue')).toEqual(globalAgendaInstance);
      });
    });

    describe('Test maxConcurrency', () => {
      test('sets the default maxConcurrency', () => {
        expect(globalAgendaInstance._maxConcurrency).toEqual(20);
      });

      test('sets the custom maxConcurrency', () => {
        globalAgendaInstance.maxConcurrency(10);
        expect(globalAgendaInstance._maxConcurrency).toEqual(10);
      });
      test('returns itself', () => {
        expect(globalAgendaInstance.maxConcurrency(10)).toEqual(globalAgendaInstance);
      });
    });

    describe('Test default defaultConcurrency', () => {
      test('sets the defaultConcurrency', () => {
        expect(globalAgendaInstance._defaultConcurrency).toEqual(5);
      });

      test('sets the custom defaultConcurrency', () => {
        globalAgendaInstance.defaultConcurrency(1);
        expect(globalAgendaInstance._defaultConcurrency).toEqual(1);
      });
      test('returns itself', () => {
        expect(globalAgendaInstance.defaultConcurrency(1)).toEqual(globalAgendaInstance);
      });

      test('is inherited by jobs', () => {
        globalAgendaInstance.defaultConcurrency(10);
        globalAgendaInstance.define('testDefaultConcurrency', () => {});
        expect(globalAgendaInstance._definitions.testDefaultConcurrency.concurrency).toEqual(10);
      });
    });

    describe('Test lockLimit', () => {
      test('sets the default lockLimit', () => {
        expect(globalAgendaInstance._lockLimit).toEqual(0);
      });

      test('sets the custom lockLimit', () => {
        globalAgendaInstance.lockLimit(10);
        expect(globalAgendaInstance._lockLimit).toEqual(10);
      });
      test('returns itself', () => {
        expect(globalAgendaInstance.lockLimit(10)).toEqual(globalAgendaInstance);
      });
    });

    describe('Test defaultLockLimit', () => {
      test('sets the default defaultLockLimit', () => {
        expect(globalAgendaInstance._defaultLockLimit).toEqual(0);
      });

      test('sets the custom defaultLockLimit', () => {
        globalAgendaInstance.defaultLockLimit(1);
        expect(globalAgendaInstance._defaultLockLimit).toEqual(1);
      });
      test('returns itself', () => {
        expect(globalAgendaInstance.defaultLockLimit(5)).toEqual(globalAgendaInstance);
      });

      test('is inherited by jobs', () => {
        globalAgendaInstance.defaultLockLimit(10);
        globalAgendaInstance.define('testDefaultLockLimit', () => {});
        expect(globalAgendaInstance._definitions.testDefaultLockLimit.lockLimit).toEqual(10);
      });
    });

    describe('Test defaultLockLifetime', () => {
      test('sets the default defaultLockLifetime', () => {
        expect(globalAgendaInstance._defaultLockLifetime).toEqual(600000);
      });

      test('sets the custom defaultLockLifetime', () => {
        globalAgendaInstance.defaultLockLifetime(9999);
        expect(globalAgendaInstance._defaultLockLifetime).toEqual(9999);
      });

      test('returns itself', () => {
        expect(globalAgendaInstance.defaultLockLifetime(1000)).toEqual(globalAgendaInstance);
      });

      test('is inherited by jobs', () => {
        globalAgendaInstance.defaultLockLifetime(7777);
        globalAgendaInstance.define('testDefaultLockLifetime', () => {});
        expect(globalAgendaInstance._definitions.testDefaultLockLifetime.lockLifetime).toEqual(7777);
      });
    });

    describe('Test sort', () => {
      test('sets the default sort', () => {
        expect(globalAgendaInstance._sort).toEqual({ nextRunAt: 1, priority: -1 });
      });

      test('sets the custom sort', () => {
        globalAgendaInstance.sort({ nextRunAt: -1 });
        expect(globalAgendaInstance._sort).toEqual({ nextRunAt: -1 });
      });

      test('returns itself', () => {
        expect(globalAgendaInstance.sort({ nextRunAt: 1, priority: 1 })).toEqual(globalAgendaInstance);
      });
    });

    describe('Test resumeOnRestart', () => {
      test('sets the default resumeOnRestart', () => {
        expect(globalAgendaInstance._resumeOnRestart).toBeTruthy();
      });

      test('sets the custom resumeOnRestart', () => {
        globalAgendaInstance.resumeOnRestart(false);
        expect(globalAgendaInstance._resumeOnRestart).toBeFalsy();
      });

      test('returns itself', () => {
        expect(globalAgendaInstance.resumeOnRestart(false)).toEqual(globalAgendaInstance);
      });

      // test('should not reschedule successfully finished non-recurring jobs', async () => {
      //   const job = globalAgendaInstance.create('sendEmail', { to: 'user@example.com' });
      //   job.attrs.lastFinishedAt = new Date();
      //   job.attrs.nextRunAt = null;
      //   await job.save();

      //   await globalAgendaInstance.resumeOnRestart();

      //   const updatedJob = (await globalAgendaInstance.jobs({ name: 'sendEmail' }))[0];
      //   expect(updatedJob.attrs.nextRunAt).toBeNull();
      // });

      test('should resume non-recurring jobs on restart', async () => {
        const job = globalAgendaInstance.create('sendEmail', { to: 'user@example.com' });
        job.attrs.nextRunAt = new Date(Date.now() - 2000);
        await job.save();

        await globalAgendaInstance.resumeOnRestart();

        const updatedJob = (await globalAgendaInstance.jobs({ name: 'sendEmail' }))[0];
        expect(updatedJob.attrs.nextRunAt?.getTime()).toBeGreaterThan(Date.now() - 2300);
      });

      test('should resume recurring jobs on restart - interval', async () => {
        const job = globalAgendaInstance.create('sendEmail', { to: 'user@example.com' });
        job.attrs.repeatInterval = '5 minutes';
        job.attrs.nextRunAt = null;
        await job.save();

        await globalAgendaInstance.resumeOnRestart();

        const updatedJob = (await globalAgendaInstance.jobs({ name: 'sendEmail' }))[0];
        expect(updatedJob.attrs.nextRunAt).not.toBeNull();
      });

      test('should compute nextRunAt after running a recurring job', async () => {
        let executionCount = 0;

        globalAgendaInstance.define('recurringJob', async () => {
          executionCount++;
        });

        const job = globalAgendaInstance.create('recurringJob', { key: 'value' });
        job.attrs.repeatInterval = '5 minutes';
        await job.save();

        globalAgendaInstance.processEvery('1 second');
        await globalAgendaInstance.start();

        await new Promise((resolve) => setTimeout(resolve, 4000));

        const updatedJob = (await globalAgendaInstance.jobs({ name: 'recurringJob' }))[0];

        expect(executionCount).toBeGreaterThan(0);
        expect(updatedJob.attrs.lastRunAt).not.toBeNull();
        expect(updatedJob.attrs.nextRunAt).not.toBeNull();
        expect(updatedJob.attrs.nextRunAt?.getTime()).toBeGreaterThan(Date.now() - 100);
      });

      test('should resume recurring jobs on restart - cron', async () => {
        const job = globalAgendaInstance.create('sendEmail', { to: 'user@example.com' });
        job.attrs.repeatInterval = '*/5 * * * *';
        job.attrs.nextRunAt = null;
        await job.save();

        await globalAgendaInstance.resumeOnRestart();

        const updatedJob = (await globalAgendaInstance.jobs({ name: 'sendEmail' }))[0];
        expect(updatedJob.attrs.nextRunAt).not.toBeNull();
      });

      test('should resume recurring jobs on restart - repeatAt', async () => {
        const job = globalAgendaInstance.create('sendEmail', { to: 'user@example.com' });
        job.attrs.repeatAt = '1:00 am';
        job.attrs.nextRunAt = null;
        await job.save();

        await globalAgendaInstance.resumeOnRestart();

        const updatedJob = (await globalAgendaInstance.jobs({ name: 'sendEmail' }))[0];
        expect(updatedJob.attrs.nextRunAt).not.toBeNull();
      });

      test('should not modify jobs with existing nextRunAt', async () => {
        const futureDate = new Date(Date.now() + 60 * 60 * 1000);
        const job = globalAgendaInstance.create('sendEmail', { to: 'user@example.com' });
        job.attrs.nextRunAt = futureDate;
        await job.save();

        await globalAgendaInstance.resumeOnRestart();

        const updatedJob = (await globalAgendaInstance.jobs({ name: 'sendEmail' }))[0];
        expect(updatedJob.attrs.nextRunAt?.getTime()).toEqual(futureDate.getTime());
      });

      test('should handle jobs that started but have not finished (non-recurring)', async () => {
        const job = globalAgendaInstance.create('processData', { data: 'sample' });
        job.attrs.nextRunAt = null;
        job.attrs.lockedAt = new Date();
        await job.save();

        await globalAgendaInstance.resumeOnRestart();

        const updatedJob = (await globalAgendaInstance.jobs({ name: 'processData' }))[0];

        const now = Date.now();
        expect(updatedJob.attrs.nextRunAt).not.toBeNull();
        expect(updatedJob.attrs.nextRunAt?.getTime()).toBeGreaterThan(now - 100);
      });

      test('should handle recurring jobs that started but have not finished', async () => {
        const job = globalAgendaInstance.create('processData', { data: 'sample' });
        job.attrs.repeatInterval = '10 minutes';
        job.attrs.lockedAt = new Date();
        job.attrs.nextRunAt = new Date(Date.now() + 10000);
        await job.save();

        await globalAgendaInstance.resumeOnRestart();

        const updatedJob = (await globalAgendaInstance.jobs({ name: 'processData' }))[0];
        expect(updatedJob.attrs.lockedAt).not.toBeNull();
        expect(updatedJob.attrs.nextRunAt).not.toBeNull();
      });

      test('should handle interrupted recurring jobs after server recovery', async () => {
        const job = globalAgendaInstance.create('processData', { data: 'sample' });
        job.attrs.repeatInterval = '5 minutes';
        job.attrs.lastModifiedBy = 'server_crash';
        job.attrs.nextRunAt = null;
        await job.save();

        await globalAgendaInstance.resumeOnRestart();

        const updatedJob = (await globalAgendaInstance.jobs({ name: 'processData' }))[0];
        expect(updatedJob.attrs.nextRunAt).not.toBeNull();
        expect(updatedJob.attrs.lastModifiedBy).not.toEqual('server_crash');
      });

      // test('should not modify non-recurring jobs with lastFinishedAt in the past', async () => {
      //   const job = globalAgendaInstance.create('sendEmail', { to: 'user@example.com' });
      //   job.attrs.lastFinishedAt = new Date(Date.now() - 10000);
      //   await job.save();

      //   await globalAgendaInstance.resumeOnRestart();

      //   const updatedJob = (await globalAgendaInstance.jobs({ name: 'sendEmail' }))[0];
      //   expect(updatedJob.attrs.nextRunAt).toBeNull();
      // });
    });
  });

  describe('Test job methods', () => {
    describe('Test create method', () => {
      let job: any;
      beforeEach(() => {
        job = globalAgendaInstance.create('sendEmail', { to: 'some guy' });
      });

      test('returns a job', () => {
        expect(job).toBeInstanceOf(Job);
      });
      test('sets the name', () => {
        expect(job.attrs.name).toEqual('sendEmail');
      });
      test('sets the type', () => {
        expect(job.attrs.type).toEqual('normal');
      });
      test('sets the agenda', () => {
        expect(job.agenda).toEqual(globalAgendaInstance);
      });
      test('sets the data', () => {
        expect(job.attrs.data.to).toBe('some guy');
      });
    });

    describe('Test define method', () => {
      test('stores the definition for the job', () => {
        expect(globalAgendaInstance._definitions.someJob.fn).toBe(jobProcessor);
      });
      describe('Test default options', () => {
        test('sets the default concurrency for the job', () => {
          expect(globalAgendaInstance._definitions.someJob.concurrency).toBe(5);
        });
        test('sets the default lockLimit for the job', () => {
          expect(globalAgendaInstance._definitions.someJob.lockLimit).toBe(0);
        });

        test('sets the default lockLifetime for the job', () => {
          expect(globalAgendaInstance._definitions.someJob.lockLifetime).toBe(600000);
        });

        test('sets the default priority for the job', () => {
          expect(globalAgendaInstance._definitions.someJob.priority).toBe(0);
        });

        test('sets the default attempts for the job', () => {
          expect(globalAgendaInstance._definitions.someJob.attempts).toBe(0);
        });
      });

      describe('Test setting options', () => {
        test('sets the priority option for the job', () => {
          globalAgendaInstance.define('highPriority', jobProcessor, { priority: 'high' });
          expect(globalAgendaInstance._definitions.highPriority.priority).toBe('high');
        });

        test('sets shouldSaveResult option for the job', () => {
          globalAgendaInstance.define('shouldSaveResultTrue', jobProcessor, { shouldSaveResult: true });
          expect(globalAgendaInstance._definitions.shouldSaveResultTrue.shouldSaveResult).toBeTruthy();
        });

        test('sets attempts and backoff option for the job', () => {
          globalAgendaInstance.define('attemptsAndBackoff', jobProcessor, {
            attempts: 5,
            backoff: { type: 'fixed', delay: 1000 },
          });
          expect(globalAgendaInstance._definitions.attemptsAndBackoff.attempts).toBe(5);
          expect(globalAgendaInstance._definitions.attemptsAndBackoff.backoff).toEqual({ type: 'fixed', delay: 1000 });
        });
      });
    });

    describe('Test every method', () => {
      describe('Test with a job name specified', () => {
        test('returns a job', async () => {
          expect(await globalAgendaInstance.every('5 minutes', 'send email')).toBeInstanceOf(Job);
        });
        test('sets the repeatEvery', async () => {
          const result = (await globalAgendaInstance.every('5 seconds', 'send email')) as Job;
          expect(result.attrs.repeatInterval).toEqual('5 seconds');
        });
        test('sets the agenda', async () => {
          const result = (await globalAgendaInstance.every('5 seconds', 'send email')) as Job;
          expect(result.agenda).toEqual(globalAgendaInstance);
        });
        test('should update a job that was previously scheduled with `every`', async () => {
          await globalAgendaInstance.every('10', 'shouldBeSingleJob');
          await globalAgendaInstance.every('20', 'shouldBeSingleJob');

          // Give the saves a little time to propagate
          await delay(jobTimeout);

          const res = await globalAgendaInstance.jobs({ name: 'shouldBeSingleJob' });
          expect(res.length).toBe(1);
        });
        test('should not run immediately if options.skipImmediate is true', async () => {
          const jobName = 'send email';
          await globalAgendaInstance.every('5 minutes', jobName, {}, { skipImmediate: true });
          const job = (await globalAgendaInstance.jobs({ name: jobName }))[0] as Job;
          const nextRunAt = job.attrs.nextRunAt?.getTime() as number;
          const now = new Date().getTime();
          expect(nextRunAt - now > 0).toBe(true);
        });
        test('should run immediately if options.skipImmediate is false', async () => {
          const jobName = 'send email';
          await globalAgendaInstance.every('5 minutes', jobName, {}, { skipImmediate: false });
          const job = (await globalAgendaInstance.jobs({ name: jobName }))[0];
          const nextRunAt = job.attrs.nextRunAt?.getTime() as number;
          const now = new Date().getTime();
          expect(nextRunAt - now <= 0).toBe(true);
        });

        test('should update nextRunAt after running a recurring job', async () => {
          const job = globalAgendaInstance.create('recurringJob', { data: 'test' });
          job.attrs.repeatInterval = '*/5 * * * *';
          await job.save();

          await job.run();

          expect(job.attrs.nextRunAt).not.toBeNull();
          expect(job.attrs.nextRunAt?.getTime()).toBeGreaterThan(Date.now());
        });
      });
      describe('Test with array of names specified', () => {
        test('returns array of jobs', async () => {
          const jobs = await globalAgendaInstance.every('5 minutes', ['send email', 'some job']);
          expect(Array.isArray(jobs)).toBe(true);
        });
      });
    });

    describe('Test countJobs', () => {
      test('returns zero when there are no jobs', async () => {
        const count = await globalAgendaInstance.countJobs();
        expect(count).toBe(0);
      });

      test('counts jobs correctly', async () => {
        const job1 = globalAgendaInstance.create('testJob1', {});
        const job2 = globalAgendaInstance.create('testJob2', {});
        await job1.save();
        await job2.save();

        const count = await globalAgendaInstance.countJobs();
        expect(count).toBe(2);
      });

      test('counts jobs with query', async () => {
        const job1 = globalAgendaInstance.create('testJob1', { type: 'email' });
        const job2 = globalAgendaInstance.create('testJob2', { type: 'sms' });
        await job1.save();
        await job2.save();

        const count = await globalAgendaInstance.countJobs({ 'data.type': 'email' });
        expect(count).toBe(1);
      });

      test('counts jobs with options', async () => {
        const job1 = globalAgendaInstance.create('testJob1', { type: 'email' });
        const job2 = globalAgendaInstance.create('testJob2', { type: 'sms' });
        await job1.save();
        await job2.save();

        const count = await globalAgendaInstance.countJobs({}, { limit: 1 });
        expect(count).toBe(1);
      });
    });

    describe('Test schedule method', () => {
      test('creates and schedules a job', async () => {
        await globalAgendaInstance.schedule('2024-06-03T10:00:00Z', 'sendEmail', { to: 'some guy' });
        const jobs = await globalAgendaInstance.jobs({ name: 'sendEmail' });
        expect(jobs.length).toBe(1);
      });

      test('creates and schedules multiple jobs', async () => {
        await globalAgendaInstance.schedule('2024-06-03T10:00:00Z', ['sendEmail', 'some job'], { to: 'some guy' });
        const jobs = await globalAgendaInstance.jobs();
        expect(jobs.length).toBe(2);
      });

      test('checks if job is scheduled correctly', async () => {
        await globalAgendaInstance.schedule('2024-06-03T10:00:00Z', 'sendEmail', { to: 'some guy' });
        const jobs = await globalAgendaInstance.jobs({ name: 'sendEmail' });
        const job = jobs[0];
        expect(job.attrs.nextRunAt).toEqual(new Date('2024-06-03T10:00:00Z'));
      });
    });
  });
});
