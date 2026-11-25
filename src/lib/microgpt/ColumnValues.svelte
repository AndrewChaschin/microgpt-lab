<script lang="ts">
	import { language } from '$lib/i18n';
	export let columns: { name: string; before: number[]; after?: number[] }[];
	export let rowLabels: string[] | undefined = undefined;
	export let firstHeading = '№';
	export let marked = -1;
	export let caption = '';
	export let percent = false;
	$: number = new Intl.NumberFormat($language, {
		minimumFractionDigits: 5,
		maximumFractionDigits: 5
	});
	$: probability = new Intl.NumberFormat($language, {
		style: 'percent',
		maximumFractionDigits: 3
	});
	$: format = percent ? probability : number;
</script>

<div class="viewport">
	<table>
		{#if caption}<caption>{caption}</caption>{/if}
		<thead
			><tr
				><th scope="col">{firstHeading}</th>{#each columns as c}<th scope="col">{c.name}</th
					>{/each}</tr
			></thead
		>
		<tbody>
			{#each columns[0].before.keys() as j}
				<tr class:marked={j === marked}
					><th scope="row">{rowLabels?.[j] ?? j}</th>
					{#each columns as c}
						<td
							><span title={String(c.before[j]).replace('.', $language === 'ru' ? ',' : '.')}
								>{format.format(c.before[j])}</span
							>
							{#if c.after}<strong
									title={String(c.after[j]).replace('.', $language === 'ru' ? ',' : '.')}
									>{format.format(c.after[j])}</strong
								>{/if}</td
						>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.viewport {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
	}
	caption {
		font-weight: 650;
		text-align: left;
		padding: 0.6rem 0 0.25rem;
	}
	th,
	td {
		padding: 0.2rem 0.35rem;
		text-align: right;
		border-bottom: 1px solid #e6e2e9;
	}
	thead th {
		background: #ede9f2;
	}
	th:first-child {
		text-align: left;
	}
	td span,
	td strong {
		display: block;
	}
	td strong {
		color: #245841;
	}
	tr.marked {
		background: #f1ebf6;
	}
</style>
