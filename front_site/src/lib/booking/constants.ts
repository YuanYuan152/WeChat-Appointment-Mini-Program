export interface AppointmentCenter {
  id: string;
  name: string;
  virtual?: boolean;
}

export const VIDEO_CENTER_ID = "video";

export const APPOINTMENT_CENTERS: AppointmentCenter[] = [
  { id: "yangpu", name: "杨浦预约中心" },
  { id: "pudong", name: "浦东预约中心" },
  { id: VIDEO_CENTER_ID, name: "视频咨询", virtual: true },
];

export const APPOINTMENT_CENTER_MAP = Object.fromEntries(
  APPOINTMENT_CENTERS.map((c) => [c.id, c.name])
) as Record<string, string>;
