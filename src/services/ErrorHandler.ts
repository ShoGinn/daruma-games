import { singleton } from 'tsyringe';

import logger from '../utils/functions/LoggerFactory.js';

@singleton()
export class ErrorHandler {
    constructor() {
        // Catch all exceptions
        process.on('uncaughtException', (error: Error, origin: string) => {
            // stop in case of unhandledRejection
            if (origin === 'unhandledRejection') return;

            // log the error
            logger.error(`Uncaught Exception: ${error.message}`);
            logger.error(error.stack);
        });

        // catch all Unhandled Rejection (promise)
        process.on('unhandledRejection', (error: Error | any) => {
            // if instance of BaseError, call `handle` method

            // log the error
            logger.error(error.message);
            logger.error(error.stack);
        });
    }
}
