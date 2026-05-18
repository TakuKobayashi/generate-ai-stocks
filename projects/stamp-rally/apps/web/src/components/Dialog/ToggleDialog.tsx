'use client';

import type { StampRally } from '@/types';

interface Props {
  rally: StampRally;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ToggleDialog({ rally, onConfirm, onCancel }: Props) {
  const willDisable = rally.isActive;

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3 className="dialog-title">
          {willDisable ? '⚠️ スタンプラリーを無効にしますか？' : '✅ スタンプラリーを有効にしますか？'}
        </h3>
        <p className="dialog-body">
          「{rally.name}」を
          {willDisable
            ? '無効にすると、ユーザーは参加・スタンプ押下ができなくなります。後から再度有効にすることができます。'
            : '有効にすると、ユーザーが参加できるようになります。'}
        </p>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button
            className={`btn ${willDisable ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {willDisable ? '無効にする' : '有効にする'}
          </button>
        </div>
      </div>
    </div>
  );
}
