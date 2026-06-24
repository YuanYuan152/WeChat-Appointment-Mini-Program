import { apiRequest } from "@/lib/api";
import type { Room, RoomStatusSnapshot } from "@/types/api";
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
