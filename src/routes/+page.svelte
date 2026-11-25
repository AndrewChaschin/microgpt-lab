<script lang="ts">
	import { t } from '$lib/i18n';
	import MicroGptLab from '$lib/microgpt/Lab.svelte';
</script>

<svelte:head>
	<title>{$t('microgpt — предсказание и обучение')}</title>
	<meta
		name="description"
		content={$t(
			'Пошаговый интерактивный разбор предсказания следующей буквы и обучения маленького трансформера.'
		)}
	/>
</svelte:head>

<MicroGptLab />
