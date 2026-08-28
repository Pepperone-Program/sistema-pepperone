import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import { migrate, rollback } from '@database/migrations';

const command = process.argv[2] || 'up';
(command === 'down' ? rollback() : migrate())
  .then(closeDatabasePool)
  .catch(async (error) => { console.error(error); await closeDatabasePool(); process.exit(1); });
