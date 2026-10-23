// Stand-in for PushPlus (and, from M2, Anthropic) so end-to-end tests never call real services.
import http from 'node:http';

export function startMockUpstream(port = 5690, host = process.env.MOCK_HOST ?? '127.0.0.1') {
  const pushes = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.method === 'POST' && req.url === '/pushplus/send') {
        const msg = JSON.parse(body || '{}');
        // A friend token PushPlus does not know: HTTP 200 with an error code in the body, like the real service.
        if (msg.to === 'bad-friend') return send(200, { code: 999, msg: '好友令牌不存在', data: null });
        pushes.push(msg);
        return send(200, { code: 200, msg: '请求成功', data: `mock-${pushes.length}` });
      }
      if (req.method === 'GET' && req.url === '/pushplus/log') return send(200, pushes);
      send(404, { error: 'not mocked' });
    });
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve({
    pushes,
    close: () => new Promise((r) => server.close(r)),
  })));
}
