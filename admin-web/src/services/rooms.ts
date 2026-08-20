import { apiRequest } from "@/lib/api";
import type {
  ApiMessage,
  Room,
  RoomDetail,
  RoomSlotManualStatus,
  RoomStatusSnapshot,
  ScheduleRoomOptions,
} from "@/types/api";
import type { RoomFilters } from "@/types/app";

function withQuery(path: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export async function fetchRoomsData(filters: RoomFilters) {
  const roomParams = new URLSearchParams();
  const statusParams = new URLSearchParams();

  if (filters.centerId) {
    roomParams.set("center_id", filters.centerId);
  }

  if (filters.date) {
    statusParams.set("date", filters.date);
  }

  if (filters.timeSlot) {
    statusParams.set("time_slot", filters.timeSlot);
  }

  const [rooms, roomStatus] = await Promise.all([
    apiRequest<Room[]>(withQuery("/api/mini/ops/rooms", roomParams)),
    apiRequest<RoomStatusSnapshot>(withQuery("/api/mini/ops/rooms/status", statusParams)),
  ]);

  return { rooms, roomStatus };
}

export function fetchRoomDetail(roomId: number) {
  return apiRequest<RoomDetail>(`/api/mini/ops/rooms/${roomId}`);
}

export function createRoom(input: { centerId: string; name: string; roomCode?: string; status?: string }) {
  return apiRequest<Room>("/api/mini/ops/rooms", {
    method: "POST",
    body: JSON.stringify({
      center_id: input.centerId,
      name: input.name,
      room_code: input.roomCode || undefined,
      status: input.status || "AVAILABLE",
    }),
  });
}

export function updateRoom(roomId: number, input: { name?: string; status?: string }) {
  return apiRequest<Room>(`/api/mini/ops/rooms/${roomId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: input.name,
      status: input.status,
    }),
  });
}

export function deleteRoom(roomId: number) {
  return apiRequest<{ msg?: string }>(`/api/mini/ops/rooms/${roomId}`, {
    method: "DELETE",
  });
}

export function saveRoomSlotStatuses(
  roomId: number,
  slots: Array<{ startTime: string; status: RoomSlotManualStatus }>,
) {
  return apiRequest<ApiMessage>(`/api/mini/ops/rooms/${roomId}/slot-statuses`, {
    method: "PUT",
    body: JSON.stringify({
      slots: slots.map((slot) => ({
        start_time: slot.startTime,
        status: slot.status,
      })),
    }),
  });
}

export function fetchScheduleRoomOptions(scheduleId: number) {
  return apiRequest<ScheduleRoomOptions>(`/api/mini/ops/schedules/${scheduleId}/room-options`);
}

export function changeScheduleRoom(scheduleId: number, roomCode: string) {
  return apiRequest<ApiMessage>(`/api/mini/ops/schedules/${scheduleId}/room`, {
    method: "PUT",
    body: JSON.stringify({ room_code: roomCode }),
  });
}
