// Minimal Supabase-style API gateway for the disposable stack: /rest/v1/* -> PostgREST (prefix
// stripped), /auth/v1/* -> GoTrue (prefix stripped). Supabase's Kong does the same job.
import http from 'node:http';

const [, , listenPort, restPort, authPort] = process.argv;
const route = (url) => {
  if (url.startsWith('/rest/v1')) return [Number(restPort), url.slice('/rest/v1'.length) || '/'];
  if (url.startsWith('/auth/v1')) return [Number(authPort), url.slice('/auth/v1'.length) || '/'];
  return [null, url];
};
http
  .createServer((req, res) => {
    const [port, path] = route(req.url);
    if (!port) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end('{"message":"no route"}');
    }
    const up = http.request({ host: '127.0.0.1', port, path, method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    up.on('error', (e) => {
      res.writeHead(502);
      res.end(String(e));
    });
    req.pipe(up);
  })
  .listen(Number(listenPort), '127.0.0.1');
