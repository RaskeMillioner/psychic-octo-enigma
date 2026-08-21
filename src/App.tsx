import { HashRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BookIcon, BottleIcon, ChartIcon, GearIcon } from './components/icons';
import { DataProvider } from './lib/store';
import { AddWinePage } from './pages/AddWinePage';
import { CellarPage } from './pages/CellarPage';
import { DiaryEntryPage } from './pages/DiaryEntryPage';
import { DiaryPage } from './pages/DiaryPage';
import { ConsumePage } from './pages/ConsumePage';
import { EditWinePage } from './pages/EditWinePage';
import { NewDiaryEntryPage } from './pages/NewDiaryEntryPage';
import { ReceiptScanPage } from './pages/ReceiptScanPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { WineDetailPage } from './pages/WineDetailPage';

const tabs = [
  { to: '/cellar', label: 'Cellar', Icon: BottleIcon },
  { to: '/diary', label: 'Diary', Icon: BookIcon },
  { to: '/stats', label: 'Statistics', Icon: ChartIcon },
  { to: '/settings', label: 'Settings', Icon: GearIcon },
];

const Shell = () => (
  <div className="app">
    <Outlet />
    <nav className="app-nav">
      {tabs.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  </div>
);

const App = () => (
  <DataProvider>
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/cellar" replace />} />
          <Route path="/cellar" element={<CellarPage />} />
          <Route path="/cellar/new" element={<AddWinePage />} />
          <Route path="/cellar/receipt" element={<ReceiptScanPage />} />
          <Route path="/cellar/:id" element={<WineDetailPage />} />
          <Route path="/cellar/:id/edit" element={<EditWinePage />} />
          <Route path="/cellar/:id/consume" element={<ConsumePage />} />
          <Route path="/diary" element={<DiaryPage />} />
          <Route path="/diary/new" element={<NewDiaryEntryPage />} />
          <Route path="/diary/:id" element={<DiaryEntryPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/cellar" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  </DataProvider>
);

export default App;
