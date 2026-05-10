import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { CreateRallyForm, CreateRallyLocation } from '@/types';

export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createDefaultCreateRallyForm(): CreateRallyForm {
  return {
    name: '',
    description: '',
    startAt: toDateTimeLocalValue(new Date()),
    endAt: '',
    maxParticipants: '',
    locations: [],
    selectedPin: null,
  };
}

const defaultForm: CreateRallyForm = createDefaultCreateRallyForm();

export const createRallyAtom = atomWithStorage<CreateRallyForm>(
  'stamp_rally_create_form',
  defaultForm
);

export const selectedPinAtom = atom<CreateRallyLocation | null>(null);

let _counter = 0;
export function genLocalId(): string {
  return `local_${++_counter}_${Date.now()}`;
}

export const defaultCreateRallyForm = defaultForm;
