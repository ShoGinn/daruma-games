import Mitm from 'mitm';

const mitm = Mitm();

mitm.on('connect', (socket, opts) => {
    // eslint-disable-next-line no-console
    console.log(`Blocked network connection to ${opts.host}:${opts.port}`);
    socket.end();
});
