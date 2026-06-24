import { apiRequest } from "@/lib/api";
import type { Room, RoomStatusSnapshot } from "@/types/api";

export async function fetchRoomsData() {
  const [rooms, roomStatus] = await Promise.all([
    apiRequest<Room[]>("/api/mini/ops/rooms"),
    apiRequest<RoomStatusSnapshot>("/api/mini/ops/rooms/status"),
  ]);

  return { rooms, roomStatus };
}
