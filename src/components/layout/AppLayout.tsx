import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import Header from './Header';
import Sidebar, { NAV_ITEMS } from './Sidebar';
import TaskModal from '../TaskModal';

export default function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const activeItem = NAV_ITEMS.find((item) => pathname === `/${item.id}`);
    document.title = activeItem ? `${activeItem.label} - WongWorkpath` : 'WongWorkpath';
  }, [pathname]);

  const {
    isTaskModalOpen,
    closeTaskModal,
    handleSaveTask,
    selectedTaskToEdit,
    employees,
    tasks,
    documents,
    saveDocuments
  } = useAppData();

  return (
    <div className="h-dvh overflow-hidden bg-[#FFFFFF] flex flex-col font-sans text-slate-800 antialiased" id="main-app-container">
      <Header
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Frame Container */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        />

        {/* Scrollable Main Area View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" >
          <Outlet />
        </main>
      </div>

      {/* Task Creation / Editing Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={closeTaskModal}
        onSave={handleSaveTask}
        task={selectedTaskToEdit}
        employees={employees}
        allTasks={tasks}
        documents={documents}
        onAddDocument={(doc) => saveDocuments([...documents, doc])}
      />
    </div>
  );
}
