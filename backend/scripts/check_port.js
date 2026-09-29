const net = require('net');

const client = new net.Socket();
client.setTimeout(1000);

client.connect(5000, '127.0.0.1', () => {
  console.log('Port 5000 is LISTENING');
  client.destroy();
  process.exit(0);
});

client.on('error', (err) => {
  console.log('Port 5000 is NOT listening:', err.message);
  process.exit(1);
});

client.on('timeout', () => {
  console.log('Port 5000 connection timed out');
  client.destroy();
  process.exit(1);
});
