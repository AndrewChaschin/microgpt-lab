<script lang="ts">
	import { fmt, mathNumber, t } from '$lib/i18n';
	import Formula from './Formula.svelte';
	import ColumnValues from './ColumnValues.svelte';
	export let name = '';
	export let tex = '';
	export let notation = '';
	export let input: number[];
	export let weights: number[];
	$: products = input.map((x, k) => x * weights[k]);
	$: result = products.reduce((a, b) => a + b, 0);
</script>

<details>
	<summary
		>{#if tex}<Formula
				inline
				{notation}
				tex={String.raw`${tex}\approx ${$mathNumber(result)}`}
			/>{:else}{name}
			≈ <strong>{$fmt(result)}</strong>{/if}</summary
	>
	<p>
		{$t('Умножаем каждую координату входа на соответствующий вес и складываем все')}
		{input.length}
		{$t('произведений.')}
	</p>
	<ColumnValues
		columns={[
			{ name: $t('Вход'), before: input },
			{ name: $t('Вес'), before: weights },
			{ name: $t('Произведение'), before: products }
		]}
	/>
</details>

<style>
	details {
		margin: 0.5rem 0;
		border-left: 2px solid #9cbfc2;
		padding: 0.25rem 0.6rem;
	}
	summary {
		cursor: pointer;
		color: #215c64;
	}
	p {
		margin: 0.45rem 0;
	}
</style>
