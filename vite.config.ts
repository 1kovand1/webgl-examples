
import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const templatePath = path.join(root, 'html.html');
const errorPagePath = path.join(root, '404.html');

function getEntries(): string[] {
  return fs.readdirSync(srcDir)
    .filter(name => name.endsWith('.ts'))
    .map(name => name.slice(0, -3));
}

function makeHtml(entry: string): string {
  return fs.readFileSync(templatePath, 'utf8').replace(
    '<!-- ENTRY -->',
    `<script type="module" src="./src/${entry}.ts"></script>`
  );
}

function generatedPages(): Plugin {
  let generatedFiles: string[] = [];
  let entries: string[] = [];

  
  function generate(isBuild: boolean) {
    entries = getEntries();
    generatedFiles = [];

    for (const entry of entries) {
      const file = path.join(root, isBuild ? `${entry}.html` : `.vite-generated/${entry}.html`);

      fs.writeFileSync(file, makeHtml(entry));
      generatedFiles.push(file);
    }
  }

  function cleanup() {
    for (const file of generatedFiles) {
      fs.rmSync(file, { force: true });
    }

    generatedFiles = [];
  }

  return {
    name: 'generated-pages',
    config(config, configEnv) {
      generate(configEnv.command === 'build');

      return {
        appType: 'mpa',
        build: {
          rollupOptions: {
            input: Object.fromEntries(
              entries.map(entry => [
                entry,
                path.join(root, `${entry}.html`)
              ])
            )
          }
        }
      };
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (
          !req.url ||
          !['GET', 'HEAD'].includes(req.method ?? '')
        ) {
          return next();
        }

        let pathname: string;

        try {
          pathname = decodeURIComponent(
            new URL(req.url, 'http://localhost').pathname
          );
        } catch {
          res.statusCode = 400;
          return res.end('Bad Request');
        }

        if (pathname === '/') {
          pathname = '/index.html';
        }

        const entry = pathname
          .replace(/^\//, '')
          .replace(/\.html$/, '');
        if (/\.html$/.test(req.url))
          req.url = req.url.replace(entry, ".vite-generated/" + entry)
        if (
          !pathname.slice(1).includes('/') &&
          entries.includes(entry)
        ) {
          return next();
        }

        if (
          !pathname.slice(1).includes('/') &&
          pathname.endsWith('.html')
        ) {
          res.statusCode = 404;
          res.setHeader(
            'Content-Type',
            'text/html; charset=utf-8'
          );

          const html = fs.readFileSync(errorPagePath, 'utf8');
          return res.end(
            req.method === 'HEAD' ? undefined : html
          );
        }

        next();
      });

      server.httpServer?.once('close', cleanup);
    },

    closeBundle() {
      const distDir = path.join(root, 'dist');

      fs.copyFileSync(
        errorPagePath,
        path.join(distDir, '404.html')
      );

      cleanup();
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [generatedPages()]
});
