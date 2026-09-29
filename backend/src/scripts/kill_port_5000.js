const { execSync } = require('child_process');

try {
  const output = execSync('netstat -ano | findstr :5000', { encoding: 'utf8' });
  const lines = output.split('\n');
  const pidSet = new Set();
  lines.forEach(line => {
    if (line.includes('LISTENING')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pidSet.add(pid);
    }
  });

  pidSet.forEach(pid => {
    try {
      console.log(`Killing process on port 5000 (PID ${pid})...`);
      execSync(`taskkill /F /PID ${pid}`);
    } catch (e) {
      console.log(`Could not kill PID ${pid}:`, e.message);
    }
  });
} catch (e) {
  console.log('No process found listening on port 5000:', e.message);
}
