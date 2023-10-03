import Mitm from 'mitm';

const mitm = Mitm();

mitm.on('connect', (socket, options) => {
	// eslint-disable-next-line no-console
	console.log(
		`Blocked network connection to ${options.host?.toString() ?? 'Unknown'}:${
			options.port
		}`,
	);
	socket.end();
});
