/* @refresh reload */
import { render } from 'solid-js/web';
import { HashRouter, Route } from '@solidjs/router';
import App from './App';
import LoginPage from './pages/LoginPage';
import TasksPage from './pages/TasksPage';
import './app.css';

render(
  () => (
    <HashRouter root={App}>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={TasksPage} />
      <Route path="*" component={TasksPage} />
    </HashRouter>
  ),
  document.getElementById('root')!
);
