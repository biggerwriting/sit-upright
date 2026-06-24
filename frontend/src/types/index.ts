// frontend/src/types/index.ts

export type Landmark = {
  x: number  // 归一化 0-1
  y: number  // 归一化 0-1，向下为正
  z: number
}

export type PostureResult = {
  isHunching: boolean
  headShoulderDist: number  // 头肩距离，正值表示头在肩上方
}

export type Segment = {
  type: 'good' | 'bad'
  durationSeconds: number  // 该段持续秒数
}

export type SessionStats = {
  totalSeconds: number
  goodSeconds: number
  badSeconds: number
  segments: Segment[]
}

export type QuotaInfo = {
  remainingSeconds: number  // 剩余配额（秒）
}

export type SessionId = string

export type User = {
  id: number
  email: string
}
