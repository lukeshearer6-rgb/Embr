import { defineConfig } from 'vite';
// Two pages: the app (index.html, talent and brands) and the Embr admin website (admin.html, staff).
export default defineConfig({
  build: { target: 'es2022', sourcemap: false, rollupOptions: { input: { app: 'index.html', admin: 'admin.html' } } },
  server: { port: 5173 },
});
