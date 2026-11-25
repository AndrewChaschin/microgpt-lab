<script lang="ts">
	import { t } from '$lib/i18n';
	import { tick } from 'svelte';

	export let currentKey: string;
	export let onViewChange: () => void;

	const maxZoom = 3;
	const inset = 6;
	let viewport: HTMLDivElement;
	let content: HTMLDivElement;
	let viewWidth = 0,
		viewHeight = 0,
		boardWidth = 0,
		boardHeight = 0;
	let zoom = 0;
	let drag: { id: number; x: number; y: number; left: number; top: number } | undefined;

	$: fit =
		boardWidth && boardHeight && viewWidth && viewHeight
			? Math.min((viewWidth - 2 * inset) / boardWidth, (viewHeight - 2 * inset) / boardHeight)
			: 1;
	$: scale = zoom || fit;

	async function setZoom(next: number, x?: number, y?: number) {
		const frame = viewport.getBoundingClientRect();
		const px = x ?? frame.left + viewport.clientWidth / 2;
		const py = y ?? frame.top + viewport.clientHeight / 2;
		const before = content.getBoundingClientRect();
		const u = Math.max(0, Math.min(1, (px - before.left) / before.width));
		const v = Math.max(0, Math.min(1, (py - before.top) / before.height));
		onViewChange();
		zoom = next;
		await tick();
		const after = content.getBoundingClientRect();
		viewport.scrollBy(after.left + u * after.width - px, after.top + v * after.height - py);
	}
	function zoomBy(factor: number, x?: number, y?: number) {
		const target = Math.max(fit, Math.min(maxZoom, scale * factor));
		const next = target === fit ? 0 : target;
		if (next !== zoom) void setZoom(next, x, y);
	}
	function wheel(e: WheelEvent) {
		if (!e.deltaY) return;
		e.preventDefault();
		if (drag) return;
		const unit =
			e.deltaMode === WheelEvent.DOM_DELTA_LINE
				? 16
				: e.deltaMode === WheelEvent.DOM_DELTA_PAGE
					? viewport.clientHeight
					: 1;
		zoomBy(2 ** ((-e.deltaY * unit) / 400), e.clientX, e.clientY);
	}
	function keyZoom(e: KeyboardEvent) {
		if (e.target !== viewport || e.ctrlKey || e.metaKey || e.altKey) return;
		switch (e.key) {
			case '+':
			case '=':
				zoomBy(1.25);
				break;
			case '-':
				zoomBy(1 / 1.25);
				break;
			case '0':
				void setZoom(0);
				break;
			default:
				return;
		}
		e.preventDefault();
	}
	function beginDrag(e: PointerEvent) {
		if (e.pointerType !== 'mouse' || e.button !== 1) return;
		e.preventDefault();
		if (!zoom) return;
		onViewChange();
		drag = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			left: viewport.scrollLeft,
			top: viewport.scrollTop
		};
		viewport.setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (drag?.id === e.pointerId)
			viewport.scrollTo(drag.left + drag.x - e.clientX, drag.top + drag.y - e.clientY);
	}
	function endDrag(e: PointerEvent) {
		if (e.pointerId === drag?.id) drag = undefined;
	}
	async function followBlock(key: string) {
		if (!viewport || !zoom) return;
		await tick();
		if (key !== currentKey) return;
		const block = viewport.querySelector('[aria-current="step"]')?.getBoundingClientRect();
		if (!block) return;
		const frame = viewport.getBoundingClientRect();
		if (
			block.left < frame.left ||
			block.right > frame.right ||
			block.top < frame.top ||
			block.bottom > frame.bottom
		) {
			viewport.scrollBy(
				block.left + block.width / 2 - frame.left - viewWidth / 2,
				block.top + block.height / 2 - frame.top - viewHeight / 2
			);
		}
	}
	$: followBlock(currentKey);
</script>

<div class="viewport-info">
	<slot name="controls" />
	<span class="scale" aria-label={$t('Текущий масштаб')}>{Math.round(scale * 100)} %</span>
</div>
<slot name="charts" />
<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<div
	class="scroll"
	class:dragging={drag !== undefined}
	role="region"
	aria-label={$t('Поле схемы предсказания и обучения')}
	aria-keyshortcuts="Plus - 0"
	tabindex="0"
	bind:this={viewport}
	bind:clientWidth={viewWidth}
	bind:clientHeight={viewHeight}
	on:wheel|nonpassive={wheel}
	on:keydown={keyZoom}
	on:auxclick={(e) => {
		if (e.button === 1) e.preventDefault();
	}}
	on:pointerdown={beginDrag}
	on:pointermove={move}
	on:pointerup={endDrag}
	on:pointercancel={endDrag}
	on:lostpointercapture={endDrag}
	on:scroll={onViewChange}
>
	<div class="surface" style:padding={inset + 'px'}>
		<div
			class="extent"
			style:width={boardWidth * scale + 'px'}
			style:height={boardHeight * scale + 'px'}
		>
			<div
				class="content"
				bind:this={content}
				bind:offsetWidth={boardWidth}
				bind:offsetHeight={boardHeight}
				style:transform={'scale(' + scale + ')'}
			>
				<slot />
			</div>
		</div>
	</div>
</div>

<style>
	.viewport-info {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem 0.85rem;
		padding: 0.45rem 0.8rem;
		font-size: 0.8rem;
	}
	.scale {
		margin-inline-start: auto;
		min-width: 3.2em;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.scroll {
		width: 100%;
		height: min(78dvh, calc(100dvh - 4rem));
		overflow: auto;
		position: relative;
		border-block: 1px solid #dce4df;
		background: #fafbfa;
		overflow-anchor: none;
	}
	.scroll:focus-visible {
		outline: 2px solid #674b82;
		outline-offset: -2px;
	}
	.dragging {
		cursor: grabbing;
		user-select: none;
	}
	.surface {
		display: grid;
		place-items: center;
		width: max-content;
		min-width: 100%;
		min-height: 100%;
		box-sizing: border-box;
	}
	.extent {
		position: relative;
		overflow: clip;
	}
	.content {
		width: max-content;
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: top left;
		background: white;
	}
	@media (max-width: 46rem) {
		.scroll {
			height: 59dvh;
		}
	}
</style>
