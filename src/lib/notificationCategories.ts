import type { NotificationCategory } from '../types';

// What each Settings → การแจ้งเตือน switch controls, in display order. Every pushNotification call
// in AppDataContext.tsx tags its notification with one of these ids.
export const NOTIFICATION_CATEGORY_META: Record<NotificationCategory, { label: string; description: string }> = {
  assignment: { label: 'การมอบหมาย', description: 'ได้รับมอบหมายงานใหม่ หรือถูกตั้งเป็นผู้รับผิดชอบหลักของโครงการ' },
  review: { label: 'การตรวจงาน', description: 'มีงานส่งมาให้ตรวจ และผลการตรวจงานที่คุณส่ง (ผ่าน / ตีกลับ)' },
  blocked: { label: 'งานติดปัญหา', description: 'งานที่เกี่ยวข้องกับคุณถูกทำเครื่องหมายว่าติดปัญหา' },
  deadline: { label: 'กำหนดส่งงาน', description: 'งานของคุณใกล้ครบกำหนด หรือเลยกำหนดส่งแล้ว' },
  meeting: { label: 'นัดประชุม', description: 'นัดประชุมใหม่ การยกเลิกนัด และเตือนก่อนถึงเวลา' },
  approval: { label: 'คำขออนุมัติ', description: 'คำขอแก้ไข/ลบที่รออนุมัติ ผลการพิจารณาคำขอ และการเปลี่ยนแปลงที่เกี่ยวข้อง' },
};
