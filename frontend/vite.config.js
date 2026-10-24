import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Injects a Content-Security-Policy meta tag into the BUILT index.html only
// (development must stay loose for Vite's inline react-refresh runtime).
// The SPA is hosted on static hosting that cannot set response headers, so the
// meta tag is the only place a CSP can be enforced. script-src 'self' blocks
// injected inline script execution — the primary XSS token-exfiltration path
// for the localStorage session tokens.
function injectCspForBuild() {
  return {
    name: 'inject-csp-for-build',
    apply: 'build',
    transformIndexHtml(html) {
      const apiOrigin = process.env.VITE_API_BASE_URL || '';
      const connectSrc = ["'self'", apiOrigin].filter(Boolean).join(' ');
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        `connect-src ${connectSrc}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ');
      return html.replace(
        '</head>',
        `    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n  </head>`
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), injectCspForBuild()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    // Globals let @testing-library/react auto-register its afterEach cleanup;
    // without them the DOM accumulates across tests in a file.
    globals: true,
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
