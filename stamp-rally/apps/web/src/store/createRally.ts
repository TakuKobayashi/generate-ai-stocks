import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { CreateRallyForm, CreateRallyLocation } from '@/types';

const defaultForm: CreateRallyForm = {
  name: '',
  description: '',
  startAt: '',
  endAt: '',
  maxParticipants: '',
  locations: [],
  selectedPin: null,
};

// LocalStorage に永続化されるフォーム状態
export const createRallyAtom = atomWithStorage<CreateRallyForm>(
  'stamp_rally_create_form',
  defaultForm
);

// 選択中のピン (地図でクリックした場所)
export const selectedPinAtom = atom<CreateRallyLocation | null>(null);

// ローカルIDカウンター
let _counter = 0;
export function genLocalId(): string {
  return `local_${++_counter}_${Date.now()}`;
}

// フォームリセット
export const defaultCreateRallyForm = defaultForm;
