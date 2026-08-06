import { useEffect } from 'react';
import Login from '../components/Login';
import { useAppData } from '../context/AppDataContext';

export default function LoginPage() {
  const { employees, handleLogin } = useAppData();

  useEffect(() => {
    document.title = 'เข้าสู่ระบบ - WongWorkpath';
  }, []);

  return <Login employees={employees} onLogin={handleLogin} />;
}
