'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CreateRallyLocation } from '@/types';
import styles from './LocationDndList.module.css';

interface Props {
  locations: CreateRallyLocation[];
  onRemove: (id: string) => void;
  onReorder: (newLocations: CreateRallyLocation[]) => void;
}

export default function LocationDndList({ locations, onRemove, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = locations.findIndex(l => l.id === active.id);
    const newIndex = locations.findIndex(l => l.id === over.id);
    onReorder(arrayMove(locations, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={locations.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div className={styles.list}>
          {locations.map((loc, index) => (
            <SortableItem
              key={loc.id}
              location={loc}
              index={index}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({
  location,
  index,
  onRemove,
}: {
  location: CreateRallyLocation;
  index: number;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: location.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`${styles.item} ${isDragging ? styles.dragging : ''}`}>
      <div className={styles.dragHandle} {...attributes} {...listeners} title="ドラッグで並び替え">
        ⠿
      </div>
      <div className={styles.num}>{index + 1}</div>
      <div className={styles.info}>
        <div className={styles.name}>{location.name}</div>
        {location.address && (
          <div className={styles.addr}>{location.address}</div>
        )}
      </div>
      <button
        className={styles.removeBtn}
        onClick={() => onRemove(location.id)}
        title="削除"
        type="button"
      >
        ✕
      </button>
    </div>
  );
}
