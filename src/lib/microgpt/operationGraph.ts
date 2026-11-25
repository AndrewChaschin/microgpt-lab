import type { Translate } from '$lib/i18n';
import type { Weight } from './model';

interface PlacedOperation<Id extends string> {
	id: Id;
	stage: number;
	x: number;
	y: number;
	w: number;
	name: string;
	formula: string;
	backName: string;
	backFormula: string;
	weight?: Weight;
}
function op<Id extends string>(
	id: Id,
	stage: number,
	x: number,
	y: number,
	w: number,
	name: string,
	formula: string,
	backName: string,
	backFormula: string,
	weight?: Weight
): PlacedOperation<Id> {
	return { id, stage, x, y, w, name, formula, backName, backFormula, weight };
}
export const operations = [
	op('symbol', 0, 85, 62, 132, 'Чтение символа', 'слово[t − 1]', 'Символ', ''),
	op('token', 0, 85, 145, 132, 'Поиск ID', 'словарь[символ]', 'ID символа', ''),
	op('place', 0, 85, 315, 132, 'Номер позиции', 't', 'Позиция', ''),
	op('embedding', 1, 245, 145, 103, 'Строка E', 'E[id, :]', 'Сумма по ID', 'gE[id] += gₓ', 'E'),
	op('position', 1, 325, 315, 132, 'Строка P', 'P[t, :]', 'Строка позиции', 'gP[t] += gₓ', 'P'),
	op('combined', 1, 435, 215, 115, 'Сумма', 'x = E + P', 'Разветвление', 'gE, gP ← gₓ'),
	op('input', 2, 570, 215, 120, 'RMSNorm', 'b = N(x)', 'Производная N', 'gₓ = Jₙᵀgᵦ'),
	op('normalized', 2, 710, 215, 120, 'RMSNorm', 'u = N(b)', 'Производная N', 'gᵦ += Jₙᵀgᵤ'),
	op('query', 2, 855, 70, 90, 'Запрос', 'Q = Wq · u', 'Вклад Q', 'WqᵀgQ', 'Q'),
	op('key', 2, 935, 215, 90, 'Ключ', 'K = Wk · u', 'Вклад K', 'WkᵀgK', 'K'),
	op('value', 2, 1015, 325, 90, 'Значение', 'V = Wv · u', 'Вклад V', 'WvᵀgV', 'V'),
	op(
		'rawScores',
		3,
		1170,
		70,
		140,
		'Сходство Q и K',
		'r = QKᵀ',
		'Градиенты Q, K',
		'gQ = gᵣK, gK = gᵣᵀQ'
	),
	op(
		'scores',
		3,
		1170,
		155,
		140,
		'Масштабирование',
		's = r / √d',
		'Масштабирование',
		'gᵣ = gₛ / √d'
	),
	op(
		'attention',
		3,
		1170,
		240,
		175,
		'Softmax внимания',
		'α = softmax(s)',
		'Производная softmax',
		'gₛ = Jsoftmaxᵀgα'
	),
	op('mix', 3, 1170, 325, 140, 'Смесь в голове', 'm = Σ αₛVₛ', 'Вклады в α и V', 'gVₛ += αₛgₘ'),
	op(
		'merged',
		3,
		1170,
		425,
		140,
		'Соединение голов',
		'c = concat(m₁,…,m₄)',
		'Разделение голов',
		'gₘ = срез g꜀'
	),
	op(
		'projected',
		3,
		1365,
		425,
		140,
		'Выходная проекция',
		'v = O · c',
		'Градиент смеси',
		'g꜀ = Oᵀgᵥ',
		'O'
	),
	op(
		'attended',
		3,
		1560,
		425,
		140,
		'Прибавление входа',
		'a = b + v',
		'Разветвление',
		'gᵦ += gₐ, gᵥ = gₐ'
	),
	op('mlpInput', 4, 1740, 425, 145, 'RMSNorm', 'n = N(a)', 'Производная N', 'gₐ += Jₙᵀgₙ'),
	op(
		'expanded',
		4,
		1935,
		425,
		145,
		'Расширение',
		'z = W₁ · n',
		'Градиент входа',
		'gₙ = W₁ᵀg𝓏',
		'MLP in'
	),
	op(
		'activated',
		4,
		1935,
		285,
		145,
		'ReLU',
		'r = max(0, z)',
		'Производная ReLU',
		'g𝓏 = gᵣ · 1[z > 0]'
	),
	op(
		'contracted',
		4,
		2130,
		285,
		145,
		'Сжатие',
		'c₂ = W₂ · r',
		'Градиент ReLU',
		'gᵣ = W₂ᵀg꜀₂',
		'MLP out'
	),
	op(
		'hidden',
		4,
		2130,
		135,
		145,
		'Прибавление входа',
		'h = a + c₂',
		'Разветвление',
		'gₐ += gₕ, g꜀₂ = gₕ'
	),
	op(
		'logits',
		5,
		2325,
		135,
		147,
		'Оценки символов',
		'z = W · h',
		'Градиент h',
		'gₕ = Wᵀg𝓏',
		'Выход'
	),
	op(
		'probabilities',
		5,
		2520,
		135,
		175,
		'Softmax выхода',
		'p = softmax(z)',
		'Производная softmax',
		'g𝓏 = Jsoftmaxᵀgₚ'
	),
	op('argmax', 5, 2715, 42, 145, 'Выбор максимума', 'k = argmax(p)', '', ''),
	op(
		'target',
		6,
		2715,
		135,
		145,
		'Выбор цели',
		'p* = p[ID цели]',
		'Вклад в p цели',
		'gₚ[цель] = gₚ*'
	),
	op('log', 6, 2940, 235, 145, 'Логарифм', 'l = ln(p*)', 'Производная ln', 'gₚ* = gₗ / p*'),
	op('loss', 6, 2940, 335, 145, 'Смена знака', 'ℓ = −l', 'Смена знака', 'gₗ = −gℓ'),
	op('mean', 6, 2940, 435, 145, 'Среднее по слову', 'L = Σ ℓₜ / N', 'Распределение', 'gℓ = 1 / N')
];
export type Operation = (typeof operations)[number];
export type Point = [number, number];
export interface Connection {
	from: Operation;
	to: Operation;
	points: Point[];
	label: string;
	discrete: boolean;
}
const byId = new Map(operations.map((n) => [n.id, n]));
// Clip each orthogonal route at the ports so the arrowhead ends at the block boundary.
function port(n: Operation, toward: Point): Point {
	const dx = toward[0] - n.x,
		dy = toward[1] - n.y;
	if (Math.abs(dx) > n.w / 2 && Math.abs(dy) < 20)
		return [n.x + (Math.sign(dx) * n.w) / 2, toward[1]];
	if (Math.abs(dy) > 20 && Math.abs(dx) < n.w / 2) return [toward[0], n.y + Math.sign(dy) * 20];
	throw new Error('Соединение должно подходить к порту по горизонтали или вертикали: ' + n.id);
}
function wire(
	fromId: Operation['id'],
	toId: Operation['id'],
	label: string,
	...bends: Point[]
): Connection {
	const from = byId.get(fromId)!,
		to = byId.get(toId)!;
	return {
		from,
		to,
		label,
		discrete: !from.backFormula || !to.backFormula,
		points: [
			port(from, bends[0] ?? [to.x, to.y]),
			...bends,
			port(to, bends[bends.length - 1] ?? [from.x, from.y])
		]
	};
}
export const connections = [
	wire('symbol', 'token', 'буква'),
	wire('token', 'embedding', 'ID'),
	wire('place', 'position', 't'),
	wire('embedding', 'combined', 'E', [435, 145]),
	wire('position', 'combined', 'P', [435, 315]),
	wire('combined', 'input', 'x'),
	wire('input', 'normalized', 'b'),
	wire('input', 'attended', 'b', [570, 498], [1560, 498]),
	wire('normalized', 'query', 'u', [710, 70]),
	wire('normalized', 'key', 'u'),
	wire('normalized', 'value', 'u', [710, 325]),
	wire('query', 'rawScores', 'Q'),
	wire('key', 'rawScores', 'K', [1065, 215], [1065, 82]),
	wire('value', 'mix', 'V'),
	wire('rawScores', 'scores', 'r'),
	wire('scores', 'attention', 's'),
	wire('attention', 'mix', 'α'),
	wire('mix', 'merged', 'm'),
	wire('merged', 'projected', 'c'),
	wire('projected', 'attended', 'v'),
	wire('attended', 'mlpInput', 'a'),
	wire('attended', 'hidden', 'a', [1560, 135]),
	wire('mlpInput', 'expanded', 'n'),
	wire('expanded', 'activated', 'z'),
	wire('activated', 'contracted', 'r'),
	wire('contracted', 'hidden', 'c₂'),
	wire('hidden', 'logits', 'h'),
	wire('logits', 'probabilities', 'z'),
	wire('probabilities', 'argmax', 'p', [2520, 42]),
	wire('probabilities', 'target', 'p'),
	wire('target', 'log', 'p*', [2940, 135]),
	wire('log', 'loss', 'ln p*'),
	wire('loss', 'mean', 'ℓₜ')
];
const parameterNames: Record<Weight, string> = {
	E: 'E',
	P: 'P',
	Q: 'Wq',
	K: 'Wk',
	V: 'Wv',
	O: 'O',
	'MLP in': 'W₁',
	'MLP out': 'W₂',
	Выход: 'W выхода'
};
export const circuitWidth = 3090;
export const circuitHeight = 1160;
export const matrixY = circuitHeight / 2;

// Each matrix shares its column with the operation that reads it and its derivative.
export const parameters = operations.flatMap((node) =>
	node.weight ? [{ weight: node.weight, node, label: parameterNames[node.weight] }] : []
);

const predictionNodes = operations.filter((node) => node.stage < 6);
export const phaseNodes = [
	predictionNodes,
	operations.filter((node) => node.stage === 6),
	operations.filter((node) => node.backFormula).reverse(),
	parameters.map((parameter) => parameter.node),
	predictionNodes
];

export function blockName(node: Operation, phase: number, t: Translate) {
	if (phase === 2) return t(node.backName);
	if (phase === 3) return 'Adam · ' + t(node.weight ?? '');
	return t(node.name);
}
