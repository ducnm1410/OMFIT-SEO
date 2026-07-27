import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('xóa bài chỉ áp dụng cho bản nháp thuộc đúng người dùng', async () => {
  const source = await readFile(
    new URL('../src/services/contentRepository.ts', import.meta.url),
    'utf8'
  );
  const deleteDraft = source.slice(
    source.indexOf('export async function deleteDraftArticle'),
    source.indexOf('export async function saveArticle')
  );
  assert.match(deleteDraft, /\.from\('articles'\)[\s\S]*?\.delete\(\)/);
  assert.match(deleteDraft, /\.eq\('owner_id', ownerId\)/);
  assert.match(deleteDraft, /\.eq\('status', 'draft'\)/);

  const history = await readFile(
    new URL('../src/components/PostHistory.tsx', import.meta.url),
    'utf8'
  );
  assert.match(history, /<ConfirmDialog/);
  assert.match(history, /article\.status === 'draft'/);
  assert.match(history, /navigator\.clipboard\.writeText\(article\.title\)/);
  assert.match(history, /line-clamp-2/);
  assert.match(history, /aria-label=\{`Xem và chỉnh sửa/);
  assert.doesNotMatch(history, /window\.confirm|window\.alert/);
});

test('quản lý ảnh bài viết hỗ trợ cả tạo AI, upload và xóa khỏi nội dung', async () => {
  const source = await readFile(
    new URL('../src/components/ArticleImagePackage.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /uploadMediaFile\(file, article\.id\)/);
  assert.match(source, /Tạo ảnh bằng AI/);
  assert.match(source, /Tải ảnh lên/);
  assert.match(source, /removeInlineImage/);
  assert.match(source, /data-omfit-section-image/);
  assert.match(source, /articleImages:\s*article\.articleImages\.filter/);
  assert.match(source, /insertTrackedImage/);
  assert.match(source, /Chưa chèn vào nội dung/);
  assert.match(source, /aria-label="Chèn ảnh vào nội dung bài"/);
});

test('sau khi Gemini trả bài, UI chuyển editor trước khi chờ lưu nền hoàn tất', async () => {
  const generator = await readFile(
    new URL('../src/components/SeoContentGenerator.tsx', import.meta.url),
    'utf8'
  );
  const flow = generator.slice(
    generator.indexOf('const handleGenerateFullArticle'),
    generator.indexOf('const handleCancelArticleGeneration')
  );
  const startSave = flow.indexOf('const savePromise = onArticleGenerated(article)');
  const navigate = flow.indexOf("setActiveTab('editor')");
  const handleSaveError = flow.indexOf('void savePromise.catch');
  assert.ok(startSave >= 0);
  assert.ok(navigate > startSave);
  assert.ok(handleSaveError > navigate);

  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const finalize = app.slice(
    app.indexOf('const handleArticleGenerated'),
    app.indexOf('const handleSaveArticle')
  );
  assert.ok(finalize.indexOf('setSelectedArticle(provisional.article)') >= 0);
  assert.ok(
    finalize.indexOf('setSelectedArticle(provisional.article)')
      < finalize.indexOf('await ensureBrandProfile()')
  );
  assert.doesNotMatch(finalize, /generateImage\(/);
});

test('luồng SEO mới không khôi phục bài cũ và thay brief sẽ xóa lựa chọn cũ', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /omfit-seo-workflow-v2/);
  assert.match(app, /const restoresArticle = initialWorkflow\.activeTab === 'editor'/);
  assert.match(app, /const resetToNewBrief = \(\) =>/);

  const changeBrief = app.slice(
    app.indexOf('const handleBriefChange'),
    app.indexOf('const handleKeywordSelected')
  );
  assert.match(changeBrief, /setWorkflowStep\(2\)/);
  assert.match(changeBrief, /setSelectedArticle\(null\)/);
});

test('tìm nguồn retry race của bài mới và không dùng HTTP 422 khi Grounding thiếu nguồn', async () => {
  const component = await readFile(
    new URL('../src/components/ArticleSourceResearch.tsx', import.meta.url),
    'utf8'
  );
  assert.match(component, /getArticleSourcesWithRetry/);
  assert.match(component, /error\.status === 403 \|\| error\.status === 404/);

  const server = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(server, /google_grounding_retry/);
  assert.match(server, /reusedExistingSources: existingSources\.length > 0/);
  assert.doesNotMatch(server, /'grounding_missing'/);
});

test('đăng bài thành công không tải hoặc chạy hiệu ứng pháo hoa', async () => {
  const publisher = await readFile(
    new URL('../src/components/LiveEditorPublisher.tsx', import.meta.url),
    'utf8'
  );
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  );
  assert.doesNotMatch(publisher, /confetti/);
  assert.equal(packageJson.dependencies?.['canvas-confetti'], undefined);
  assert.equal(packageJson.devDependencies?.['@types/canvas-confetti'], undefined);
});
