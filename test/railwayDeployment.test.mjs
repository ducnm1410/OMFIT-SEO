import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
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
  assert.match(dockerfile, /^ARG VITE_SUPABASE_URL$/m);
  assert.match(dockerfile, /^ARG VITE_SUPABASE_ANON_KEY$/m);
  assert.doesNotMatch(dockerfile, /^ARG SUPABASE_SERVICE_ROLE_KEY$/m);
  assert.match(dockerfile, /Missing required build variable/);
  assert.match(dockerfile, /COPY --from=build \/app\/dist \.\/dist/);
  assert.match(dockerfile, /COPY src\/lib\/\*\.mjs \.\/src\/lib\//);
  assert.match(dockerfile, /CMD \["npm", "start"\]/);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^\.env\.\*$/m);
});

// Runtime image chỉ copy `server/` và `src/lib/*.mjs`; server import thêm module
// nào ngoài hai chỗ đó là container crash ngay lúc khởi động, mà build vẫn xanh.
test('mọi module src/lib mà server import đều nằm trong runtime image', async () => {
  const serverDirectory = new URL('../server/', import.meta.url);
  const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
  const copiesEverySharedModule = /COPY src\/lib\/\*\.mjs \.\/src\/lib\//.test(dockerfile);

  const serverFiles = (await readdir(serverDirectory)).filter((name) => name.endsWith('.mjs'));
  const imported = new Set();
  for (const name of serverFiles) {
    const source = await readFile(new URL(name, serverDirectory), 'utf8');
    for (const match of source.matchAll(/from '\.\.\/src\/lib\/([\w.-]+\.mjs)'/g)) {
      imported.add(match[1]);
    }
  }

  assert.ok(imported.size > 0, 'không tìm thấy import nào từ src/lib — regex có thể đã lỗi thời');
  for (const moduleName of imported) {
    assert.ok(
      copiesEverySharedModule || dockerfile.includes(`COPY src/lib/${moduleName}`),
      `Dockerfile chưa copy src/lib/${moduleName} vào runtime image`
    );
  }
});
