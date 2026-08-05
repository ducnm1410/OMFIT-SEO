import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Railway dùng Docker Node 22 và không chạy npm ci qua Nixpacks cache', async () => {
  const [packageJsonText, packageLockText, railwayText, dockerfile, dockerignore] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
    readFile(new URL('../railway.json', import.meta.url), 'utf8'),
    readFile(new URL('../Dockerfile', import.meta.url), 'utf8'),
    readFile(new URL('../.dockerignore', import.meta.url), 'utf8')
  ]);

  const packageJson = JSON.parse(packageJsonText);
  const packageLock = JSON.parse(packageLockText);
  const railway = JSON.parse(railwayText);

  assert.equal(packageJson.engines.node, '>=22.12.0');
  assert.equal(packageLock.packages[''].engines.node, packageJson.engines.node);
  assert.equal(railway.build.builder, 'DOCKERFILE');
  assert.equal(railway.build.buildCommand, undefined);
  assert.equal(railway.deploy.startCommand, undefined);
  assert.match(dockerfile, /^FROM node:22\.12\.0-bookworm-slim AS build/m);
  assert.match(dockerfile, /^FROM node:22\.12\.0-bookworm-slim AS runtime/m);
  assert.match(dockerfile, /RUN npm ci --include=dev/);
  assert.match(dockerfile, /RUN npm ci --omit=dev/);
  assert.match(dockerfile, /COPY --from=build \/app\/dist \.\/dist/);
  assert.match(dockerfile, /CMD \["npm", "start"\]/);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^\.env\.\*$/m);
});
