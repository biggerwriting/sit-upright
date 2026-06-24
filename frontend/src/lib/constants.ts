// frontend/src/lib/constants.ts

/** 头肩距离阈值，低于此值判定弓腰（与 check_posture.py 保持一致） */
export const HUNCH_THRESHOLD = 0.18

/** 连续弓腰超过此秒数显示文字警告 */
export const ALERT_TEXT_SECONDS = 3

/** 连续弓腰超过此秒数播放语音警告 */
export const ALERT_VOICE_SECONDS = 5

/** 语音警告后每隔此秒数重复播放（直到坐正） */
export const ALERT_REPEAT_SECONDS = 30

/** 向后端上报的间隔（秒） */
export const REPORT_INTERVAL_SECONDS = 30
