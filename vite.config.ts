import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		watch: {
			// Read the completed file when an editor saves it in several writes.
			awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 30 }
		}
	}
});
