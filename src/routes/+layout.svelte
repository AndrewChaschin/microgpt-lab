<script lang="ts">
	import '~/styles/app.css';
	import GlossaryDialog from '~/components/GlossaryDialog.svelte';
	import { onMount } from 'svelte';
	import { language } from '$lib/i18n';

	onMount(() => {
		const key = 'microgpt.language';
		try {
			if (localStorage.getItem(key) === 'en') language.set('en');
		} catch {
			// The interface also works when browser storage is unavailable.
		}
		return language.subscribe((value) => {
			document.documentElement.lang = value;
			try {
				localStorage.setItem(key, value);
			} catch {
				// The selection still applies for this visit.
			}
		});
	});
</script>

<slot />
<GlossaryDialog />
