/**
 * 各预约中心下的咨询室（仅咨询师挂课时选择，来访者预约界面不展示）
 */
export interface ConsultationRoom {
  id: string
  name: string
}

export const CONSULTATION_ROOMS: Record<string, ConsultationRoom[]> = {
  yangpu: [
    { id: 'yangpu-r1', name: '咨询室 A' },
    { id: 'yangpu-r2', name: '咨询室 B' },
    { id: 'yangpu-r3', name: '咨询室 C' },
  ],
  pudong: [
    { id: 'pudong-r1', name: '咨询室 A' },
    { id: 'pudong-r2', name: '咨询室 B' },
    { id: 'pudong-r3', name: '咨询室 C' },
  ],
}

export const getRoomsByCenter = (centerId: string): ConsultationRoom[] =>
  CONSULTATION_ROOMS[centerId] || []

export const getRoomName = (centerId: string, roomId: string): string => {
  const room = getRoomsByCenter(centerId).find(r => r.id === roomId)
  return room?.name || roomId
}
