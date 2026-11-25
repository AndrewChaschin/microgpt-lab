import { get, writable } from 'svelte/store';
import type { Language } from '$lib/i18n';
import type {
	CorpusProgress,
	Snapshot,
	TrainingRequest,
	TrainingResponse
} from './training.worker';

type SessionState = {
	busy: boolean;
	trainingCorpus: boolean;
	snapshot?: Snapshot;
	progress?: CorpusProgress;
	error?: string;
};

export function trainingSession(language: Language) {
	const initial: SessionState = { busy: true, trainingCorpus: false };
	const state = writable(initial);
	let worker: Worker | undefined;

	function stop() {
		if (worker) {
			worker.onmessage = null;
			worker.onerror = null;
			worker.terminate();
			worker = undefined;
		}
	}

	function reset() {
		stop();
		state.set(initial);
		try {
			worker = new Worker(new URL('./training.worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = ({ data }: MessageEvent<TrainingResponse>) => {
				if (data.type === 'progress') return;
				state.update((previous) => {
					const snapshot = data.snapshot ?? previous.snapshot;
					if (data.type === 'corpus-progress')
						return { ...previous, snapshot, progress: data.progress };
					return {
						snapshot,
						busy: false,
						trainingCorpus: false,
						error: data.type === 'error' ? data.message : undefined
					};
				});
			};
			worker.onerror = () => {
				state.update(({ snapshot }) => ({
					snapshot,
					busy: false,
					trainingCorpus: false,
					error: 'Фоновый поток завершился. Нажмите «Сбросить», чтобы запустить модель заново.'
				}));
			};
			worker.postMessage({ type: 'reset', language } satisfies TrainingRequest);
		} catch {
			state.set({
				busy: false,
				trainingCorpus: false,
				error: 'Браузер не смог запустить фоновые вычисления.'
			});
		}
	}

	function send(message: TrainingRequest) {
		if (!worker || get(state).busy) return;
		state.update((s) => ({
			...s,
			busy: true,
			trainingCorpus: message.type === 'train-corpus',
			error: undefined
		}));
		worker.postMessage(message);
	}

	return {
		subscribe: state.subscribe,
		start() {
			if (!worker) reset();
		},
		reset,
		send,
		stop
	};
}
