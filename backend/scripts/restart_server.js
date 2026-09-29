const { execSync } = require('child_process');

try {
  const output = execSync('netstat -ano | findstr :5000 | findstr LISTENING', { encoding: 'utf8' });
  console.log('Netstat output:\n' + output);
  const lines = output.trim().split('\n');
  const pids = new Set();
  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  });

  pids.forEach(pid => {
    console.log(`Killing process on port 5000 with PID: ${pid}`);
    try {
      execSync(`taskkill /F /PID ${pid}`);
      console.log(`Process ${pid} killed successfully.`);
    } catch (e) {
      console.log(`Failed to kill ${pid}: ${e.message}`);
    }
  });
} catch (err) {
  console.log('No process found or netstat failed:', err.message);
}
