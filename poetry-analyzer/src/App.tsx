import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import PoemsPage from "./pages/PoemsPage";
import PoemDetailPage from "./pages/PoemDetailPage";
import UploadPage from "./pages/UploadPage";
import GroupsPage from "./pages/GroupsPage";
import StatsPage from "./pages/StatsPage";
import LemmaPage from "./pages/LemmaPage";
import ComparePage from "./pages/ComparePage";
import TablePage from "./pages/TablePage";
import ConcordancePage from "./pages/ConcordancePage";
import NetworkPage from "./pages/NetworkPage";
import DispersionPage from "./pages/DispersionPage";
import RepeatsPage from "./pages/RepeatsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<UploadPage />} />
        <Route path="/poems" element={<PoemsPage />} />
        <Route path="/poems/:id" element={<PoemDetailPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/lemma/:lemma" element={<LemmaPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/table" element={<TablePage />} />
        <Route path="/concordance" element={<ConcordancePage />} />
        <Route path="/network" element={<NetworkPage />} />
        <Route path="/dispersion" element={<DispersionPage />} />
        <Route path="/repeats" element={<RepeatsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
