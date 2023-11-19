import Mitm from 'mitm';

const mitm = Mitm();

mitm.on('connect', (socket, options) => {
  if (options.host === '127.0.0.1' || options.host === 'localhost') {
    socket.bypass();
    return;
  }
  // eslint-disable-next-line no-console
  console.log(
    `Blocked network connection to ${options.host?.toString() ?? 'Unknown'}:${options.port}`,
  );
  socket.end();
});
