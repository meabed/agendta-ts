# Quick Start

### Installation

```bash
npm i agenda-ts
```



### Example

```typescript
import Agenda from 'agenda-ts';

const mongoConnectionString = 'mongodb://localhost:27017/agenda';

const agenda = new Agenda({ db: { address: mongoConnectionString } });

// Or override the default collection name:
// const agenda = new Agenda({db: {address: mongoConnectionString, collection: 'jobCollectionName'}});

// or pass additional connection options:
// const agenda = new Agenda({db: {address: mongoConnectionString, collection: 'jobCollectionName', options: {ssl: true}}});

// or pass in an existing mongodb-native MongoClient instance
// const agenda = new Agenda({mongo: myMongoClient});

/**
 * Example of defining a job
 */
agenda.define('delete old users', async (job) => {
  console.log('Deleting old users...');
  return;
}, { shouldSaveResult: true, attempts: 4, backoff: { type: 'exponential', delay: 1000 } });

/**
 * Example of repeating a job
 */
(async function () {
  // IIFE to give access to async/await
  await agenda.start();

  await agenda.every('3 minutes', 'delete old users');

  // Alternatively, you could also do:
  await agenda.every('*/3 * * * *', 'delete old users');
})();

/**
 * Example of defining a job with options
 */
agenda.define(
  'send email report',
  async (job) => {
    const { to } = job.attrs.data;

    console.log(`Sending email report to ${to}`);
  },
  { lockLifetime: 5 * 1000, priority: 'high', concurrency: 10 }
);

/**
 * Example of scheduling a job
 */
(async function () {
  await agenda.start();
  await agenda.schedule('in 20 minutes', 'send email report', { to: 'admin@example.com' });
})();

/**
 * Example of repeating a job
 */
(async function () {
  const weeklyReport = agenda.create('send email report', { to: 'example@example.com' });
  await agenda.start();
  await weeklyReport.repeatEvery('1 week').save();
})();

/**
 * Check job start and completion/failure
 */
agenda.on('start', (job) => {
  console.log(time(), `Job <${job.attrs.name}> starting`);
});
agenda.on('success', (job) => {
  console.log(time(), `Job <${job.attrs.name}> succeeded`);
});
agenda.on('fail', (error, job) => {
  console.log(time(), `Job <${job.attrs.name}> failed:`, error);
});

function time() {
  return new Date().toTimeString().split(' ')[0];
}
```
