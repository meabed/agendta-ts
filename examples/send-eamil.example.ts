import express from 'express';
import nodemailer from 'nodemailer';
import Agenda, { JobAttributesData } from 'agenda-ts';
const app = express();
const port = 3000; // You can choose any port that is free on your system

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-email-password',
  },
});

// Agenda setup
const mongoConnectionString = 'mongodb://localhost:27017/agenda';
const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: 'cronjob' },
  defaultConcurrency: 4,
  maxConcurrency: 4,
  processEvery: '10 seconds',
  resumeOnRestart: true,
});

interface ProcessJobData extends JobAttributesData {
  to: string;
}

agenda.define(
  'send email',
  async (job, done) => {
    const { to, subject, text } = job.attrs.data;
    const mailOptions = {
      from: 'your-email@gmail.com',
      to,
      subject,
      text,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${to}`);
      done();
    } catch (error) {
      console.error(`Failed to send email to ${to}`, error);
      done(error);
    }
  },
  { shouldSaveResult: true }
);

app.post('/send-email', async (req, res) => {
  try {
    await agenda.start();
    const { to, subject, text, scheduleTime } = req.body;
    const job = agenda.create('send email', { to, subject, text });
    await job.schedule(new Date(scheduleTime)).save();
    res.status(200).send('Email scheduled successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to schedule email');
  }
});

agenda.on('success', (job) => {
  console.log(`Job <${job.attrs.name}> succeeded`);
});

agenda.on('fail', (error, job) => {
  console.log(`Job <${job.attrs.name}> failed:`, error);
});

// Start Express server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
