import { sveltekit } from '@sveltejs/kit/vite';
import { initializeAdmin } from './lib/server/setup.js';

// Initialize admin user on startup
if (process.env.NODE_ENV === 'production') {
    initializeAdmin();
}
