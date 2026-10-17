
import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path, { resolve } from 'node:path';

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


  function generate(build: boolean) {
    entries = getEntries();
    generatedFiles = [];

    for (const entry of entries) {
      const file = path.join(root, `${entry}.html`);
      if (build && !fs.existsSync(file))
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
        if (!req.url || !['GET', 'HEAD'].includes(req.method ?? ''))
          return next();

        let urlPath = req.url?.split('?')[0] || '/';

        if (urlPath === '/')
          urlPath = '/index.html';

        if (req.method === "GET" && (urlPath.endsWith(".html")/* || !/\.[^\/]+$/.test(urlPath)*/) && !fs.existsSync(path.join(root, `urlPath`))) {
          urlPath = urlPath.slice(1).replace(/\.html$/, "");
          if (entries.includes(urlPath)) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(makeHtml(urlPath));
            return;
          }
          else {
            const staticHtmlPath = urlPath.endsWith('.html') ? urlPath : `${urlPath}.html`;
            const hasStaticHtml = fs.existsSync(resolve(import.meta.dirname, `.${staticHtmlPath}`));

            if (!hasStaticHtml && urlPath !== '/404.html')
              req.url = '/404.html';
          }
        }
        next();
      });
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
  plugins: [generatedPages()],
  assetsInclude: "404.html"
});
