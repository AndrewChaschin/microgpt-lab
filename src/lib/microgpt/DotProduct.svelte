<script lang="ts">
	import { fmt, t } from '$lib/i18n';
	import ColumnValues from './ColumnValues.svelte';
	export let name: string;
	export let input: number[];
	export let weights: number[];
	$: products = input.map((x, k) => x * weights[k]);
	$: result = products.reduce((a, b) => a + b, 0);
</script>

<details>
	<summary>{name} ≈ <strong>{$fmt(result)}</strong></summary>
	<p>
		{$t('Умножаем каждую координату входа на вес в той же колонке и складываем все')}
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
