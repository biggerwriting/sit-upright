'use client'
import type { ReactNode } from 'react'

type ModalProps = { children: ReactNode; onClose: () => void }

export function Modal({ children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {children}
      </div>
    </div>
  )
}
