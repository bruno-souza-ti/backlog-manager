import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('motion')) return 'vendor-motion';
            // Checked before the generic 'react' substring match below —
            // every @radix-ui/* package name contains "react" (react-select,
            // react-primitive, etc.), as do its own non-namespaced runtime
            // deps (react-remove-scroll, react-style-singleton, use-sidecar,
            // ...). Left to the generic match, those get split across both
            // vendor-react and vendor, and end up importing each other,
            // producing a vendor <-> vendor-react circular chunk.
            if (
              id.includes('@radix-ui') ||
              id.includes('react-remove-scroll') ||
              id.includes('react-style-singleton') ||
              id.includes('use-sidecar') ||
              id.includes('use-callback-ref') ||
              id.includes('get-nonce')
            ) return 'vendor-radix';
            if (id.includes('react')) return 'vendor-react';
            return 'vendor';
          },
        },
      },
    },
  };
});
