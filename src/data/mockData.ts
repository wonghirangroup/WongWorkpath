import { Employee, CredentialItem } from '../types';

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'E01',
    name: 'สมศักดิ์ รักดี',
    email: 'somsak.r@company.com',
    role: 'IT Lead / Senior Developer',
    department: 'แผนกเทคโนโลยีและไอที',
    division: 'ฝ่ายพัฒนาและไอที',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    accountType: 'employee'
  },
  {
    id: 'E02',
    name: 'ณิชา วงศ์สุวรรณ',
    email: 'nicha.w@company.com',
    role: 'Senior UI/UX Designer',
    department: 'แผนกเทคโนโลยีและไอที',
    division: 'ฝ่ายพัฒนาและไอที',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    accountType: 'employee'
  },
  {
    id: 'E03',
    name: 'วิชัย มีสุข',
    email: 'wichai.m@company.com',
    role: 'Marketing Coordinator',
    department: 'แผนกธุรการการตลาด',
    division: 'ฝ่ายการตลาดและออนไลน์',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    accountType: 'employee'
  },
  {
    id: 'E04',
    name: 'พิมลวรรณ แสนคำ',
    email: 'pimonwan.s@company.com',
    role: 'Frontend Developer',
    department: 'แผนกเทคโนโลยีและไอที',
    division: 'ฝ่ายพัฒนาและไอที',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    accountType: 'employee'
  },
  {
    id: 'E05',
    name: 'อานนท์ เลิศวิทยา',
    email: 'anont.l@company.com',
    role: 'Product Owner / PM',
    department: 'แผนกพัฒนาธุรกิจและองค์กร',
    division: 'ฝ่ายพัฒนาและไอที',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    accountType: 'employee'
  },
  {
    id: 'E06',
    name: 'ธนา อัครเดช',
    email: 'thana.a@company.com',
    role: 'Junior UI Designer',
    department: 'แผนกเทคโนโลยีและไอที',
    division: 'ฝ่ายพัฒนาและไอที',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    accountType: 'employee'
  },
  {
    id: 'E07',
    name: 'กัญญา ศรีสุข',
    email: 'kanya.s@company.com',
    role: 'HR Manager',
    department: 'แผนกบุคคล',
    division: 'ฝ่ายบริหารและสนับสนุน',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    accountType: 'employee'
  },
  {
    id: 'E08',
    name: 'กิตตินันท์ ทิพย์รักษา',
    nickname: 'กิตตินันท์ ทิพย์รักษา',
    email: 'kittinan7689@company.com',
    username: 'kittinan7689',
    role: 'UX / UI Designer',
    department: 'แผนกเทคโนโลยีและไอที',
    division: 'ฝ่ายพัฒนาและไอที',
    avatar: '',
    accountType: 'employee'
  },
  {
    id: 'E09',
    name: 'ผู้ดูแลระบบ',
    nickname: 'Admin',
    email: 'adw001@company.com',
    username: 'ADMIN-002',
    role: 'System Administrator',
    department: 'แผนกเทคโนโลยีและไอที',
    division: 'ฝ่ายพัฒนาและไอที',
    avatar: '',
    accountType: 'admin'
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
