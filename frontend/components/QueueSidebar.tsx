'use client'

import React, { useState } from 'react'
import { QueueItemWithDetails } from '@/types'
import { formatDuration } from '@/lib/utils'
import Image from 'next/image'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface QueueSidebarProps {
  queue: QueueItemWithDetails[]
  currentSongId: string | null
  onRemove: (queueItemId: string) => void
  onReorder: (orderedIds: string[]) => void
}

interface SortableQueueItemProps {
  item: QueueItemWithDetails
  isPlaying: boolean
  onRemove: (id: string) => void
}

function SortableQueueItem({ item, isPlaying, onRemove }: SortableQueueItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <QueueItemCard
        item={item}
        isPlaying={isPlaying}
        onRemove={onRemove}
        dragListeners={listeners}
      />
    </div>
  )
}

interface QueueItemCardProps {
  item: QueueItemWithDetails
  isPlaying: boolean
  onRemove: (id: string) => void
  dragListeners?: React.HTMLAttributes<HTMLElement>
  isOverlay?: boolean
}

function QueueItemCard({ item, isPlaying, onRemove, dragListeners, isOverlay }: QueueItemCardProps) {
  return (
    <div
      className={`
        relative group rounded-lg overflow-hidden transition-all duration-200
        ${isPlaying ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 ring-2 ring-purple-500' : 'bg-gray-800/50 hover:bg-gray-800'}
        ${isOverlay ? 'shadow-2xl ring-2 ring-purple-400/50' : ''}
      `}
    >
      <div className="flex items-center space-x-3 p-3">
        {/* Drag Handle */}
        <button
          className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 text-gray-500 hover:text-gray-300 touch-none"
          {...dragListeners}
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>

        {/* Album Art */}
        <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
          {item.song.image_url ? (
            <Image
              src={item.song.image_url}
              alt={item.song.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
          )}
          {isPlaying && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="flex space-x-0.5">
                <div className="w-0.5 h-3 bg-white rounded-full animate-pulse" />
                <div className="w-0.5 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-0.5 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Song Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate text-sm ${isPlaying ? 'text-purple-300' : 'text-white'}`}>
            {item.song.name}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {item.song.artist}
          </p>
          <div className="flex items-center space-x-2 mt-0.5">
            <span className="text-xs text-gray-500">
              {formatDuration(item.song.duration_ms)}
            </span>
            <span className="text-xs text-gray-600">•</span>
            <span className="text-xs text-gray-500 truncate">
              {item.added_by_name || item.added_by}
            </span>
          </div>
        </div>

        {/* Remove Button */}
        <button
          onClick={() => onRemove(item.id)}
          className="flex-shrink-0 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-600/20 rounded transition-all"
          title="Remove"
        >
          <svg
            className="w-4 h-4 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function QueueSidebar({
  queue,
  currentSongId,
  onRemove,
  onReorder,
}: QueueSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = queue.findIndex((item) => item.id === active.id)
    const newIndex = queue.findIndex((item) => item.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(queue, oldIndex, newIndex)
    onReorder(newOrder.map((item) => item.id))
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  if (queue.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center space-y-4 p-6">
          <svg
            className="w-16 h-16 mx-auto text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <p className="text-lg font-medium">Queue is empty</p>
          <p className="text-sm text-gray-600">Add songs to get started</p>
        </div>
      </div>
    )
  }

  const activeItem = activeId ? queue.find((item) => item.id === activeId) : null

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={queue.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {queue.map((item) => (
              <SortableQueueItem
                key={item.id}
                item={item}
                isPlaying={item.song.id === currentSongId}
                onRemove={onRemove}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeItem ? (
              <QueueItemCard
                item={activeItem}
                isPlaying={activeItem.song.id === currentSongId}
                onRemove={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
