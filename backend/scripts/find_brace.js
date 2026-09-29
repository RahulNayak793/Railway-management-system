const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, '../src/routes/admin.js'), 'utf8');
const lines = content.split('\n');
const stack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') {
      stack.push({ line: i + 1, snippet: line.trim().slice(0, 80) });
    }
    if (line[j] === '}') {
      stack.pop();
    }
  }
}
console.log('Unclosed brace at:', stack);
