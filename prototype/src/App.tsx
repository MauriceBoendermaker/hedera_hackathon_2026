import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Nav from './components/misc/Nav';
import { Footer } from './components/misc/Footer';
import ShortenPage from './components/ShortenPage';
import Dashboard from './components/Dashboard';
import RedirectPage from './components/utils/RedirectPage';
import HowItWorks from 'components/How-it-works';
import About from './components/About';
import { ErrorBoundary } from './components/utils/ErrorBoundary';

import "./assets/scss/style.scss";

function App() {
  useEffect(() => {
    const cursor = document.getElementById('custom-cursor');
    if (!cursor) return;

    let cx = 0, cy = 0;
    let rafId = 0;

    const move = (e: MouseEvent) => {
      cx = e.clientX;
      cy = e.clientY;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
          rafId = 0;
        });
      }
    };

    const addHoverClass = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a')) {
        cursor.classList.add('cursor-link');
        cursor.classList.remove('cursor-hovering');
      } else if (target.closest('button') || target.closest('input')) {
        cursor.classList.add('cursor-hovering');
        cursor.classList.remove('cursor-link');
      } else {
        cursor.classList.remove('cursor-hovering', 'cursor-link');
      }
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseover', addHoverClass);

    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseover', addHoverClass);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <ErrorBoundary>
    <Router>
      <Nav />

      <Routes>
        <Route path="/" element={<ShortenPage />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/:shortId" element={<RedirectPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <Footer />
      <div
        id="toast-container"
        className="toast-container position-fixed bottom-0 end-0 p-3"
        style={{ zIndex: 1055 }}
      ></div>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
