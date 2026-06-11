import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

export interface BonitaSession {
  user_id: string;
  user_name: string;
  session_id: string;
  is_technical_user: boolean;
  conf: string[];
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  login(username: string, password: string): Promise<void> {
    const body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);
    body.set('redirect', 'false');

    return firstValueFrom(
      this.http.post('/bonita/loginservice', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        responseType: 'text',
      })
    ).then(() => undefined);
  }

  getSession(): Observable<BonitaSession> {
    return this.http.get<BonitaSession>('/bonita/API/system/session/unusedId');
  }

  logout(): Promise<void> {
    return firstValueFrom(
      this.http.get('/bonita/logoutservice', { responseType: 'text' })
    ).then(() => undefined);
  }
}
