<script lang="ts">
	import type { GlossaryKey } from '~/utils/glossary';
	export let term: GlossaryKey;
</script>

<button class="glossary-term" type="button" aria-haspopup="dialog" data-glossary-term={term}>
	<slot />
</button>
