import 'dotenv/config';

const siteUrl = (
  process.env.WP_SITE_URL
  || process.env.VITE_WP_SITE_URL
  || 'https://omfit.com.vn'
).replace(/\/+$/, '');
const username = process.env.WP_USERNAME || process.env.VITE_WP_USERNAME;
const appPassword = process.env.WP_APP_PASSWORD || process.env.VITE_WP_APP_PASSWORD;

if (!username || !appPassword) {
  throw new Error('Missing WordPress credentials in .env.');
}

const endpoint = `${siteUrl}/wp-json/wsp-mcp/v1/mcp`;
const authorization = `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`;
let requestId = 1;

async function send(payload, sessionId = '') {
  const headers = {
    Authorization: authorization,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000)
  });
  const raw = await response.text();
  let body = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Error(`WordPress MCP returned invalid JSON (${response.status}).`);
    }
  }
  if (!response.ok || body.error) {
    throw new Error(`WordPress MCP request failed (${response.status}): ${raw.slice(0, 1000)}`);
  }
  return { response, body };
}

async function openSession() {
  const { response, body } = await send({
    jsonrpc: '2.0',
    id: requestId++,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'omfit-seo-codex',
        version: '1.0.0'
      }
    }
  });
  const sessionId = response.headers.get('mcp-session-id');
  if (!sessionId) throw new Error('WordPress MCP did not return a session ID.');

  await send({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {}
  }, sessionId);

  return {
    sessionId,
    serverInfo: body.result?.serverInfo || null
  };
}

async function main() {
  const command = process.argv[2];
  const { sessionId, serverInfo } = await openSession();

  if (command === 'tools') {
    const { body } = await send({
      jsonrpc: '2.0',
      id: requestId++,
      method: 'tools/list',
      params: {}
    }, sessionId);
    console.log(JSON.stringify({ serverInfo, tools: body.result?.tools || [] }, null, 2));
    return;
  }

  if (command === 'call') {
    const toolName = process.argv[3];
    if (!toolName) throw new Error('Usage: node scripts/wordpress-mcp.mjs call <tool> [json-args]');

    let args = {};
    if (process.argv[4]) {
      try {
        args = JSON.parse(process.argv[4]);
      } catch {
        throw new Error('Tool arguments must be valid JSON.');
      }
    }

    const { body } = await send({
      jsonrpc: '2.0',
      id: requestId++,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    }, sessionId);
    if (body.result?.isError) {
      throw new Error(JSON.stringify(body.result.content || body.result, null, 2));
    }

    const text = body.result?.content?.find((item) => item.type === 'text')?.text;
    if (text) {
      try {
        console.log(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        console.log(text);
      }
      return;
    }
    console.log(JSON.stringify(body.result || null, null, 2));
    return;
  }

  throw new Error(
    'Usage:\n'
    + '  node scripts/wordpress-mcp.mjs tools\n'
    + '  node scripts/wordpress-mcp.mjs call <tool> [json-args]'
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
