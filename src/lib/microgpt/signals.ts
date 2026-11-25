import type { Translate } from '$lib/i18n';
import { corpora, type Corpus } from './corpora';
import {
	headWidth,
	mostLikelyToken,
	type ForwardPosition,
	type Lesson,
	type Weight
} from './model';

export type OutputKind = 'argmax' | 'target';
export function outputResult(
	frame: ForwardPosition,
	kind: OutputKind,
	{ boundary, vocabulary }: Corpus,
	t: Translate
) {
	const token = kind === 'target' ? frame.target : mostLikelyToken(frame.probabilities);
	return {
		token,
		symbol: token === boundary ? t('конец слова') : vocabulary[token],
		probability: frame.probabilities[token]
	};
}

export type Signal = {
	output?: OutputKind;
	index: number;
	reverse: boolean;
	weight?: Weight;
	edge?: Connection;
	shared?: boolean;
	seed?: boolean;
	wordInput?: boolean;
	update?: boolean;
};
import { parameters, type Connection } from './operationGraph';
export type SignalTable = { name: string; values: (number | string)[][]; rows?: string[] };
const vector = (name: string, values: number[]): SignalTable => ({ name, values: [values] });

function connectionTables(
	edge: Connection,
	lesson: Lesson,
	frames: ForwardPosition[],
	p: number,
	reverse: boolean,
	t: Translate
): SignalTable[] {
	const { boundary, vocabulary } = corpora[lesson.language];
	const id = edge.from.id,
		dest = edge.to.id;
	const f = frames[p],
		original = lesson.positions[p],
		g = original.backward;
	const n = frames.length;
	const probability = f.probabilities[f.target];
	const scalar = (v: number) => [vector((reverse ? t('Градиент · ') : '') + t(edge.label), [v])];
	const output = (values: number[]) => [
		vector((reverse ? t('Градиент · ') : '') + t(edge.label), values)
	];
	const matrix = (values: number[][]) => [
		{ name: (reverse ? t('Градиенты · ') : '') + t(edge.label), values }
	];
	if (reverse) {
		switch (id) {
			case 'embedding':
			case 'position':
				return output(g.combined);
			case 'combined':
				return output(g.combined);
			case 'input':
				return output(dest === 'attended' ? g.attended : g.input.map((v, j) => v - g.attended[j]));
			case 'normalized': {
				const key = ({ query: 'Q', key: 'K', value: 'V' } as const)[
					dest as 'query' | 'key' | 'value'
				];
				const incoming = { Q: g.query, K: g.key, V: g.value }[key];
				return output(
					f.normalized.map((_, j) =>
						lesson.tables[key].reduce((sum, row, k) => sum + row[j].before * incoming[k], 0)
					)
				);
			}
			case 'query':
				return output(g.query);
			case 'key':
				return matrix(
					frames
						.slice(0, p + 1)
						.map((_, s) =>
							original.query.map((q, j) => q * g.rawScores[Math.floor(j / headWidth)][s])
						)
				);
			case 'value':
				return matrix(
					frames
						.slice(0, p + 1)
						.map((_, s) =>
							g.merged.map((v, j) => v * original.attention[Math.floor(j / headWidth)][s])
						)
				);
			case 'rawScores':
			case 'scores':
			case 'attention':
				return matrix(g[id]);
			case 'mix':
				return matrix(
					original.attention.map((_, h) => g.merged.slice(h * headWidth, (h + 1) * headWidth))
				);
			case 'merged':
			case 'mlpInput':
			case 'expanded':
			case 'activated':
			case 'hidden':
			case 'logits':
				return output(g[id]);
			case 'projected':
				return output(g.attended);
			case 'attended':
				return output(dest === 'hidden' ? g.hidden : g.attended.map((v, j) => v - g.hidden[j]));
			case 'contracted':
				return output(g.hidden);
			case 'probabilities':
				return output(
					original.probabilities.map((v, k) => (k === original.target ? -1 / (n * v) : 0))
				);
			case 'target':
				return scalar(-1 / (n * original.probabilities[original.target]));
			case 'log':
				return scalar(-1 / n);
			case 'loss':
				return matrix([frames.map(() => 1 / n)]);
			default:
				return [];
		}
	}
	switch (id) {
		case 'symbol':
			return [
				{
					name: t('Символ на входе'),
					values: [[f.token === boundary ? t('начало слова') : vocabulary[f.token]]]
				}
			];
		case 'token':
			return scalar(f.token);
		case 'place':
			return scalar(p);
		case 'key':
		case 'value':
			return matrix(frames.slice(0, p + 1).map((v) => v[id]));
		case 'rawScores':
		case 'scores':
		case 'attention':
			return matrix(f[id]);
		case 'mix':
			return matrix(f.attention.map((_, h) => f.merged.slice(h * headWidth, (h + 1) * headWidth)));
		case 'target':
			return scalar(probability);
		case 'log':
			return scalar(Math.log(probability));
		case 'loss':
			return matrix([frames.map((v) => -Math.log(v.probabilities[v.target]))]);
		case 'embedding':
		case 'position':
		case 'combined':
		case 'input':
		case 'normalized':
		case 'query':
		case 'merged':
		case 'projected':
		case 'attended':
		case 'mlpInput':
		case 'expanded':
		case 'activated':
		case 'contracted':
		case 'hidden':
		case 'logits':
		case 'probabilities':
			return output(f[id]);
		default:
			return [];
	}
}

export function signalTables(
	signal: Signal,
	lesson: Lesson,
	frames: ForwardPosition[],
	position: number,
	applied: boolean,
	t: Translate,
	chosenMoment?: 'before' | 'after' | 'gradient' | 'delta'
): SignalTable[] {
	const corpus = corpora[lesson.language];
	const { reverse, weight } = signal;
	if (signal.output) {
		const { symbol, token, probability } = outputResult(frames[position], signal.output, corpus, t);
		return [
			{
				name: signal.output === 'target' ? t('Цель из слова') : t('Прогноз модели'),
				rows: [t('Символ'), 'ID', t('Вероятность')],
				values: [[symbol], [token], [probability]]
			}
		];
	}
	if (signal.wordInput) {
		const token = frames[position].token;
		return [
			{
				name: t('Вход в блок чтения'),
				values: [[token === corpus.boundary ? t('начало слова') : corpus.vocabulary[token]]]
			}
		];
	}
	if (signal.seed)
		return [
			vector(reverse ? t('Начальный градиент ∂L/∂L') : t('Средняя ошибка слова'), [
				reverse ? 1 : applied ? lesson.lossAfter : lesson.loss
			])
		];
	if (signal.edge) return connectionTables(signal.edge, lesson, frames, position, reverse, t);
	if (weight) {
		const moment =
			chosenMoment ??
			(signal.update ? 'delta' : reverse ? 'gradient' : applied ? 'after' : 'before');
		return [
			{
				name:
					(moment === 'delta'
						? lesson.updated
							? t('Поправка Adam · ')
							: t('Изменение до первого шага · ')
						: moment === 'gradient'
							? t('Градиент матрицы ')
							: t('Матрица ')) + t(parameters.find((p) => p.weight === weight)!.label),
				values: lesson.tables[weight].map((row) =>
					row.map((v) => (moment === 'delta' ? v.after - v.before : v[moment]))
				)
			}
		];
	}
	return [];
}
