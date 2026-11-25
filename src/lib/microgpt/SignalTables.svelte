<script lang="ts">
	import { fmt, language } from '$lib/i18n';
	import type { SignalTable } from './signals';
	export let tables: SignalTable[];
	export let matrix = false;
</script>

{#each tables as table}
	<h4>
		{table.name}
		<small
			>{table.values.length === 1 && !matrix
				? table.values[0].length
				: table.values.length + ' × ' + table.values[0].length}</small
		>
	</h4>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="numbers" tabindex="0" role="region" aria-label={table.name}>
		<table>
			<thead
				><tr
					><th scope="col">№</th>{#each table.values[0].keys() as j}<th scope="col">{j}</th
						>{/each}</tr
				></thead
			>
			<tbody
				>{#each table.values as row, i}<tr
						><th scope="row">{table.rows?.[i] ?? i}</th>{#each row as v}<td
								title={String(v).replace('.', $language === 'ru' ? ',' : '.')}
								>{typeof v === 'number' ? $fmt(v) : v}</td
							>{/each}</tr
					>{/each}</tbody
			>
		</table>
	</div>
{/each}

<style>
	h4 {
		flex: none;
		margin: 0.5rem 0 0.18rem;
		font-weight: 650;
	}
	small {
		margin-left: 0.35rem;
		font-weight: 400;
	}
	.numbers {
		overflow: auto;
		min-height: 0;
		min-width: 0;
		border: 1px solid #dde5e1;
	}
	table {
		width: 100%;
		font-variant-numeric: tabular-nums;
	}
	td,
	th {
		padding: 0.15rem 0.35rem;
		text-align: right;
		white-space: nowrap;
	}
	th {
		background: #eef3ef;
	}
	thead th {
		position: sticky;
		top: 0;
	}
	th:first-child {
		position: sticky;
		left: 0;
		text-align: left;
	}
</style>
