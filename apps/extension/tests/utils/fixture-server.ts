import http from 'node:http';

export function startFixtureServer(): { server: http.Server; urlPromise: Promise<string> } {
  const html = `<!doctype html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>Aether Fixture</title></head>
    <body>
      <input id="fixture-input" placeholder="Type /ref here" />
      <textarea id="fixture-textarea" placeholder="Type /ref here"></textarea>
      <div id="fixture-ce" contenteditable="true">Type /ref here</div>
    </body>
    </html>`;

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  const urlPromise = new Promise<string>(resolve => {
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve(`http://127.0.0.1:${address.port}`);
      }
    });
  });

  return { server, urlPromise };
}
