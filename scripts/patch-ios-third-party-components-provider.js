#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const providerFileName = 'RCTThirdPartyComponentsProvider.mm';
const providerPaths = new Set([
  path.join(rootDir, 'ios', 'build', 'generated', 'ios', providerFileName),
]);

const maybeAddProviderPath = (candidatePath) => {
  if (path.basename(candidatePath) === providerFileName) {
    providerPaths.add(candidatePath);
  }
};

const collectProviderPaths = (dir) => {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectProviderPaths(entryPath);
    } else if (entry.isFile()) {
      maybeAddProviderPath(entryPath);
    }
  }
};

collectProviderPaths(path.join(rootDir, 'ios', 'build', 'generated'));
collectProviderPaths(path.join(rootDir, 'ios', 'build', 'Pods.build'));
collectProviderPaths(
  path.join(rootDir, 'ios', 'build', 'XcodeBuild', 'Build', 'Intermediates.noindex', 'Pods.build')
);

let patchedFiles = 0;
let patchedEntries = 0;
let sawProvider = false;

for (const providerPath of providerPaths) {
  if (!fs.existsSync(providerPath)) continue;

  sawProvider = true;
  const original = fs.readFileSync(providerPath, 'utf8');
  if (
    original.includes('NSMutableDictionary<NSString *, Class<RCTComponentViewProtocol>> *components')
  ) {
    continue;
  }

  const literalMatch = original.match(/^(\s*)thirdPartyComponents = @\{\n([\s\S]*?)^\1\};$/m);

  if (!literalMatch) {
    console.warn(
      `[patch-ios-third-party-components-provider] Provider dictionary not found in ${providerPath}.`
    );
    continue;
  }

  const indent = literalMatch[1];
  const body = literalMatch[2];
  const entries = [];

  for (const rawLine of body.split('\n')) {
    const match = rawLine.match(
      /^\s*@"([^"]+)":\s*NSClassFromString\(@"([^"]+)"\),\s*(\/\/.*)?$/
    );
    if (!match) continue;
    entries.push({
      componentName: match[1],
      className: match[2],
      comment: match[3] ? ` ${match[3]}` : '',
    });
  }

  if (entries.length === 0) {
    console.warn(
      `[patch-ios-third-party-components-provider] No provider entries parsed in ${providerPath}.`
    );
    continue;
  }

  const replacementLines = [
    `${indent}NSMutableDictionary<NSString *, Class<RCTComponentViewProtocol>> *components = [NSMutableDictionary dictionary];`,
    `${indent}Class componentClass = Nil;`,
    '',
  ];

  for (const entry of entries) {
    replacementLines.push(
      `${indent}componentClass = NSClassFromString(@"${entry.className}");${entry.comment}`,
      `${indent}if (componentClass) {`,
      `${indent}  components[@"${entry.componentName}"] = (Class<RCTComponentViewProtocol>)componentClass;`,
      `${indent}}`,
      ''
    );
  }

  replacementLines.push(`${indent}thirdPartyComponents = [components copy];`);

  const patched = original.replace(literalMatch[0], replacementLines.join('\n'));

  if (patched !== original) {
    fs.writeFileSync(providerPath, patched);
    patchedFiles += 1;
    patchedEntries += entries.length;
  }
}

if (patchedFiles > 0) {
  console.log(
    `[patch-ios-third-party-components-provider] Patched ${patchedEntries} Fabric component registrations across ${patchedFiles} file(s).`
  );
} else if (!sawProvider) {
  console.log('[patch-ios-third-party-components-provider] Provider file not generated yet.');
}
