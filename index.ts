import { main } from "./src/server.js";
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = await yargs(hideBin(process.argv))
  .option('connectionString', {
    alias: 'c',
    type: 'string',
    description: 'ServiceNow connection string (e.g., https://user:password@instance.service-now.com)',
    demandOption: true, // Make the argument required
  })
  .parseAsync();


main(argv.connectionString).catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});