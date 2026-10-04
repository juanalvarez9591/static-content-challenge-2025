import { Route, Routes } from 'react-router-dom';
import { AdminArea } from './admin/AdminArea.jsx';
import { PublicPage } from './PublicPage.jsx';

export function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminArea />} />
      <Route path="*" element={<PublicPage />} />
    </Routes>
  );
}
