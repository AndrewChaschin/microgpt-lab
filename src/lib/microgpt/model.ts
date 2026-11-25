import type { Language } from '$lib/i18n';
import { corpora, type Corpus } from './corpora';

export const width = 16;
export const contextLength = 16;
export const headCount = 4;
export const headWidth = width / headCount;
export const corpusStopping = { patience: 5, minImprovement: 0.005 } as const;

type Edge = { node: Scalar; derivative: number };
class Scalar {
	gradient = 0;

	constructor(
		public value: number,
		readonly edges: Edge[] = []
	) {}

	add(other: Scalar) {
		return new Scalar(this.value + other.value, [
			{ node: this, derivative: 1 },
			{ node: other, derivative: 1 }
		]);
	}

	multiply(other: Scalar) {
		return new Scalar(this.value * other.value, [
			{ node: this, derivative: other.value },
			{ node: other, derivative: this.value }
		]);
	}

	scale(factor: number) {
		return new Scalar(this.value * factor, [{ node: this, derivative: factor }]);
	}

	power(exponent: number) {
		return new Scalar(this.value ** exponent, [
			{ node: this, derivative: exponent * this.value ** (exponent - 1) }
		]);
	}

	exp() {
		const value = Math.exp(this.value);
		return new Scalar(value, [{ node: this, derivative: value }]);
	}

	log() {
		return new Scalar(Math.log(this.value), [{ node: this, derivative: 1 / this.value }]);
	}

	relu() {
		return new Scalar(Math.max(0, this.value), [
			{ node: this, derivative: this.value > 0 ? 1 : 0 }
		]);
	}
}

type Vector = Scalar[];
type Matrix = Vector[];

function backward(loss: Scalar) {
	const visited = new Set<Scalar>();
	const order: Scalar[] = [];

	function visit(node: Scalar) {
		if (visited.has(node)) return;
		visited.add(node);
		node.gradient = 0;
		for (const { node: parent } of node.edges) visit(parent);
		order.push(node);
	}

	visit(loss);
	loss.gradient = 1;
	for (let index = order.length - 1; index >= 0; index -= 1) {
		const node = order[index];
		for (const { node: parent, derivative } of node.edges) {
			parent.gradient += node.gradient * derivative;
		}
	}
}

const sum = (vector: Vector) => vector.reduce((total, value) => total.add(value));
const add = (left: Vector, right: Vector) => left.map((value, j) => value.add(right[j]));
function dot(left: Vector, right: Vector) {
	// Differentiate the dot product directly to avoid two scalar nodes per coordinate.
	const edges: Edge[] = [];
	let value = 0;
	for (let j = 0; j < left.length; j++) {
		const a = left[j],
			b = right[j];
		value += a.value * b.value;
		edges.push({ node: a, derivative: b.value }, { node: b, derivative: a.value });
	}
	return new Scalar(value, edges);
}
const linear = (matrix: Matrix, vector: Vector) => matrix.map((row) => dot(row, vector));
const numbers = (vector: Vector) => vector.map((value) => value.value);
const gradients = (vector: Vector) => vector.map((value) => value.gradient);

function normalize(vector: Vector) {
	const meanSquare = sum(vector.map((value) => value.multiply(value))).scale(1 / vector.length);
	const inverseRms = meanSquare.add(new Scalar(1e-5)).power(-0.5);
	return vector.map((value) => value.multiply(inverseRms));
}

function softmax(logits: Vector) {
	const max = Math.max(...numbers(logits));
	const exponents = logits.map((logit) => logit.add(new Scalar(-max)).exp());
	const inverseSum = sum(exponents).power(-1);
	return exponents.map((value) => value.multiply(inverseSum));
}

function seededRandom(seed: number) {
	let state = seed;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return (state + 0.5) / 4294967296;
	};
}

// Fisher–Yates with a repeatable seed so reset reproduces the same lesson.
export function corpusOrder(startStep: number, words = corpora.ru.words) {
	const random = seededRandom(42 + startStep);
	const order = [...words];
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	return order;
}

export function learningRate(completedSteps: number) {
	return 0.004 / Math.sqrt(1 + completedSteps / 1000);
}

type Context = { keys: Matrix; values: Matrix };
type Forward = ReturnType<MicroGpt['forward']>;
export type Change = { before: number; gradient: number; after: number };
function weightChanges(vector: Vector, changes: Map<Scalar, Change>) {
	return vector.map(
		(node) => changes.get(node) ?? { before: node.value, gradient: 0, after: node.value }
	);
}
export type SelectedWeights = Record<
	'E' | 'P' | 'Q' | 'K' | 'V' | 'O' | 'MLP in' | 'MLP out' | 'Выход',
	Change[]
>;
export type Weight = keyof SelectedWeights;
export type WeightAddress = { key: Weight; row: number; coordinate: number };
export const stageWeights: Weight[][] = [
	['E'],
	['E', 'P'],
	['Q', 'K', 'V'],
	['O'],
	['MLP in', 'MLP out'],
	['Выход']
];
export function weightRow(key: Weight, frame: Position, position: number, coordinate: number) {
	return key === 'E'
		? frame.token
		: key === 'P'
			? position
			: key === 'Выход'
				? frame.target
				: coordinate;
}
export type ForwardPosition = {
	rawScores: number[][];
	scores: number[][];
	projected: number[];
	contracted: number[];
	input: number[];
	normalized: number[];
	merged: number[];
	mlpInput: number[];
	expanded: number[];
	logits: number[];
	token: number;
	target: number;
	embedding: number[];
	position: number[];
	combined: number[];
	query: number[];
	key: number[];
	value: number[];
	attention: number[][];
	attended: number[];
	activated: number[];
	hidden: number[];
	probabilities: number[];
};
export type Position = ForwardPosition & {
	backward: {
		input: number[];
		mlpInput: number[];
		activated: number[];
		rawScores: number[][];
		scores: number[][];
		attention: number[][];
		normalized: number[];
		expanded: number[];
		combined: number[];
		query: number[];
		key: number[];
		value: number[];
		logits: number[];
		merged: number[];
		attended: number[];
		hidden: number[];
		targetLogit: number;
	};
	after: number;
	weights: SelectedWeights;
};
export type Influence = {
	E: number[][];
	P: number[][];
	Выход: number[][];
	diagonal: Record<Exclude<keyof SelectedWeights, 'E' | 'P' | 'Выход'>, number[]>;
};
export type Checkpoint = {
	language?: Language;
	step: number;
	corpusIndex?: number;
	state: Float64Array;
};
export const trainingBlocks = [
	{ id: 'token', name: 'Эмбеддинги букв · E', stage: 1, weight: 'E' },
	{ id: 'position', name: 'Эмбеддинги позиций · P', stage: 1, weight: 'P' },
	{ id: 'qkv', name: 'Запросы, ключи и значения', stage: 2, weight: 'Q' },
	{ id: 'attention', name: 'Выход внимания', stage: 3, weight: 'O' },
	{ id: 'mlp', name: 'Слои MLP', stage: 4, weight: 'MLP in' },
	{ id: 'output', name: 'Выходные веса', stage: 5, weight: 'Выход' }
] as const;
type Block = (typeof trainingBlocks)[number]['id'];
type GradientCounts = Record<Block, { active: number; total: number }>;
export type Lesson = {
	language: Language;
	blocks: GradientCounts;
	influences: Influence[];
	word: string;
	tables: Record<Weight, Change[][]>;
	positions: Position[];
	afterPositions?: ForwardPosition[];
	loss: number;
	lossAfter: number;
	updated: boolean;
};
export type Prediction = {
	prefix: string;
	completion: string;
	choices: { token: number; probability: number }[];
};

type WordForecast = {
	word: string;
	loss: number;
	positions: {
		predicted: number;
		target: number;
		probability: number;
		targetProbability: number;
	}[];
};

function summarizeForecasts(forecasts: WordForecast[]) {
	let totalLoss = 0;
	let correct = 0;
	let positions = 0;
	for (const forecast of forecasts) {
		totalLoss += forecast.loss;
		positions += forecast.positions.length;
		for (const { predicted, target } of forecast.positions) {
			if (predicted === target) correct++;
		}
	}
	return { loss: totalLoss / forecasts.length, correct, positions };
}

export function mostLikelyToken(probabilities: number[]) {
	return probabilities.reduce((best, p, id) => (p > probabilities[best] ? id : best), 0);
}

export class MicroGpt {
	private random = seededRandom(42);
	private weights;
	private parameters;
	readonly corpus: Corpus;
	readonly parameterCount: number;
	step = 0;
	private corpusIndex = 0;

	constructor(
		checkpoint?: Checkpoint,
		readonly language: Language = checkpoint?.language ?? 'ru'
	) {
		this.corpus = corpora[language];
		this.weights = {
			token: this.matrix(this.corpus.vocabulary.length, width),
			position: this.matrix(contextLength, width),
			query: this.matrix(width, width),
			key: this.matrix(width, width),
			value: this.matrix(width, width),
			attention: this.matrix(width, width),
			expand: this.matrix(4 * width, width),
			contract: this.matrix(width, 4 * width),
			output: this.matrix(this.corpus.vocabulary.length, width)
		};
		this.parameters = Object.values(this.weights)
			.flat(2)
			.map((node) => ({ node, mean: 0, square: 0 }));
		this.parameterCount = this.parameters.length;
		if (!checkpoint) return;
		this.step = checkpoint.step;
		this.corpusIndex = checkpoint.corpusIndex ?? checkpoint.step % this.corpus.words.length;
		this.parameters.forEach((param, i) => {
			param.node.value = checkpoint.state[3 * i];
			param.mean = checkpoint.state[3 * i + 1];
			param.square = checkpoint.state[3 * i + 2];
		});
	}

	checkpoint(): Checkpoint {
		const state = new Float64Array(this.parameters.length * 3);
		this.parameters.forEach((param, i) => {
			state[3 * i] = param.node.value;
			state[3 * i + 1] = param.mean;
			state[3 * i + 2] = param.square;
		});
		return { language: this.language, step: this.step, corpusIndex: this.corpusIndex, state };
	}

	private get weightMatrices() {
		const w = this.weights;
		return {
			E: w.token,
			P: w.position,
			Q: w.query,
			K: w.key,
			V: w.value,
			O: w.attention,
			'MLP in': w.expand,
			'MLP out': w.contract,
			Выход: w.output
		};
	}

	readWeight({ key, row, coordinate }: WeightAddress) {
		return this.weightMatrices[key][row][coordinate].value;
	}

	get nextWord() {
		return this.corpus.words[this.corpusIndex];
	}

	private matrix(rows: number, columns: number): Matrix {
		return Array.from({ length: rows }, () =>
			Array.from({ length: columns }, () => {
				const normal =
					Math.sqrt(-2 * Math.log(this.random())) * Math.cos(2 * Math.PI * this.random());
				return new Scalar(normal * 0.08);
			})
		);
	}

	forward(token: number, position: number, context: Context) {
		const weights = this.weights;
		const embedding = weights.token[token];
		const positional = weights.position[position];
		const combined = add(embedding, positional);
		const input = normalize(combined);
		const normalized = normalize(input);
		const query = linear(weights.query, normalized);
		const key = linear(weights.key, normalized);
		const value = linear(weights.value, normalized);
		context.keys.push(key);
		context.values.push(value);

		const rawScores: Matrix = [];
		const scaledScores: Matrix = [];
		const attention: Matrix = [];
		const merged: Vector = [];
		for (let head = 0; head < headCount; head += 1) {
			const start = head * headWidth;
			const end = start + headWidth;
			const dots = context.keys.map((row) => dot(query.slice(start, end), row.slice(start, end)));
			const scores = dots.map((v) => v.scale(1 / Math.sqrt(headWidth)));
			rawScores.push(dots);
			scaledScores.push(scores);
			const shares = softmax(scores);
			attention.push(shares);
			for (let j = start; j < end; j += 1) {
				merged.push(
					sum(shares.map((share, earlier) => share.multiply(context.values[earlier][j])))
				);
			}
		}
		const projected = linear(weights.attention, merged);
		const attended = add(input, projected);
		const mlpInput = normalize(attended);
		const expanded = linear(weights.expand, mlpInput);
		const activated = expanded.map((value) => value.relu());
		const contracted = linear(weights.contract, activated);
		const hidden = add(attended, contracted);
		const logits = linear(weights.output, hidden);
		const probabilities = softmax(logits);
		return {
			rawScores,
			scaledScores,
			projected,
			contracted,
			input,
			normalized,
			mlpInput,
			expanded,
			merged,
			logits,
			embedding,
			positional,
			combined,
			query,
			key,
			value,
			attention,
			attended,
			activated,
			hidden,
			probabilities
		};
	}

	private traceWord(word: string) {
		const ids = [
			this.corpus.boundary,
			...Array.from(word, (letter) => this.corpus.alphabet.indexOf(letter)),
			this.corpus.boundary
		];
		const context: Context = { keys: [], values: [] };
		const passes = ids.slice(0, -1).map((token, p) => ({
			token,
			target: ids[p + 1],
			p,
			forward: this.forward(token, p, context)
		}));
		const loss = sum(
			passes.map(({ target, forward }) => forward.probabilities[target].log().scale(-1))
		).scale(1 / passes.length);
		return { passes, loss };
	}

	private captureWeights(
		token: number,
		p: number,
		target: number,
		changes: Map<Scalar, Change>
	): SelectedWeights {
		const w = this.weights;
		const coordinates = Array.from({ length: width }, (_, j) => j);
		const diagonal = (matrix: Matrix) => coordinates.map((j) => matrix[j][j]);
		const values = (vector: Vector) => weightChanges(vector, changes);
		return {
			E: values(w.token[token]),
			P: values(w.position[p]),
			Q: values(diagonal(w.query)),
			K: values(diagonal(w.key)),
			V: values(diagonal(w.value)),
			O: values(diagonal(w.attention)),
			'MLP in': values(diagonal(w.expand)),
			'MLP out': values(diagonal(w.contract)),
			Выход: values(w.output[target])
		};
	}

	private forwardValues({
		token,
		target,
		forward
	}: {
		token: number;
		target: number;
		forward: Forward;
	}): ForwardPosition {
		return {
			token,
			target,
			rawScores: forward.rawScores.map(numbers),
			scores: forward.scaledScores.map(numbers),
			projected: numbers(forward.projected),
			contracted: numbers(forward.contracted),
			input: numbers(forward.input),
			normalized: numbers(forward.normalized),
			merged: numbers(forward.merged),
			mlpInput: numbers(forward.mlpInput),
			expanded: numbers(forward.expanded),
			logits: numbers(forward.logits),
			embedding: numbers(forward.embedding),
			position: numbers(forward.positional),
			combined: numbers(forward.combined),
			query: numbers(forward.query),
			key: numbers(forward.key),
			value: numbers(forward.value),
			attention: forward.attention.map(numbers),
			attended: numbers(forward.attended),
			activated: numbers(forward.activated),
			hidden: numbers(forward.hidden),
			probabilities: numbers(forward.probabilities)
		};
	}

	private capture(
		pass: { token: number; target: number; p: number; forward: Forward },
		changes: Map<Scalar, Change>
	): Position {
		const { token, target, p, forward } = pass;
		const values = this.forwardValues(pass);
		return {
			...values,
			backward: {
				input: gradients(forward.input),
				mlpInput: gradients(forward.mlpInput),
				activated: gradients(forward.activated),
				rawScores: forward.rawScores.map(gradients),
				scores: forward.scaledScores.map(gradients),
				attention: forward.attention.map(gradients),
				normalized: gradients(forward.normalized),
				expanded: gradients(forward.expanded),
				combined: gradients(forward.combined),
				query: gradients(forward.query),
				key: gradients(forward.key),
				value: gradients(forward.value),
				logits: gradients(forward.logits),
				merged: gradients(forward.merged),
				attended: gradients(forward.attended),
				hidden: gradients(forward.hidden),
				targetLogit: forward.logits[target].gradient
			},
			after: values.probabilities[target],
			weights: this.captureWeights(token, p, target, changes)
		};
	}

	private lossInfluences(passes: ReturnType<MicroGpt['traceWord']>['passes']): Influence[] {
		const w = this.weights;
		const diagonal = (matrix: Matrix) =>
			Array.from({ length: width }, (_, j) => matrix[j][j].gradient);
		return passes.map(({ target, forward }) => {
			// Parameters outside this position's causal graph must contribute zero.
			for (const { node } of this.parameters) node.gradient = 0;
			backward(forward.probabilities[target].log().scale(-1 / passes.length));
			return {
				E: w.token.map(gradients),
				P: w.position.map(gradients),
				Выход: w.output.map(gradients),
				diagonal: {
					Q: diagonal(w.query),
					K: diagonal(w.key),
					V: diagonal(w.value),
					O: diagonal(w.attention),
					'MLP in': diagonal(w.expand),
					'MLP out': diagonal(w.contract)
				}
			};
		});
	}

	private parameterTables(changes: Map<Scalar, Change>) {
		const matrices = this.weightMatrices;
		const tables = {} as Record<Weight, Change[][]>;
		for (const key of Object.keys(matrices) as Weight[]) {
			tables[key] = matrices[key].map((row) => weightChanges(row, changes));
		}
		return tables;
	}

	private gradientCounts(): GradientCounts {
		const count = (...matrices: Matrix[]) => {
			let active = 0;
			let total = 0;
			for (const matrix of matrices) {
				for (const row of matrix) {
					total += row.length;
					for (const node of row) if (node.gradient !== 0) active++;
				}
			}
			return { active, total };
		};
		const w = this.weights;
		return {
			token: count(w.token),
			position: count(w.position),
			qkv: count(w.query, w.key, w.value),
			attention: count(w.attention),
			mlp: count(w.expand, w.contract),
			output: count(w.output)
		};
	}

	private forecastWord(word: string): WordForecast {
		const { loss, passes } = this.traceWord(word);
		return {
			word,
			loss: loss.value,
			positions: passes.map(({ forward, target }) => {
				const probabilities = numbers(forward.probabilities);
				const predicted = mostLikelyToken(probabilities);
				return {
					predicted,
					target,
					probability: probabilities[predicted],
					targetProbability: probabilities[target]
				};
			})
		};
	}

	corpusMetrics() {
		return summarizeForecasts(this.corpus.words.map((word) => this.forecastWord(word)));
	}

	validate() {
		const forecasts = this.corpus.validationWords.map((word) => this.forecastWord(word));
		return { metrics: summarizeForecasts(forecasts), forecasts };
	}

	preview(word = this.nextWord): Lesson {
		const { passes, loss } = this.traceWord(word);
		const influences = this.lossInfluences(passes);
		backward(loss);
		const blocks = this.gradientCounts();
		const changes = new Map<Scalar, Change>();
		for (const { node } of this.parameters) {
			changes.set(node, { before: node.value, gradient: node.gradient, after: node.value });
			node.gradient = 0;
		}
		return {
			language: this.language,
			word,
			blocks,
			influences,
			tables: this.parameterTables(changes),
			positions: passes.map((pass) => this.capture(pass, changes)),
			loss: loss.value,
			lossAfter: loss.value,
			updated: false
		};
	}

	train(inspect = false, word = this.nextWord) {
		if (this.corpus.validationWords.includes(word))
			throw new Error('Это слово отложено для проверки');
		const { passes, loss } = this.traceWord(word);
		const influences = inspect ? this.lossInfluences(passes) : [];
		backward(loss);
		const blocks = inspect ? this.gradientCounts() : undefined;
		if (word === this.nextWord)
			this.corpusIndex = (this.corpusIndex + 1) % this.corpus.words.length;
		const rate = learningRate(this.step);
		this.step += 1;
		const firstCorrection = 1 - 0.85 ** this.step;
		const secondCorrection = 1 - 0.99 ** this.step;
		const changes = inspect ? new Map<Scalar, Change>() : undefined;

		for (const param of this.parameters) {
			const node = param.node;
			const before = node.value;
			const gradient = node.gradient;
			param.mean = 0.85 * param.mean + 0.15 * gradient;
			param.square = 0.99 * param.square + 0.01 * gradient ** 2;
			node.value -=
				(rate * (param.mean / firstCorrection)) /
				(Math.sqrt(param.square / secondCorrection) + 1e-8);
			changes?.set(node, { before, gradient, after: node.value });
			node.gradient = 0;
		}

		if (!changes || !blocks) return { loss: loss.value, detail: null };

		const after = this.traceWord(word);
		const afterPositions = after.passes.map((pass) => this.forwardValues(pass));
		const positions = passes.map((pass, p) => {
			const frame = this.capture(pass, changes);
			frame.embedding = frame.weights.E.map(({ before }) => before);
			frame.position = frame.weights.P.map(({ before }) => before);
			frame.after = afterPositions[p].probabilities[pass.target];
			return frame;
		});
		return {
			loss: loss.value,
			detail: {
				language: this.language,
				word,
				positions,
				afterPositions,
				blocks,
				tables: this.parameterTables(changes),
				influences,
				loss: loss.value,
				lossAfter: after.loss.value,
				updated: true
			}
		};
	}

	predict(prefix: string): Prediction {
		const context: Context = { keys: [], values: [] };
		let result = this.forward(this.corpus.boundary, 0, context);
		for (const [p, letter] of Array.from(prefix).entries()) {
			result = this.forward(this.corpus.alphabet.indexOf(letter), p + 1, context);
		}
		const ranked = () =>
			numbers(result.probabilities)
				.map((probability, token) => ({ probability, token }))
				.sort((a, b) => b.probability - a.probability);
		const choices = ranked().slice(0, 3);
		let completion = prefix;
		for (let p = prefix.length + 1; p < contextLength; p += 1) {
			const token = mostLikelyToken(numbers(result.probabilities));
			if (token === this.corpus.boundary) break;
			completion += this.corpus.vocabulary[token];
			result = this.forward(token, p, context);
		}
		return { prefix, completion, choices };
	}
}
