import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import { migrate, rollback } from '@database/migrations';

const command = process.argv[2] || 'up';
const landingVersions = ['008_landing_pages', '009_landing_pages_company'];
(command === 'down' ? rollback() : migrate(command === 'landing-pages' ? landingVersions : undefined))
  .then(closeDatabasePool)
  .catch(async (error) => { console.error(error); await closeDatabasePool(); process.exit(1); });
