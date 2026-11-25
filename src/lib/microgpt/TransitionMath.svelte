<script lang="ts">
	import { fmt, t } from '$lib/i18n';
	import { boundary, vocabulary, headWidth, type Lesson, type Weight } from './model';
	import DotProduct from './DotProduct.svelte';
	import ColumnValues from './ColumnValues.svelte';
	export let index: number;
	export let lesson: Lesson;
	export let position: number;
	export let coordinate: number;
	export let after: boolean;
	$: symbol = (id: number, end = false) =>
		id === boundary ? (end ? $t('конец слова') : $t('начало слова')) : vocabulary[id];
	const rms = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length + 1e-5);
	$: frames = (after && lesson.afterPositions) || lesson.positions;
	$: f = frames[position];
	$: j = coordinate;
	$: h = Math.floor(j / headWidth);
	$: shares = f.attention[h];
	$: scores = frames
		.slice(0, position + 1)
		.map(
			(src) =>
				src.key
					.slice(h * headWidth, (h + 1) * headWidth)
					.reduce((s, k, n) => s + k * f.query[h * headWidth + n], 0) / Math.sqrt(headWidth)
		);
	$: row = (key: Weight, out: number) =>
		lesson.tables[key][out].map((w) => (after ? w.after : w.before));
	$: logitsMax = Math.max(...f.logits);
	$: denominator = f.logits.reduce((s, v) => s + Math.exp(v - logitsMax), 0);
	$: prefix = lesson.word.slice(0, position);
</script>

<div class="math-detail">
	{#if index === 0}
		<p>
			{$t(
				'В позиции 0 модель получает знак начала. В позиции t ≥ 1 она читает букву с индексом t − 1 в слове. Для каждой буквы словарь хранит постоянный номер.'
			)}
		</p>
		<p class="equation">
			t = {position} → {position ? '«' + lesson.word[position - 1] + '»' : $t('знак начала')} → ID {f.token}
		</p>
	{:else if index === 1}
		<p>
			{$t(
				'Номер символа выбирает строку таблицы E, позиция — строку таблицы P. Складываются числа с одинаковым номером координаты j.'
			)}
		</p>
		<p class="equation">
			x[{j}] = E[{f.token}, {j}] + P[{position}, {j}] ≈ {$fmt(f.embedding[j])} + ({$fmt(
				f.position[j]
			)}) ≈ {$fmt(f.combined[j])}
		</p>
		<ColumnValues
			columns={[
				{ name: 'E', before: f.embedding },
				{ name: 'P', before: f.position },
				{ name: 'E + P', before: f.combined }
			]}
			marked={j}
		/>
	{:else if index === 2}
		<p>
			{$t(
				'Сначала microgpt нормирует сумму эмбеддингов x, затем повторяет нормировку перед вычислением Q, K и V. Для вектора v делитель равен √(Σ vₖ² /'
			)}
			{f.combined.length}
			{$t('+ 0,00001). Сумма берётся по всем координатам.')}
		</p>
		<p class="equation">
			b[{j}] ≈ {$fmt(f.combined[j])} / {$fmt(rms(f.combined))} ≈ {$fmt(f.input[j])}<br />u[{j}] ≈ {$fmt(
				f.input[j]
			)} / {$fmt(rms(f.input))} ≈ {$fmt(f.normalized[j])}
		</p>
		<p>
			{$t(
				'Каждая из трёх матриц умножается на один и тот же вектор u. Откройте сумму, чтобы увидеть вклад каждой координаты.'
			)}
		</p>
		{#each ['Q', 'K', 'V'] as key}<DotProduct
				name={key + '[' + j + '] = Σ W' + key + '[' + j + ', k] × u[k]'}
				input={f.normalized}
				weights={row(key as Weight, j)}
			/>{/each}
	{:else if index === 3}
		<p>
			{$t('Голова')}
			{h + 1}
			{$t('использует координаты')}
			{h * headWidth}–{(h + 1) * headWidth - 1}{$t(
				'. Для каждой доступной позиции s она перемножает соответствующие координаты запроса Q текущей позиции и ключа K позиции s, складывает произведения и делит сумму на √'
			)}{headWidth}.
		</p>
		<p class="equation">
			{$t('оценка[s] = Σ Qₖ × Kₛₖ / √')}{headWidth}<br />{$t(
				'α[s] = exp(оценка[s]) / Σ exp(оценка)'
			)}
		</p>
		<p>
			{$t(
				'Доли α суммируются до единицы. Каждая доля определяет вклад значения V в смесь для координаты'
			)}
			{j}.
		</p>
		<ColumnValues
			firstHeading="s"
			columns={[
				{ name: $t('Оценка'), before: scores },
				{ name: $t('Доля α'), before: shares },
				{ name: 'V[' + j + ']', before: frames.slice(0, position + 1).map((x) => x.value[j]) },
				{ name: 'α × V', before: shares.map((a, s) => a * frames[s].value[j]) }
			]}
		/>
		<p class="equation">{$t('смесь[')}{j}] = Σ α[s] × Vₛ[{j}] ≈ {$fmt(f.merged[j])}</p>
		<DotProduct
			name={$t('Проекция смеси на строку ') + j + $t(' матрицы O')}
			input={f.merged}
			weights={row('O', j)}
		/>
		<p class="equation">
			a[{j}] = b[{j}{$t('] + (O · смесь)[')}{j}] ≈ {$fmt(f.input[j])} + ({$fmt(
				f.attended[j] - f.input[j]
			)}) ≈ {$fmt(f.attended[j])}
		</p>
		<p>{$t('b — нормированный вход блока, a — выход самовнимания.')}</p>
	{:else if index === 4}
		<p>
			{$t(
				'Выход внимания a нормируется перед первым слоем MLP. Нормировка N делит все координаты на √(среднее квадратов + 0,00001).'
			)}
		</p>
		<p class="equation">
			N(a)[{j}] ≈ {$fmt(f.attended[j])} / {$fmt(rms(f.attended))} ≈ {$fmt(f.mlpInput[j])}
		</p>
		<p>
			{$t('Первый слой вычисляет')}
			{f.activated.length}
			{$t('координат. Вот вычисление одной из них.')}
		</p>
		<DotProduct
			name={'z[' + j + '] = Σ W₁[' + j + ', k] × N(a)[k]'}
			input={f.mlpInput}
			weights={row('MLP in', j)}
		/>
		<p class="equation">ReLU(z[{j}]) = max(0, {$fmt(f.expanded[j])}) ≈ {$fmt(f.activated[j])}</p>
		<p>
			{$t('Второй слой использует все')}
			{f.activated.length}
			{$t('результатов ReLU. Затем к его выходу прибавляется вход a.')}
		</p>
		<DotProduct
			name={$t('Добавка к координате ') + j + ' = Σ W₂[' + j + ', k] × ReLU(z[k])'}
			input={f.activated}
			weights={row('MLP out', j)}
		/>
		<p class="equation">
			h[{j}] ≈ {$fmt(f.attended[j])} + ({$fmt(f.hidden[j] - f.attended[j])}) ≈ {$fmt(f.hidden[j])}
		</p>
	{:else if index === 5}
		<p>
			{$t(
				'Каждая строка выходной матрицы переводит вектор h в оценку одного символа. Для цели «'
			)}{symbol(f.target, true)}{$t('» берётся строка')}
			{f.target}.
		</p>
		<DotProduct
			name={$t('Оценка цели z[') + f.target + '] = Σ W[' + f.target + ', k] × h[k]'}
			input={f.hidden}
			weights={row('Выход', f.target)}
		/>
		<p>
			{$t(
				'Softmax превращает оценки в вероятности. Для устойчивости из каждой оценки вычитается максимальная m. Знаменатель — сумма экспонент для всех'
			)}
			{f.logits.length}
			{$t('символов.')}
		</p>
		<p class="equation">
			m ≈ {$fmt(logitsMax)}<br />p(«{symbol(f.target, true)}») = exp(z[{f.target}] − m) / Σ exp(zₖ −
			m) ≈ {$fmt(Math.exp(f.logits[f.target] - logitsMax))} / {$fmt(denominator)} ≈ {$fmt(
				f.probabilities[f.target]
			)}
		</p>
		<ColumnValues
			firstHeading={$t('Символ')}
			rowLabels={vocabulary.map((_, id) => symbol(id, true))}
			columns={[
				{ name: $t('Оценка'), before: f.logits },
				{ name: 'exp(z − m)', before: f.logits.map((z) => Math.exp(z - logitsMax)) },
				{ name: $t('Вероятность'), before: f.probabilities }
			]}
			marked={f.target}
		/>
	{:else}
		<p>
			{$t('Для входа')}
			{prefix ? '«' + prefix + '»' : $t('«начало слова»')}
			{$t('учебная цель — «')}{symbol(f.target, true)}{$t(
				'». Чем меньше вероятность цели, тем больше ошибка. ln — натуральный логарифм.'
			)}
		</p>
		<p class="equation">
			ℓ[{position}{$t('] = −ln(p цели) ≈ −ln(')}{$fmt(f.probabilities[f.target])}) ≈ {$fmt(
				-Math.log(f.probabilities[f.target])
			)}
		</p>
		<ColumnValues
			firstHeading={$t('Позиция · цель')}
			rowLabels={frames.map((x, s) => s + ' · ' + symbol(x.target, true))}
			columns={[
				{ name: $t('Вероятность'), before: frames.map((x) => x.probabilities[x.target]) },
				{ name: $t('Ошибка ℓ'), before: frames.map((x) => -Math.log(x.probabilities[x.target])) }
			]}
			marked={position}
		/>
		<p class="equation">
			{$t('Ошибка слова = Σ ℓ /')}
			{frames.length} ≈ {$fmt(after ? lesson.lossAfter : lesson.loss)}
		</p>
	{/if}
</div>

<style>
	.math-detail {
		font-size: 0.87rem;
		line-height: 1.5;
	}
	p {
		margin: 0.65rem 0;
	}
	.equation {
		font-variant-numeric: tabular-nums;
		background: #edf6f6;
		color: #204f56;
		border-left: 3px solid #91b7bb;
		padding: 0.45rem 0.6rem;
		overflow-wrap: anywhere;
	}
</style>
