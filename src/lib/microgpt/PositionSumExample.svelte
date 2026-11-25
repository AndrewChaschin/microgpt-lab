<script lang="ts">
	import { t } from '$lib/i18n';
	import { corpora } from './corpora';
	import type { Lesson } from './model';
	import ColumnValues from './ColumnValues.svelte';

	export let lesson: Lesson;
	export let applied: boolean;

	// Compare the repeated letter with the same weights and coordinate in both rows.
	$: prefixes = lesson.language === 'ru' ? ['ма', 'мама'] : ['mo', 'moo'];
	$: letter = prefixes[0].slice(-1);
	$: token = corpora[lesson.language].vocabulary.indexOf(letter);
	let moment: 'before' | 'after';
	$: moment = applied ? 'after' : 'before';
	$: embedding = lesson.tables.E[token][0][moment];
	$: places = prefixes.map((prefix) => lesson.tables.P[prefix.length][0][moment]);
</script>

<ColumnValues
	caption={$t('Первая координата при чтении «{letter}»', { letter })}
	firstHeading={$t('Прочитано')}
	rowLabels={prefixes.map((prefix) => prefix + ' · t = ' + prefix.length)}
	columns={[
		{ name: 'E', before: prefixes.map(() => embedding) },
		{ name: 'P', before: places },
		{ name: 'E + P', before: places.map((place) => embedding + place) }
	]}
/>
