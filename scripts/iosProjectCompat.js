const fs = require('fs');

const decodePbxQuoted = (value) => {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== '\\' || index + 1 >= value.length) {
      output += char;
      continue;
    }

    const next = value[index + 1];
    if (next === '\\' || next === '"') output += next;
    else if (next === 'n') output += '\n';
    else if (next === 'r') output += '\r';
    else if (next === 't') output += '\t';
    else output += `\\${next}`;
    index += 1;
  }
  return output;
};

const encodePbxString = (value) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

const normalizePbxprojText = (text) => {
  const lines = text.split(/(?<=\n)/);
  const output = [];
  let shellScriptChanges = 0;

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const shellScriptStart = line.match(/^(\s*)shellScript = \(\s*$/);
    if (!shellScriptStart) {
      output.push(line);
      index += 1;
      continue;
    }

    const originalStart = index;
    const indent = shellScriptStart[1];
    index += 1;
    const scriptLines = [];
    let validBlock = true;

    while (index < lines.length && !/^\s*\);\s*$/.test(lines[index])) {
      const itemMatch = lines[index].trimEnd().match(/^\s*"((?:\\.|[^"\\])*)",\s*$/);
      if (!itemMatch) {
        validBlock = false;
        break;
      }
      scriptLines.push(decodePbxQuoted(itemMatch[1]));
      index += 1;
    }

    if (!validBlock || index >= lines.length) {
      output.push(...lines.slice(originalStart, index < lines.length ? index + 1 : index));
      if (index < lines.length) index += 1;
      continue;
    }

    output.push(`${indent}shellScript = "${encodePbxString(scriptLines.join('\n'))}";\n`);
    shellScriptChanges += 1;
    index += 1;
  }

  let versionChanges = 0;
  const normalized = output
    .join('')
    .replace(/\b(objectVersion|preferredProjectObjectVersion)\s*=\s*(\d+);/g, (match, key, rawValue) => {
      const value = Number(rawValue);
      if (Number.isFinite(value) && value > 77) {
        versionChanges += 1;
        return `${key} = 77;`;
      }
      return match;
    });

  return {
    text: normalized,
    shellScriptChanges,
    versionChanges,
  };
};

const normalizePbxprojFile = (pbxprojPath) => {
  const original = fs.readFileSync(pbxprojPath, 'utf8');
  const result = normalizePbxprojText(original);
  if (result.text !== original) {
    fs.writeFileSync(pbxprojPath, result.text);
  }
  return result;
};

module.exports = {
  normalizePbxprojFile,
  normalizePbxprojText,
};
