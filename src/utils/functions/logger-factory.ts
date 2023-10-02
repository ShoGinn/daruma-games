import { createLogger, format, Logger, transports } from 'winston';
import type * as Transport from 'winston-transport';

const { combine, splat, timestamp, colorize, printf } = format;
const isTestEnvironment = process.env?.['NODE_ENV'] === 'test';

class JestFilterTransport extends transports.Console {
    public override log(info: unknown, callback: () => void): void {
        /* istanbul ignore next */
        if (!isTestEnvironment && super.log) {
            super.log(info, callback);
        } else {
            setImmediate(callback);
        }
    }
}

export function createLoggerFactory(level: string): Logger {
    const consoleTransport = createConsoleTransport(level);
    /* istanbul ignore next */
    const transportsArray = isTestEnvironment ? [createJestFilterTransport()] : [consoleTransport];

    return createLogger({
        level,
        transports: transportsArray,
        exitOnError: false,
    });
}

function createConsoleTransport(level: string): Transport {
    return new transports.Console({
        level,
        format: combine(colorize(), splat(), timestamp(), createLogFormat()),
    });
}

function createJestFilterTransport(): Transport {
    return new JestFilterTransport({
        level: 'debug',
        format: combine(splat(), timestamp(), createLogFormat()),
        handleExceptions: true,
        handleRejections: true,
    });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createLogFormat(): any {
    return printf(({ level, message, timestamp, ...metadata }) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        let message_ = `⚡ ${timestamp} [${level}] : ${message} `;
        if (metadata && Object.keys(metadata).length > 0) {
            message_ += JSON.stringify(metadata);
        }
        return message_;
    });
}

const logger = createLoggerFactory('debug');

export default logger;
