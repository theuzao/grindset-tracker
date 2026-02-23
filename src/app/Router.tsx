import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Quests } from '@/pages/Quests';
import { Activities } from '@/pages/Activities';
import { Calendar } from '@/pages/Calendar';
import { Objectives } from '@/pages/Objectives';
import { Analytics } from '@/pages/Analytics';
import { Reflections } from '@/pages/Reflections';
import { Character } from '@/pages/Character';
import { Settings } from '@/pages/Settings';
import { Anki } from '@/pages/Anki';
import { Faculdade } from '@/pages/Faculdade';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'quests', element: <Quests /> },
      { path: 'activities', element: <Activities /> },
      { path: 'calendar', element: <Calendar /> },
      { path: 'objectives', element: <Objectives /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'anki', element: <Anki /> },
      { path: 'faculdade', element: <Faculdade /> },
      { path: 'reflections', element: <Reflections /> },
      { path: 'character', element: <Character /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
