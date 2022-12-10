import { Logger } from '@services';
import { resolveDependency } from '@utils/functions';

export abstract class BaseError extends Error {
    protected logger: Logger;

    constructor(message?: string) {
        super(message);
        resolveDependency(Logger)
            .then(logger => {
                this.logger = logger;
            })
            .catch(e => {
                throw e;
            });
    }

    handle() {
        //
    }

    kill() {
        process.exit(1);
    }
}
