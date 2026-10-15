import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout';
import { ErrorNotice, Loading } from './components/ui';
import { useAuth } from './lib/session-context';
import { AuthPage, InvitePage } from './pages/auth';
import { isLocalDemo } from './lib/demo-config';
import { DemoReset } from './components/demo-reset';

const Overview = lazy(() => import('./pages/overview'));
const Projects = lazy(() => import('./pages/projects'));
const ProjectDetails = lazy(() => import('./pages/project-details'));
const Board = lazy(() => import('./pages/board'));
const Clients = lazy(() => import('./pages/clients'));
const Team = lazy(() => import('./pages/team'));
function Protected() {
  const auth = useAuth();
  if (auth.loading) return <Loading />;
  if (auth.error)
    return (
      <main className="fatal-error">
        <ErrorNotice error={auth.error} retry={auth.retry} />
        {isLocalDemo ? <DemoReset /> : null}
      </main>
    );
  return auth.session ? <Layout /> : <Navigate to="/login" replace />;
}
export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route
          path="/login"
          element={isLocalDemo ? <Navigate to="/overview" replace /> : <AuthPage />}
        />
        <Route
          path="/register"
          element={isLocalDemo ? <Navigate to="/overview" replace /> : <AuthPage register />}
        />
        <Route
          path="/invite"
          element={isLocalDemo ? <Navigate to="/overview" replace /> : <InvitePage />}
        />
        <Route element={<Protected />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetails />} />
          <Route path="/board" element={<Board />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/team" element={<Team />} />
        </Route>
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </Suspense>
  );
}
