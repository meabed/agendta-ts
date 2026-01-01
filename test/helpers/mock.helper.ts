import debug from 'debug';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

const log = debug('agenda:mock-mongodb');

let mongoServer: MongoMemoryServer | undefined;

export interface IMockMongo {
  disconnect: () => Promise<void>;
  mongo: MongoClient;
  uri: string;
}

export async function mockMongoDb(): Promise<IMockMongo> {
  // Create a new in-memory MongoDB instance if one doesn't exist
  if (!mongoServer) {
    log('Starting new in-memory MongoDB instance...');
    mongoServer = await MongoMemoryServer.create();
  }

  const uri = mongoServer.getUri();
  log('Connecting to in-memory MongoDB instance... %s', uri);
  const mongo = await MongoClient.connect(uri);

  const disconnect = async (): Promise<void> => {
    await mongo.close();
  };

  const self: IMockMongo = {
    disconnect,
    mongo,
    uri,
  };

  return self;
}

/**
 * Stop the in-memory MongoDB server.
 * Should be called after all tests are complete.
 */
export async function stopMongoServer(): Promise<void> {
  if (mongoServer) {
    log('Stopping in-memory MongoDB instance...');
    await mongoServer.stop();
    mongoServer = undefined;
  }
}
