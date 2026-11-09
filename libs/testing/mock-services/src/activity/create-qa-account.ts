import * as db from '../db';
import { os } from './os';

const MOCK_QA_PASSWORD = 'mock-qa-password';

// a stand-in for the QA seeding procedure: it stores the account and its QA avatar at the level,
// and simulates no runs
export const createQAAccount = os.createQAAccount.handler(async (opts) => {
  const email = `${opts.input.user}@qa.versidle.com`;

  if (db.userCollection.findFirst((query) => query.where({ email })) !== undefined) {
    throw opts.errors.CONFLICT({ data: { field: 'email' } });
  }

  const password = opts.input.password ?? MOCK_QA_PASSWORD;

  const user = await db.userCollection.create({ email, password, username: opts.input.user });

  const avatar = await db.avatarCollection.create({
    isQA: true,
    level: opts.input.level,
    userID: user.id,
  });

  return {
    avatar: { id: avatar.id, level: avatar.level, name: avatar.name, xp: avatar.xp },
    password,
    runs: [],
    twoFactor: null,
    user: { email, id: user.id, username: user.username },
  };
});
