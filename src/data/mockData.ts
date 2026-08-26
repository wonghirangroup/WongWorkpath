import { Employee, Task, LinkedDoc, CredentialItem, LeaveRequest, Notification } from '../types';

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'E01',
    name: 'สมศักดิ์ รักดี',
    email: 'somsak.r@company.com',
    role: 'IT Lead / Senior Developer',
    department: 'IT',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'E02',
    name: 'ณิชา วงศ์สุวรรณ',
    email: 'nicha.w@company.com',
    role: 'Senior UI/UX Designer',
    department: 'Design',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'E03',
    name: 'วิชัย มีสุข',
    email: 'wichai.m@company.com',
    role: 'Marketing Coordinator',
    department: 'Marketing',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'E04',
    name: 'พิมลวรรณ แสนคำ',
    email: 'pimonwan.s@company.com',
    role: 'Frontend Developer',
    department: 'IT',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'E05',
    name: 'อานนท์ เลิศวิทยา',
    email: 'anont.l@company.com',
    role: 'Product Owner / PM',
    department: 'Finance',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'E06',
    name: 'ธนา อัครเดช',
    email: 'thana.a@company.com',
    role: 'Junior UI Designer',
    department: 'Design',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'E07',
    name: 'กัญญา ศรีสุข',
    email: 'kanya.s@company.com',
    role: 'HR Manager',
    department: 'HR',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'E08',
    name: 'กิตตินันท์ ทิพย์รักษา',
    nickname: 'กิตตินันท์ ทิพย์รักษา',
    email: 'kittinan7689@company.com',
    username: 'kittinan7689',
    role: 'UX / UI Designer',
    department: 'Design',
    avatar: ''
  },
  {
    id: 'E09',
    name: 'ผู้ดูแลระบบ',
    nickname: 'Admin',
    email: 'adw001@company.com',
    username: 'ADW001',
    role: 'System Administrator',
    department: 'IT',
    avatar: '',
    isAdmin: true
  }
];

export const INITIAL_DOCS: LinkedDoc[] = [
  {
    id: 'DOC01',
    name: 'Google Sheets: แผนงบประมาณโครงการ Q3-2026',
    kind: 'link',
    parentId: null,
    url: 'https://docs.google.com/spreadsheets/d/1XyZABC123/edit',
    scope: 'ทีม',
    team: 'Finance',
    version: 3,
    lastUpdated: '2026-07-01 14:30',
    updatedBy: 'อานนท์ เลิศวิทยา',
    history: [
      { version: 3, updatedBy: 'อานนท์ เลิศวิทยา', date: '2026-07-01 14:30', note: 'อัปเดตงบโฆษณาใน Marketing Plan' },
      { version: 2, updatedBy: 'สมศักดิ์ รักดี', date: '2026-06-28 10:15', note: 'เพิ่มงบประมาณส่วน Server & Cloud Hosting' },
      { version: 1, updatedBy: 'อานนท์ เลิศวิทยา', date: '2026-06-25 09:00', note: 'สร้างเอกสารโครงสร้างงบประมาณครั้งแรก' }
    ]
  },
  {
    id: 'DOC02',
    name: 'Google Docs: เอกสารสเปกความปลอดภัยระเบียบข้อมูล',
    kind: 'link',
    parentId: null,
    url: 'https://docs.google.com/document/d/1YzDEF456/edit',
    scope: 'ทีม',
    team: 'IT',
    version: 1,
    lastUpdated: '2026-06-30 11:20',
    updatedBy: 'สมศักดิ์ รักดี',
    history: [
      { version: 1, updatedBy: 'สมศักดิ์ รักดี', date: '2026-06-30 11:20', note: 'เอกสารเริ่มต้นข้อตกลงความปลอดภัย' }
    ]
  },
  {
    id: 'DOC03',
    name: 'Figma: ออกแบบ UI/UX หน้าหลักและระบบแดชบอร์ด',
    kind: 'link',
    parentId: null,
    url: 'https://figma.com/file/1Z_UIUX_Design/edit',
    scope: 'ทีม',
    team: 'Design',
    version: 5,
    lastUpdated: '2026-07-02 16:45',
    updatedBy: 'ณิชา วงศ์สุวรรณ',
    history: [
      { version: 5, updatedBy: 'ณิชา วงศ์สุวรรณ', date: '2026-07-02 16:45', note: 'ปรับปรุงสีโทนเข้มและ UI Gantt Chart' },
      { version: 4, updatedBy: 'ณิชา วงศ์สุวรรณ', date: '2026-06-30 15:00', note: 'เพิ่มหน้าโปรไฟล์และการตั้งค่ารหัสผ่าน' }
    ]
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'TASK01',
    title: 'ออกแบบหน้าจอแดชบอร์ดและแผนภูมิแกนต์',
    description: 'จัดทำโครงร่าง UI/UX (Wireframes) และการเชื่อมต่อภาพมุมมองภาพรวมแผนภูมิเพื่อความสวยงามและใช้งานง่าย สำหรับฝ่ายออกแบบและพัฒนา',
    project: 'ระบบจัดการแผนงาน UnitySpace',
    priority: 'High',
    status: 'In Progress',
    progress: 75,
    startDate: '2026-06-25',
    dueDate: '2026-07-05',
    department: 'Design',
    primaryOwnerId: 'E02',
    secondaryAssigneeIds: ['E06'],
    contributorIds: ['E04'],
    dependencies: [],
    approvalStatus: 'None',
    recurringPattern: 'None',
    linkedDocIds: ['DOC03'],
    handovers: [
      {
        id: 'HO01',
        fromUserId: 'E06',
        toUserId: 'E02',
        stageName: 'ร่างแนวคิด UI เริ่มต้น',
        notes: 'เสร็จสิ้นการขึ้นเค้าโครงร่างแบรนด์เรียบร้อยแล้ว ส่งมอบให้หัวหน้าดีไซเนอร์ตรวจสอบและอนุมัติโครงร่างงานละเอียด',
        timestamp: '2026-06-28 16:30',
        status: 'Approved',
        approvedBy: 'ณิชา วงศ์สุวรรณ',
        approvalNotes: 'โครงร่างดีมาก สามารถลุยต่อหน้าย่อยได้เลย!'
      }
    ]
  },
  {
    id: 'TASK02',
    title: 'พัฒนาโมดูลเก็บรักษาข้อมูลความปลอดภัย (Credential Vault)',
    description: 'เขียนระบบกักเก็บรหัสการเข้าถึงแบบเข้ารหัส เพื่อป้องกันความปลอดภัยของข้อมูลพนักงานและระบบ และรองรับการบันทึกการเข้าดู (Audit Logs)',
    project: 'ระบบโครงสร้างพื้นฐานไอที',
    priority: 'High',
    status: 'In Progress',
    progress: 40,
    startDate: '2026-06-28',
    dueDate: '2026-07-10',
    department: 'IT',
    primaryOwnerId: 'E01',
    secondaryAssigneeIds: ['E04'],
    contributorIds: [],
    dependencies: [],
    approvalStatus: 'None',
    recurringPattern: 'None',
    linkedDocIds: ['DOC02'],
    handovers: []
  },
  {
    id: 'TASK03',
    title: 'เตรียมงบการเงินและคำนวณงบประมาณ Q3',
    description: 'รวบรวมรายได้-รายจ่าย และสรุปตัวเลขสถิติเพื่อคาดการณ์งบประมาณโฆษณาและการพัฒนาเชิงกลยุทธ์',
    project: 'งานประเมินบัญชีและการเงิน',
    priority: 'Medium',
    status: 'Not Started',
    progress: 0,
    startDate: '2026-07-04',
    dueDate: '2026-07-15',
    department: 'Finance',
    primaryOwnerId: 'E05',
    secondaryAssigneeIds: [],
    contributorIds: ['E01', 'E03'],
    dependencies: [],
    approvalStatus: 'None',
    recurringPattern: 'Monthly',
    linkedDocIds: ['DOC01'],
    handovers: []
  },
  {
    id: 'TASK04',
    title: 'วางแผนโฆษณาโซเชียลมีเดียสิงหาคม',
    description: 'คิดหัวข้อเนื้อหา (Content Pillars) และประสานงานกับกราฟิกดีไซเนอร์สำหรับทำรูปภาพพรีวิวแคมเปญ',
    project: 'แผนโปรโมตประจำปี 2026',
    priority: 'Low',
    status: 'On Hold',
    progress: 15,
    startDate: '2026-06-20',
    dueDate: '2026-07-02',
    actualEndDate: '2026-07-02',
    department: 'Marketing',
    primaryOwnerId: 'E03',
    secondaryAssigneeIds: ['E06'],
    contributorIds: [],
    dependencies: [],
    approvalStatus: 'None',
    recurringPattern: 'Weekly',
    linkedDocIds: [],
    handovers: []
  },
  {
    id: 'TASK05',
    title: 'ทดสอบการรวมระบบและการแสดงผลประสิทธิภาพ (Performance Testing)',
    description: 'ทดสอบการโหลดข้อมูลหน้า Gantt และ Dashboard รวมทั้งปรับปรุงประสิทธิภาพและเช็คการใช้หน่วยความจำ',
    project: 'ระบบจัดการแผนงาน UnitySpace',
    priority: 'High',
    status: 'Completed',
    progress: 100,
    startDate: '2026-06-24',
    dueDate: '2026-07-01',
    actualEndDate: '2026-06-30',
    department: 'IT',
    primaryOwnerId: 'E04',
    secondaryAssigneeIds: ['E01'],
    contributorIds: [],
    dependencies: ['TASK01'],
    approvalStatus: 'Approved',
    approvalNote: 'ระบบผ่านการทดสอบอย่างสมบูรณ์ ไม่มีจุดติดขัดเรื่องการแสดงผล',
    recurringPattern: 'None',
    linkedDocIds: [],
    handovers: [
      {
        id: 'HO02',
        fromUserId: 'E04',
        toUserId: 'E01',
        stageName: 'ส่งต่อผลสอบเพื่อขออนุมัติปิดงาน',
        notes: 'ทดสอบหน้าจอครบ 5 เบราว์เซอร์แล้ว ทำงานได้ลื่นไหล ขอรับการอนุมัติปิดงานจากคุณสมศักดิ์ด้วยครับ',
        timestamp: '2026-06-30 10:00',
        status: 'Approved',
        approvedBy: 'สมศักดิ์ รักดี',
        approvalNotes: 'ผลเทสผ่านเกณฑ์ทั้งหมด อนุมัติให้ปิดงานเรียบร้อย ดีมาก!'
      }
    ]
  }
];

export const INITIAL_CREDENTIALS: CredentialItem[] = [
  {
    id: 'CRED01',
    label: 'Google Cloud Platform Server Key (Dev)',
    type: 'API Key',
    scope: 'ส่วนตัว',
    username: 'gcp-service-account@company-dev.iam.gserviceaccount.com',
    keyValue: 'AIzaSyA4xK_t8N2u_M9p1Q0w7e5R3s2t1v0b_Y',
    notes: 'โปรดใช้อย่างระมัดระวัง คีย์มีจำกัดโควตาการเรียกใช้งานต่อวัน',
    createdAt: '2026-06-15 10:00',
    createdBy: 'สมศักดิ์ รักดี'
  },
  {
    id: 'CRED02',
    label: 'ฐานข้อมูลลูกค้าระบบหลัก (Production Database)',
    type: 'Username & Password',
    scope: 'ทีม',
    username: 'admin_prod_user',
    password: 'SuperSecurePassword_2026_!@#',
    keyValue: 'postgresql://admin_prod_user:SuperSecurePassword_2026@10.240.0.5:5432/production_db',
    notes: 'ห้ามนำไปแชร์ให้ทีมที่ไม่มีสิทธิ์การเข้าถึงภายนอกโดยเด็ดขาด!',
    createdAt: '2026-06-20 09:30',
    createdBy: 'สมศักดิ์ รักดี'
  },
  {
    id: 'CRED03',
    label: 'บัญชีธนาคารสำหรับจ่ายเงินเดือน (Corporate K-Bank)',
    type: 'Bank Account',
    scope: 'ทีม',
    username: 'บริษัท ยูนิตี้สเปซ จำกัด',
    password: 'KBANK-987-2-12345-6',
    notes: 'สำหรับเชื่อมต่อระบบออกสลิปเงินเดือนพนักงานปลายเดือน',
    createdAt: '2026-06-22 11:15',
    createdBy: 'อานนท์ เลิศวิทยา'
  }
];

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'LEAVE01',
    employeeId: 'E02',
    employeeName: 'ณิชา วงศ์สุวรรณ',
    type: 'Vacation',
    startDate: '2026-07-06',
    endDate: '2026-07-08',
    status: 'Approved',
    notes: 'ลาพักร้อนท่องเที่ยวประจำปี'
  },
  {
    id: 'LEAVE02',
    employeeId: 'E03',
    employeeName: 'วิชัย มีสุข',
    type: 'Sick Leave',
    startDate: '2026-07-03',
    endDate: '2026-07-03',
    status: 'Pending',
    notes: 'ลากิจรักษาอาการปวดศีรษะและพบแพทย์'
  }
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'NOTIF01',
    title: 'งานที่ได้รับมอบหมายใหม่',
    message: 'คุณได้รับมอบหมายงาน "วางแผนโฆษณาโซเชียลมีเดียสิงหาคม" ในฐานะผู้มีส่วนร่วม',
    timestamp: '2026-07-02 10:00',
    read: false,
    type: 'info'
  },
  {
    id: 'NOTIF02',
    title: 'การส่งมอบงานต้องการอนุมัติ',
    message: 'งาน "พัฒนาโมดูลเก็บรักษาข้อมูลความปลอดภัย" มีความคืบหน้า 40% และส่งมอบเพื่ออัปเดตสเตจแล้ว',
    timestamp: '2026-07-02 15:30',
    read: false,
    type: 'warning'
  }
];
