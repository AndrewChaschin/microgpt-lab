import type { Language } from '$lib/i18n';
import {
	MicroGpt,
	corpusOrder,
	corpusStopping,
	type Checkpoint,
	type Lesson,
	type Prediction,
	type WeightAddress
} from './model';

export type TrainingRequest =
	| { type: 'reset'; language?: Language; prefix?: string }
	| { type: 'predict'; prefix: string }
	| { type: 'train-corpus' }
	| { type: 'word'; index: number; prefix?: string }
	| { type: 'inspect'; step: number; prefix?: string; trace?: WeightAddress }
	| { type: 'train'; steps: number; prefix?: string; word?: string; trace?: WeightAddress };

export type HistoryEntry = {
	step: number;
	word: string;
	loss: number;
};

type CorpusMetrics = ReturnType<MicroGpt['corpusMetrics']>;
type CorpusResult = CorpusMetrics & { cycles: number; bestCycle: number };
export type CorpusProgress = CorpusMetrics & { cycle: number; completed: number };
export type Snapshot = {
	trainingMetrics: CorpusMetrics;
	validation: ReturnType<MicroGpt['validate']>;
	corpusResult?: CorpusResult;
	viewedStep: number;
	lesson: Lesson;
	nextWord: string;
	transfer?: {
		address: WeightAddress;
		previousWord: string;
		previousAfter: number;
		before: number;
		after: number;
	};
	step: number;
	parameterCount: number;
	history: HistoryEntry[];
	prediction?: Prediction;
};

export type TrainingResponse =
	| { type: 'snapshot'; snapshot: Snapshot }
	| { type: 'progress'; completed: number }
	| { type: 'corpus-progress'; progress: CorpusProgress; snapshot?: Snapshot }
	| { type: 'error'; message: string; snapshot?: Snapshot };

const post = (message: TrainingResponse) => globalThis.postMessage(message);

let model: MicroGpt;
let lesson: Lesson;
let history: (HistoryEntry & { checkpoint: Checkpoint })[] = [];
let viewedStep = 0;
let viewedModel: MicroGpt;

let transfer: Snapshot['transfer'];
function inspect(step: number, address?: WeightAddress) {
	const record = history.find((entry) => entry.step === step);
	if (!record) throw new Error('Шаг отсутствует в истории');
	const replay = new MicroGpt(record.checkpoint);
	const fromPrevious =
		address && viewedStep && viewedStep + 1 === step
			? {
					address,
					previousWord: lesson.word,
					previousAfter: viewedModel.readWeight(address),
					before: replay.readWeight(address)
				}
			: undefined;
	const { detail } = replay.train(true, record.word);
	transfer = fromPrevious && { ...fromPrevious, after: replay.readWeight(fromPrevious.address) };
	if (!detail) throw new Error('Нет данных шага');
	viewedModel = replay;
	lesson = detail;
	viewedStep = step;
}

let corpusResult: CorpusResult | undefined;
// Reading the word list or replaying a step keeps the current model and its evaluation.
let evaluation:
	| { step: number; training: CorpusMetrics; validation: ReturnType<MicroGpt['validate']> }
	| undefined;
function evaluateCurrentModel() {
	if (evaluation?.step !== model.step) {
		evaluation = {
			step: model.step,
			training: model.corpusMetrics(),
			validation: model.validate()
		};
	}
	return evaluation;
}
function snapshot(prefix?: string): Snapshot {
	const { training, validation } = evaluateCurrentModel();
	return {
		trainingMetrics: training,
		validation,
		lesson,
		corpusResult,
		nextWord: model.nextWord,
		transfer,
		step: model.step,
		parameterCount: model.parameterCount,
		history: history.map(({ step, word, loss }) => ({ step, word, loss })),
		viewedStep,
		prediction: prefix === undefined ? undefined : viewedModel.predict(prefix)
	};
}

const historyLimit = 50;
function trainWord(word: string) {
	const checkpoint = model.checkpoint();
	const { loss } = model.train(false, word);
	history.push({ checkpoint, step: model.step, word, loss });
	if (history.length > historyLimit) history.shift();
}

function previewWord(word: string) {
	viewedModel = model;
	lesson = model.preview(word);
	viewedStep = 0;
}

function trainCorpus() {
	const selectedWord = lesson.word;
	const { words } = model.corpus;
	const { patience, minImprovement } = corpusStopping;
	let metrics = evaluateCurrentModel().training;
	let best = { cycle: 0, metrics, state: model.checkpoint(), history: history.slice() };
	let referenceLoss = metrics.loss;
	let lastImprovement = 0;
	corpusResult = undefined;
	try {
		for (let cycle = 1; ; cycle++) {
			const order = corpusOrder(model.step, words);
			for (const [i, word] of order.entries()) {
				if (i % 10 === 0)
					post({ type: 'corpus-progress', progress: { cycle, completed: i, ...metrics } });
				trainWord(word);
			}
			post({ type: 'corpus-progress', progress: { cycle, completed: words.length, ...metrics } });
			metrics = evaluateCurrentModel().training;
			const { loss } = metrics;
			if (!Number.isFinite(loss)) throw new Error('Неконечная ошибка корпуса');
			if (loss < best.metrics.loss)
				best = { cycle, metrics, state: model.checkpoint(), history: history.slice() };
			if (referenceLoss - loss >= minImprovement) {
				referenceLoss = loss;
				lastImprovement = cycle;
			}
			if (cycle - lastImprovement >= patience) {
				corpusResult = { cycles: cycle, bestCycle: best.cycle, ...best.metrics };
				break;
			}
			previewWord(selectedWord);
			post({
				type: 'corpus-progress',
				progress: { cycle, completed: words.length, ...metrics },
				snapshot: snapshot()
			});
		}
	} finally {
		model = new MicroGpt(best.state);
		history = best.history;
		previewWord(selectedWord);
	}
}

globalThis.onmessage = ({ data }: MessageEvent<TrainingRequest>) => {
	try {
		if (data.type !== 'predict') transfer = undefined;
		switch (data.type) {
			case 'reset':
				evaluation = undefined;
				corpusResult = undefined;
				model = new MicroGpt(undefined, data.language);
				lesson = model.preview();
				history = [];
				viewedStep = 0;
				viewedModel = model;
				break;
			case 'word': {
				const word = model.corpus.words[data.index];
				if (!word) throw new Error('Нет такого слова в корпусе');
				const record = history
					.slice()
					.reverse()
					.find((entry) => entry.word === word);
				if (record && !corpusResult) inspect(record.step);
				else previewWord(word);
				break;
			}
			case 'inspect':
				inspect(data.step, data.trace);
				break;
			case 'train-corpus':
				trainCorpus();
				break;
			case 'train':
				for (let completed = 1; completed <= data.steps; completed += 1) {
					trainWord(data.word ?? model.nextWord);
					if (completed % 5 === 0) post({ type: 'progress', completed });
				}
				corpusResult = undefined;
				inspect(model.step - data.steps + 1, data.trace);
				break;
		}
		post({ type: 'snapshot', snapshot: snapshot('prefix' in data ? data.prefix : undefined) });
	} catch {
		post({
			type: 'error',
			snapshot: data.type === 'train-corpus' ? snapshot() : undefined,
			message: 'Не удалось выполнить вычисления. Сбросьте модель и повторите шаг.'
		});
	}
};
