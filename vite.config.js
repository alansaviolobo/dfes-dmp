import { defineConfig } from 'vite';

export default defineConfig({
  // Root directory for the project
  root: '.',

  // Public directory for static assets
  publicDir: 'assets',

  // Server configuration
  server: {
    port: 4035,
    host: true, // Allow external connections
    open: true, // Open browser automatically
    cors: true, // Enable CORS for development
  },

  plugins: [
    {
      name: 'copy-config-files',
      closeBundle() {
        const fs = require('fs');
        const path = require('path');
        const srcDir = path.resolve(__dirname, 'config');
        const destDir = path.resolve(__dirname, 'dist/config');

        if (fs.existsSync(srcDir)) {
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          const files = fs.readdirSync(srcDir);
          for (const file of files) {
            const srcFile = path.join(srcDir, file);
            const destFile = path.join(destDir, file);
            if (fs.lstatSync(srcFile).isFile()) {
              fs.copyFileSync(srcFile, destFile);
            }
          }
          // Copy .nojekyll to dist for GitHub Pages
          const noJekyllSrc = path.resolve(__dirname, '.nojekyll');
          const noJekyllDest = path.resolve(__dirname, 'dist/.nojekyll');
          if (fs.existsSync(noJekyllSrc)) {
            fs.copyFileSync(noJekyllSrc, noJekyllDest);
          }
          console.log(`Copied ${files.length} files from config/ to dist/config/ and .nojekyll to dist/`);
        }
      }
    }
  ],

  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },

  // Preview server configuration (for built files)
  preview: {
    port: 4035,
    host: true,
    open: true
  },

  // Asset handling
  assetsInclude: ['**/*.geojson', '**/*.json'],

  // Define global constants
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  },

  // Vitest configuration
  test: {
    // Test environment
    environment: 'node',

    // Test file patterns
    include: ['**/js/tests/**/*.test.js', '**/tests/**/*.test.js'],

    // Exclude patterns
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'js/tests/',
        'dist/',
        'coverage/',
        '**/*.config.js'
      ]
    },

    // Test timeout
    testTimeout: 10000,

    // Globals (makes expect, describe, it available without imports)
    globals: true
  }
}); 