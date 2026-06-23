import { statusLabel } from "@/lib/format";
import type { Room, RoomStatusSnapshot } from "@/types/api";

import { today } from "../constants";
import { Badge, EmptyState, PanelHeader } from "../components/ui";

export function RoomsPanel({ rooms, roomStatus }: { rooms?: Room[]; roomStatus?: RoomStatusSnapshot }) {
  const statusMap = new Map((roomStatus?.rooms || []).map((room) => [`${room.centerId}-${room.roomCode}`, room]));

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader title="咨询室情况" description={`快照：${roomStatus?.date || today} ${roomStatus?.timeSlot || ""}`} />
      {!rooms || rooms.length === 0 ? (
        <EmptyState text="暂无咨询室数据。" />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">预约中心</th>
              <th className="px-5 py-3 font-medium">咨询室</th>
              <th className="px-5 py-3 font-medium">全局状态</th>
              <th className="px-5 py-3 font-medium">当前占用</th>
              <th className="px-5 py-3 font-medium">咨询师</th>
              <th className="px-5 py-3 font-medium">来访者</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              const snapshot = statusMap.get(`${room.centerId}-${room.roomCode}`);
              return (
                <tr key={`${room.centerId}-${room.roomCode}`} className="border-t border-[var(--lxxl-border)]">
                  <td className="px-5 py-4">{room.centerName}</td>
                  <td className="px-5 py-4">{room.name}</td>
                  <td className="px-5 py-4">
                    <Badge>{statusLabel(room.status)}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={snapshot?.occupancy === "IN_SESSION" ? "gold" : "green"}>
                      {statusLabel(snapshot?.occupancy)}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">{snapshot?.counselorName || "-"}</td>
                  <td className="px-5 py-4">{snapshot?.patientName || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
